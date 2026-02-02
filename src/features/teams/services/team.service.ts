import { createClient } from '@supabase/supabase-js';
import type { Team } from '../../../models/team.model.js';
import type { TeamMember } from '../../../models/team_member.model.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const teamService = {
    async createTeam(userId: string, teamName: string, accessToken?: string): Promise<Team> {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

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
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

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

    async getTeamByUserId(userId: string, accessToken?: string): Promise<{ team: Team, member: TeamMember } | null> {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        const { data: member, error } = await supabase
            .from('team_members')
            .select(`
                *,
                teams:team_id (*)
            `)
            .eq('user_id', userId)
            .maybeSingle();

        if (error || !member) return null;

        console.log('--- Team Data Debug ---');
        console.log('Member Status:', member.status);
        console.log('Member Role:', member.role);
        console.log('Team Name:', member.teams?.team_name);
        console.log('Full Query Result:', JSON.stringify(member, null, 2));
        console.log('-----------------------');

        return {
            member: {
                id: member.id,
                team_id: member.team_id,
                user_id: member.user_id,
                role: member.role,
                status: member.status,
                joined_at: member.joined_at
            },
            team: member.teams // Supabase joins return the joined data on the key
        };
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
