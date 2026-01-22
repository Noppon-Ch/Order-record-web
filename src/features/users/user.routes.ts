import { Router } from 'express';
import { renderUserSetting, updateUserSetting } from './user.controller.js';
import express from 'express';

import { isAuthenticated } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

// Middleware to parse form data
router.use(express.urlencoded({ extended: true }));

// Protect all user routes
router.use(isAuthenticated);

router.get('/setting', renderUserSetting);
router.post('/setting', updateUserSetting);

export default router;
