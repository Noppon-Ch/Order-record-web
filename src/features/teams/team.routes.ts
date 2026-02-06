import { Router } from 'express';
import { teamController } from './controllers/team.controller.js';
import { isAuthenticated } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

// Middleware to ensure user is logged in
router.use(isAuthenticated);

router.get('/', teamController.getTeamPage);
router.post('/create', teamController.createTeam);
router.post('/join', teamController.joinTeam);
router.post('/approve', teamController.approveMember);
router.post('/remove', teamController.removeMember);
router.post('/update-role', teamController.updateMemberRole);
router.post('/leave', teamController.leaveTeam);
router.post('/update-name', teamController.updateTeamName);
router.post('/update-description', teamController.updateTeamDescription);
router.get('/search', teamController.searchTeams);

export default router;
