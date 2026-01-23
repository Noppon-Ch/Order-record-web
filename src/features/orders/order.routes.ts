import { Router } from 'express';
import { orderController } from './order.controller.js';
import { isAuthenticated } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

router.get('/new', isAuthenticated, orderController.showNewOrderPage.bind(orderController));

export default router;
