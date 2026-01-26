import type { Request, Response } from 'express';
import { visualizationService } from './visualization.service.js';

export class VisualizationController {
    async getSummaryPage(req: Request, res: Response) {
        try {
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1; // 0-indexed to 1-indexed

            const year = req.query.year ? parseInt(req.query.year as string) : currentYear;
            const month = req.query.month ? parseInt(req.query.month as string) : currentMonth;


            console.log(`[VisualizationController] Requesting summary for Year: ${year}, Month: ${month}`);
            console.log(`[VisualizationController] User:`, req.user);

            // Get formatted data from service
            const scoreData = await visualizationService.getScoreSummary(year, month, (req.user as any)?.access_token);

            console.log(`[VisualizationController] Service returned ${scoreData.length} records.`);

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
}

export const visualizationController = new VisualizationController();
