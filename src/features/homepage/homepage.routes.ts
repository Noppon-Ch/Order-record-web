import { Router } from 'express';
import { renderHomepage } from './homepage.controller.js';

const router = Router();

router.get('/', renderHomepage);

export default router;