import { Router } from 'express';
import { teamController } from './controllers/team.controller.js';
import { isAuthenticated } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

// Middleware to ensure user is logged in
router.use(isAuthenticated);

router.get('/', teamController.getTeamPage);
router.post('/create', teamController.createTeam);
router.post('/join', teamController.joinTeam);
router.get('/search', teamController.searchTeams);

export default router;
