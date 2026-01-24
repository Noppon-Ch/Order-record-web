import { Router } from 'express';
import { orderController } from './order.controller.js';
import { isAuthenticated } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

router.get('/new', isAuthenticated, orderController.showNewOrderPage.bind(orderController));
router.get('/continue', isAuthenticated, orderController.showContinueOrderPage.bind(orderController));
router.post('/create', isAuthenticated, orderController.createOrder.bind(orderController));
router.get('/history', isAuthenticated, orderController.showHistoryPage.bind(orderController));
router.delete('/:id', isAuthenticated, orderController.deleteOrder.bind(orderController));

export default router;
