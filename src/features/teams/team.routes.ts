import { Router } from 'express';
import { teamController } from './controllers/team.controller.js';
import { isAuthenticated } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

// Middleware to ensure user is logged in
router.use(isAuthenticated);

import { requireTeamMembership, requireTeamRole } from './middlewares/team-auth.middleware.js';

router.get('/', teamController.getTeamPage);
router.get('/team-member-setting', teamController.getTeamMemberSettingPage);
router.post('/create', teamController.createTeam);
router.post('/join', teamController.joinTeam);

// Protected Team Actions
router.post('/approve', requireTeamMembership, requireTeamRole(['leader', 'co-leader']), teamController.approveMember);
router.post('/remove', requireTeamMembership, requireTeamRole(['leader', 'co-leader']), teamController.removeMember);
router.post('/update-role', requireTeamMembership, requireTeamRole(['leader']), teamController.updateMemberRole);
router.post('/leave', requireTeamMembership, teamController.leaveTeam);
router.post('/update-name', requireTeamMembership, requireTeamRole(['leader']), teamController.updateTeamName);
router.post('/update-description', requireTeamMembership, requireTeamRole(['leader']), teamController.updateTeamDescription);

router.get('/search', teamController.searchTeams);

export default router;
