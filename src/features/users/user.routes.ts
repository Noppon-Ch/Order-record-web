import { Router } from 'express';
import { renderUserSetting } from './user.controller.js';

const router = Router();

router.get('/setting', renderUserSetting);

export default router;
