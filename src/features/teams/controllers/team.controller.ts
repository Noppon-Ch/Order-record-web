import type { Request, Response } from 'express';
import { teamService } from '../services/team.service.js';

export const teamController = {
    async getTeamPage(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.redirect('/login');

            const userTeam = await teamService.getTeamByUserId(userId);

            res.render('team', {
                user: req.user,
                userTeam: userTeam,
                path: '/teams'
            });
        } catch (error) {
            console.error('Error fetching team page:', error);
            res.status(500).render('error', { message: 'Internal Server Error' });
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
