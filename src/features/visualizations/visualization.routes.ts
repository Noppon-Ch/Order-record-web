import { Router } from 'express';
import { visualizationController } from './visualization.controller.js';
import { isAuthenticated } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

// Protect all visualization routes
router.use(isAuthenticated);

router.get('/summary', visualizationController.getSummaryPage);
router.get('/organization-chart', visualizationController.getOrganizationChartPage);

export const visualizationRoutes = router;
