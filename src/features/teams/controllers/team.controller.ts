import type { Request, Response } from 'express';
import { teamService } from '../services/team.service.js';

export const teamController = {
    async getTeamPage(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.redirect('/login');

            console.log('[TeamController] getTeamPage userId:', userId);
            const accessToken = (req.user as any)?.access_token;
            const teamData = await teamService.getTeamByUserId(userId, accessToken);
            console.log('[TeamController] teamData:', JSON.stringify(teamData, null, 2));

            // If user has a team, extract their personal membership info
            let myMembership = null;
            if (teamData && teamData.members) {
                myMembership = teamData.members.find(m => m.user_id === userId);
            }

            // Filter logic:
            // 1. If myMembership.status is 'pending', only show myself.
            // 2. If 'active', show everyone.
            let visibleMembers = teamData?.members || [];
            if (myMembership && myMembership.status === 'pending') {
                visibleMembers = teamData?.members.filter(m => m.user_id === userId) || [];
            }

            res.render('team', {
                user: req.user,
                team: teamData?.team,
                members: visibleMembers,
                myMembership: myMembership,
                path: '/teams'
            });
        } catch (error) {
            console.error('Error fetching team page:', error);
            res.status(500).render('error', { message: 'Internal Server Error' });
        }
    },

    async approveMember(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            const { memberId } = req.body;

            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            if (!memberId) return res.status(400).json({ success: false, message: 'Member ID is required' });

            await teamService.updateMemberStatus(userId, memberId, 'active', (req.user as any)?.access_token);
            res.json({ success: true, message: 'Member approved successfully' });
        } catch (error: any) {
            console.error('Error approving member:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async removeMember(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            const { memberId } = req.body;

            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            if (!memberId) return res.status(400).json({ success: false, message: 'Member ID is required' });

            await teamService.removeMember(userId, memberId, (req.user as any)?.access_token);
            res.json({ success: true, message: 'Member removed successfully' });
        } catch (error: any) {
            console.error('Error removing member:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async updateMemberRole(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            const { memberId, newRole } = req.body;

            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            if (!memberId || !newRole) return res.status(400).json({ success: false, message: 'Member ID and New Role are required' });

            await teamService.updateMemberRole(userId, memberId, newRole, (req.user as any)?.access_token);
            res.json({ success: true, message: 'Member role updated successfully' });
        } catch (error: any) {
            console.error('Error updating member role:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async createTeam(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            const { teamName } = req.body;

            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            if (!teamName) return res.status(400).json({ success: false, message: 'Team Name is required' });

            await teamService.createTeam(userId, teamName, (req.user as any)?.access_token);
            res.json({ success: true, message: 'Team created successfully' });
        } catch (error: any) {
            console.error('Error creating team:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async joinTeam(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            const { teamCode } = req.body;

            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            if (!teamCode) return res.status(400).json({ success: false, message: 'Team Code is required' });

            await teamService.joinTeam(userId, teamCode, (req.user as any)?.access_token);
            res.json({ success: true, message: 'Request to join team sent successfully' });
        } catch (error: any) {
            console.error('Error joining team:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async searchTeams(req: Request, res: Response) {
        try {
            const { query } = req.query;
            if (!query || typeof query !== 'string') return res.json({ teams: [] });

            const teams = await teamService.searchTeams(query);
            res.json({ teams });
        } catch (error) {
            console.error('Error searching teams:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};
