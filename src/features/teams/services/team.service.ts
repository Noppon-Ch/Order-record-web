import { createClient } from '@supabase/supabase-js';
import type { Team } from '../../../models/team.model.js';
import type { TeamMember } from '../../../models/team_member.model.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const teamService = {
    async createTeam(userId: string, teamName: string, accessToken?: string): Promise<Team> {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Generate unique team code (simple 6-char alphanum for now)
        const teamCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        const newTeam: Partial<Team> = {
            team_name: teamName,
            team_code: teamCode,
            owner_user_id: userId,
            status: 'active' // Default active for now
        };

        const { data: team, error: teamError } = await supabase
            .from('teams')
            .insert(newTeam)
            .select()
            .single();

        if (teamError) throw new Error(`Failed to create team: ${teamError.message}`);

        // 2. Add creator as leader
        const newMember: Partial<TeamMember> = {
            team_id: team.team_id,
            user_id: userId,
            role: 'leader',
            status: 'active'
        };

        const { error: memberError } = await supabase
            .from('team_members')
            .insert(newMember);

        if (memberError) {
            // Rollback team creation if member addition fails (conceptual, supabase doesn't support trans across request easily without RPC)
            // For now, just throw
            await supabase.from('teams').delete().eq('team_id', team.team_id);
            throw new Error(`Failed to add leader: ${memberError.message}`);
        }

        return team;
    },

    async joinTeam(userId: string, teamCode: string, accessToken?: string): Promise<TeamMember> {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Find team by code
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('*')
            .eq('team_code', teamCode)
            .single();

        if (teamError || !team) throw new Error('Team not found');

        // 2. Check if already member
        const { data: existingMember } = await supabase
            .from('team_members')
            .select('*')
            .eq('team_id', team.team_id)
            .eq('user_id', userId)
            .maybeSingle();

        if (existingMember) throw new Error('Already a member of this team');

        // 3. Add as member (pending)
        const newMember: Partial<TeamMember> = {
            team_id: team.team_id,
            user_id: userId,
            role: 'member',
            status: 'pending'
        };

        const { data: member, error: memberError } = await supabase
            .from('team_members')
            .insert(newMember)
            .select()
            .single();

        if (memberError) throw new Error(`Failed to join team: ${memberError.message}`);

        return member;
    },

    async getTeamByUserId(userId: string, accessToken?: string): Promise<{ team: Team, members: (TeamMember & { user_profile: any })[] } | null> {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Get the user's membership to find their team_id
        const { data: myMembership, error: myError } = await supabase
            .from('team_members')
            .select(`
                *,
                teams:team_id (*)
            `)
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();

        if (myError || !myMembership) return null;

        const teamId = myMembership.team_id;

        // 2. Fetch all members of this team
        const { data: allMembers, error: membersError } = await supabase
            .from('team_members')
            .select('*')
            .eq('team_id', teamId);

        if (membersError) {
            console.error('Error fetching team members:', membersError);
            // Return just the team info if members fail (graceful degradation) or throw
            throw new Error('Failed to fetch team members');
        }

        // 3. Fetch profiles for these members
        // We need to map user_ids safely
        const userIds = allMembers.map(m => m.user_id);

        const { data: profiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('user_id, user_full_name, user_email, user_avatar_url')
            .in('user_id', userIds);

        if (profilesError) {
            console.error('Error fetching member profiles:', profilesError);
        }

        // 4. Combine data
        const membersWithProfiles = allMembers.map(member => {
            const profile = profiles?.find(p => p.user_id === member.user_id);
            return {
                ...member,
                user_profile: profile || null
            };
        });

        return {
            team: myMembership.teams,
            members: membersWithProfiles
        };
    },

    async updateMemberStatus(requesterId: string, memberId: string, newStatus: string, accessToken?: string): Promise<void> {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Check if requester is a leader of the same team as memberId
        // First get the member's team_id
        const { data: memberToUpdate, error: memberError } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('id', memberId)
            .single();

        if (memberError || !memberToUpdate) throw new Error('Member not found');

        // Check requester role
        const { data: requester, error: requesterError } = await supabase
            .from('team_members')
            .select('role')
            .eq('user_id', requesterId)
            .eq('team_id', memberToUpdate.team_id)
            .eq('status', 'active')
            .single();

        // Allow leader OR co-leader to update status (Approve)
        if (requesterError || !requester || !['leader', 'co-leader'].includes(requester.role)) {
            throw new Error('Unauthorized: Only active leaders or co-leaders can update member status');
        }

        // 2. Update status
        const { error: updateError } = await supabase
            .from('team_members')
            .update({ status: newStatus })
            .eq('id', memberId);

        if (updateError) throw new Error(`Failed to update member status: ${updateError.message}`);
    },

    async removeMember(requesterId: string, memberId: string, accessToken?: string): Promise<void> {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Get member info to find team_id and status
        const { data: memberToRemove, error: memberError } = await supabase
            .from('team_members')
            .select('team_id, status, role') // Select role to prevent removing leaders if needed, and status for co-leader check
            .eq('id', memberId)
            .single();

        if (memberError || !memberToRemove) throw new Error('Member not found');

        // 2. Check permission: Requester must be leader of that team
        const { data: requester, error: requesterError } = await supabase
            .from('team_members')
            .select('role')
            .eq('user_id', requesterId)
            .eq('team_id', memberToRemove.team_id)
            .eq('status', 'active')
            .single();

        if (requesterError || !requester) {
            throw new Error('Unauthorized: User not found or inactive');
        }

        // Permission Logic:
        // Leader: Can remove anyone (Pending or Active) - maybe restriction on removing other leaders? Assuming OK for now or user didn't specify.
        // Co-leader: Can remove ONLY 'pending' members (Reject). Cannot remove 'active' members.

        const isLeader = requester.role === 'leader';

        if (!isLeader) {
            throw new Error('Unauthorized: Only leaders can remove or reject members');
        }

        // Optional: Protect leaders from being removed by anyone other than themselves (or system admin)?
        // User request: "Target Leader: No action".
        // Implicitly means we shouldn't allow removing a leader via this API if the UI blocks it. 
        // Let's add a backend check to be safe: Cannot remove a leader.
        if (memberToRemove.role === 'leader') {
            throw new Error('Unauthorized: Cannot remove a Team Leader');
        }

        // 3. Delete
        const { error: deleteError } = await supabase
            .from('team_members')
            .delete()
            .eq('id', memberId);

        if (deleteError) throw new Error(`Failed to remove member: ${deleteError.message}`);
    },

    async updateMemberRole(requesterId: string, memberId: string, newRole: string, accessToken?: string): Promise<void> {
        const supabase = createClient(supabaseUrl, supabaseKey);

        if (!['leader', 'co-leader', 'member'].includes(newRole)) {
            throw new Error('Invalid role');
        }

        // 1. Get member info to find team_id
        const { data: memberToUpdate, error: memberError } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('id', memberId)
            .single();

        if (memberError || !memberToUpdate) throw new Error('Member not found');

        // 2. Check permission: Requester must be leader of that team
        const { data: requester, error: requesterError } = await supabase
            .from('team_members')
            .select('role')
            .eq('user_id', requesterId)
            .eq('team_id', memberToUpdate.team_id)
            .eq('status', 'active')
            .single();

        if (requesterError || !requester || requester.role !== 'leader') {
            throw new Error('Unauthorized: Only active leaders can update member roles.');
        }

        // 3. Update role
        const { error: updateError } = await supabase
            .from('team_members')
            .update({ role: newRole })
            .eq('id', memberId);

        if (updateError) throw new Error(`Failed to update member role: ${updateError.message}`);
    },

    async searchTeams(query: string) {
        const { data, error } = await supabase
            .from('teams')
            .select('team_id, team_name, team_code, owner_user_id') // Don't expose everything if not needed
            .ilike('team_name', `%${query}%`)
            .eq('status', 'active')
            .limit(10);

        if (error) throw error;
        return data;
    }
};
