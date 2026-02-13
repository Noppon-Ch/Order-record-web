import type { Request, Response } from 'express';
import { visualizationService } from './visualization.service.js';

import { teamService } from '../teams/services/team.service.js';

export class VisualizationController {
    async getSummaryPage(req: Request, res: Response) {
        try {
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1; // 0-indexed to 1-indexed

            const year = req.query.year ? parseInt(req.query.year as string) : currentYear;
            const month = req.query.month ? parseInt(req.query.month as string) : currentMonth;


            // console.log(`[VisualizationController] Requesting summary for Year: ${year}, Month: ${month}`);
            // console.log(`[VisualizationController] User:`, req.user);

            const userId = (req.user as any)?.id || '';
            const accessToken = (req.user as any)?.access_token;
            console.log(`[VisualizationController] User ID: ${userId}`);
            console.log(`[VisualizationController] Access Token Present: ${!!accessToken}`);

            // Align with CustomerController: Do not pass accessToken to teamService
            const userTeam = await teamService.getTeamByUserId(userId);
            console.log(`[VisualizationController] Team Found:`, userTeam ? 'Yes' : 'No');

            const userContext: { userId: string, teamId?: string } = {
                userId: userId
            };

            if (userTeam?.team?.team_id) {
                // Only use team context if user is an ACTIVE member
                const memberRecord = userTeam.members.find(m => m.user_id === userId);
                if (memberRecord && memberRecord.status === 'active') {
                    userContext.teamId = userTeam.team.team_id;
                }
            }

            // Get formatted data from service
            const scoreData = await visualizationService.getScoreSummary(year, month, (req.user as any)?.access_token, userContext);

            // console.log(`[VisualizationController] Service returned ${scoreData.length} records.`);

            res.render('summary', {
                user: req.user,
                path: req.path,
                scoreData,
                filters: {
                    year,
                    month
                },
                flattenedList: scoreData // Pass explicitly if needed, though scoreData is already the list
            });
        } catch (error) {
            console.error('Error fetching score summary:', error);
            res.status(500).render('error', {
                message: 'Error loading score summary data.',
                error
            });
        }
    }

    async getOrganizationChartPage(req: Request, res: Response) {
        try {
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;

            const year = req.query.year ? parseInt(req.query.year as string) : currentYear;
            const month = req.query.month ? parseInt(req.query.month as string) : currentMonth;

            // console.log(`[VisualizationController] Requesting Org Chart for Year: ${year}, Month: ${month}`);

            const userId = (req.user as any)?.id || '';
            const accessToken = (req.user as any)?.access_token;
            // console.log(`[VisualizationController] OrgChart - User ID: ${userId}`);

            // Align with CustomerController
            const userTeam = await teamService.getTeamByUserId(userId);

            const userContext: { userId: string, teamId?: string } = {
                userId: userId
            };

            if (userTeam?.team?.team_id) {
                // Only use team context if user is an ACTIVE member
                const memberRecord = userTeam.members.find(m => m.user_id === userId);
                if (memberRecord && memberRecord.status === 'active') {
                    userContext.teamId = userTeam.team.team_id;
                }
            }

            const scoreData = await visualizationService.getScoreSummary(year, month, (req.user as any)?.access_token, userContext);
            // console.log(`[VisualizationController] Org Chart: Service returned ${scoreData.length} records.`);

            res.render('organization-chart', {
                user: req.user,
                path: req.path,
                scoreData,
                filters: {
                    year,
                    month
                }
            });
        } catch (error) {
            console.error('Error fetching org chart data:', error);
            res.status(500).render('error', {
                message: 'Error loading organization chart.',
                error
            });
        }
    }
}

export const visualizationController = new VisualizationController();
