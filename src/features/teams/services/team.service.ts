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
            // Rollback team creation if member addition fails
            await supabase.from('teams').delete().eq('team_id', team.team_id);
            throw new Error(`Failed to add leader: ${memberError.message}`);
        }

        // 3. Update existing customers: Assign this new team to customers created by this user
        // where team_id is currently null.
        const { error: updateCustomersError } = await supabase
            .from('customers')
            .update({ customer_record_by_team_id: team.team_id })
            .eq('customer_record_by_user_id', userId)
            .is('customer_record_by_team_id', null);

        if (updateCustomersError) {
            console.error('Error updating customer team association:', updateCustomersError);
            // We choose not to rollback the entire team creation for this non-critical failure,
            // but logging it is important.
        }

        // 4. Update existing orders: Assign this new team to orders created by this user
        // where team_id is currently null.
        const { error: updateOrdersError } = await supabase
            .from('orders')
            .update({ order_record_by_team_id: team.team_id })
            .eq('order_record_by_user_id', userId)
            .is('order_record_by_team_id', null);

        if (updateOrdersError) {
            console.error('Error updating order team association:', updateOrdersError);
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
        // Use authenticated client if token is provided to ensure RLS policies are applied correctly
        const supabase = accessToken
            ? createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
                global: { headers: { Authorization: `Bearer ${accessToken}` } }
            })
            : createClient(supabaseUrl, supabaseKey);

        // 1. Check if requester is a leader of the same team as memberId
        // First get the member's team_id AND user_id
        const { data: memberToUpdate, error: memberError } = await supabase
            .from('team_members')
            .select('team_id, user_id')
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

        // 3. PREPARE CLONING: fetch data BEFORE status update because RLS relies on member being 'pending'
        let clonesToInsert: any[] = [];
        if (newStatus === 'active') {
            console.log('[TeamService] Member approving. Fetching data for cloning...');

            // A. Fetch existing private customers
            const { data: customersToClone, error: fetchError } = await supabase
                .from('customers')
                .select('*')
                .eq('customer_record_by_user_id', memberToUpdate.user_id)
                .is('customer_record_by_team_id', null);

            if (fetchError) {
                console.error('[TeamService] Error fetching customers to clone:', fetchError);
            } else {
                console.log(`[TeamService] Found ${customersToClone?.length || 0} private customers to clone.`);
            }

            if (customersToClone && customersToClone.length > 0) {
                // B. Fetch existing citizen IDs in the team to prevent duplicates
                const { data: existingTeamCustomers, error: teamCustError } = await supabase
                    .from('customers')
                    .select('customer_citizen_id')
                    .eq('customer_record_by_team_id', memberToUpdate.team_id);

                if (teamCustError) console.error('[TeamService] Error fetching existing team customers:', teamCustError);

                const existingCitizenIds = new Set(existingTeamCustomers?.map(c => c.customer_citizen_id) || []);

                // C. Prepare clones
                clonesToInsert = customersToClone
                    .filter(c => !existingCitizenIds.has(c.customer_citizen_id))
                    .map(c => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { customer_id, customer_created_at, ...rest } = c;
                        return {
                            ...rest,
                            customer_record_by_team_id: memberToUpdate.team_id
                        };
                    });

                console.log(`[TeamService] Prepared ${clonesToInsert.length} clones.`);
            }
        }

        // 2. Update status
        const { error: updateError } = await supabase
            .from('team_members')
            .update({ status: newStatus })
            .eq('id', memberId);

        if (updateError) throw new Error(`Failed to update member status: ${updateError.message}`);

        // 4. EXECUTE CLONING
        if (newStatus === 'active' && clonesToInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('customers')
                .insert(clonesToInsert);

            if (insertError) {
                console.error('[TeamService] Error cloning customers to team:', insertError);
            } else {
                console.log('[TeamService] Cloning completed successfully.');
            }
        }
    },

    async removeMember(requesterId: string, memberId: string, accessToken?: string): Promise<void> {
        // Use authenticated client
        const supabase = accessToken
            ? createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
                global: { headers: { Authorization: `Bearer ${accessToken}` } }
            })
            : createClient(supabaseUrl, supabaseKey);

        // 1. Get member info to find team_id and status
        const { data: memberToRemove, error: memberError } = await supabase
            .from('team_members')
            .select('id, team_id, user_id, status, role')
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

        const isLeader = requester.role === 'leader';

        if (!isLeader) {
            throw new Error('Unauthorized: Only leaders can remove or reject members');
        }

        if (memberToRemove.role === 'leader') {
            // Redundant check if RLS `delete_team_members` handles it, but good for safety
            throw new Error('Unauthorized: Cannot remove a Team Leader');
        }

        // 3. CLONE PROCESS: Before removing, clone their team customers back to private
        // "customer_record_by_user_id = member_id" AND "customer_record_by_team_id = team_id"
        // -> clone to "customer_record_by_team_id = NULL"
        console.log(`[TeamService] Removing member ${memberToRemove.user_id}. Starting cloning process...`);

        const { data: teamCustomers, error: fetchError } = await supabase
            .from('customers')
            .select('*')
            .eq('customer_record_by_user_id', memberToRemove.user_id)
            .eq('customer_record_by_team_id', memberToRemove.team_id);

        if (fetchError) {
            console.error('[TeamService] Error fetching member customers to clone:', fetchError);
        } else if (teamCustomers && teamCustomers.length > 0) {
            console.log(`[TeamService] Found ${teamCustomers.length} customers to clone back to private.`);

            // Check duplicates in PRIVATE scope for this user
            const { data: existingPrivate, error: privateError } = await supabase
                .from('customers')
                .select('customer_citizen_id')
                .eq('customer_record_by_user_id', memberToRemove.user_id)
                .is('customer_record_by_team_id', null);

            if (privateError) console.error('[TeamService] Error fetching existing private customers:', privateError);

            const existingCitizenIds = new Set(existingPrivate?.map(c => c.customer_citizen_id) || []);

            const clones = teamCustomers
                .filter(c => !existingCitizenIds.has(c.customer_citizen_id))
                .map(c => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { customer_id, customer_created_at, ...rest } = c;
                    return {
                        ...rest,
                        customer_record_by_team_id: null
                    };
                });

            if (clones.length > 0) {
                const { error: insertError } = await supabase
                    .from('customers')
                    .insert(clones); // This relies on "leaders_create_private_customer_for_member" policy

                if (insertError) {
                    console.error('[TeamService] Error cloning customers back to private:', insertError);
                } else {
                    console.log(`[TeamService] Successfully cloned ${clones.length} customers back to private.`);
                }
            }
        }

        // 4. Delete membership
        const { error: deleteError } = await supabase
            .from('team_members')
            .delete()
            .eq('id', memberId);

        if (deleteError) throw new Error(`Failed to remove member: ${deleteError.message}`);
    },

    async updateMemberRole(requesterId: string, memberId: string, newRole: string, accessToken?: string): Promise<void> {
        const supabase = accessToken
            ? createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
                global: { headers: { Authorization: `Bearer ${accessToken}` } }
            })
            : createClient(supabaseUrl, supabaseKey);

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
    },

    async leaveTeam(userId: string, accessToken?: string): Promise<void> {
        const supabase = accessToken
            ? createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
                global: { headers: { Authorization: `Bearer ${accessToken}` } }
            })
            : createClient(supabaseUrl, supabaseKey);

        // 1. Get member info to find team_id
        const { data: membership, error: memberError } = await supabase
            .from('team_members')
            .select('id, team_id, role')
            .eq('user_id', userId)
            .maybeSingle();

        if (memberError || !membership) throw new Error('You are not in a team.');

        // 2. Clone Customers: "Copy team customers created by me -> to private customers"
        const { data: teamCustomers, error: fetchError } = await supabase
            .from('customers')
            .select('*')
            .eq('customer_record_by_user_id', userId)
            .eq('customer_record_by_team_id', membership.team_id);

        if (fetchError) {
            console.error('[TeamService] Error fetching customers to clone for leaving user:', fetchError);
        } else if (teamCustomers && teamCustomers.length > 0) {

            // Check duplicates in PRIVATE scope
            const { data: existingPrivate, error: privateError } = await supabase
                .from('customers')
                .select('customer_citizen_id')
                .eq('customer_record_by_user_id', userId)
                .is('customer_record_by_team_id', null);

            if (privateError) console.error('[TeamService] Error fetching existing private customers:', privateError);

            const existingCitizenIds = new Set(existingPrivate?.map(c => c.customer_citizen_id) || []);

            const clones = teamCustomers
                .filter(c => !existingCitizenIds.has(c.customer_citizen_id))
                .map(c => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { customer_id, customer_created_at, ...rest } = c;
                    return {
                        ...rest,
                        customer_record_by_team_id: null
                    };
                });

            if (clones.length > 0) {
                const { error: insertError } = await supabase
                    .from('customers')
                    .insert(clones); // Relies on "customers_private_insert"

                if (insertError) console.error('[TeamService] Error cloning customers for leaving user:', insertError);
            }
        }

        // 3. Delete membership
        const { error: deleteError } = await supabase
            .from('team_members')
            .delete()
            .eq('id', membership.id);

        if (deleteError) throw new Error(`Failed to leave team: ${deleteError.message}`);
    }
};
