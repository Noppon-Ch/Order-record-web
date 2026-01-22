import { Router } from 'express';
import { renderHomepage } from './homepage.controller.js';

import { isAuthenticated } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

router.get('/', isAuthenticated, renderHomepage);

export default router;