import { Router } from 'express';
import { orderController } from './order.controller.js';
import { firstOrderPdfController } from './first-order-pdf.controller.js';
import { continueOrderPdfController } from './continue-order-pdf.controller.js';
import { isAuthenticated } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

router.get('/first', isAuthenticated, orderController.showNewOrderPage.bind(orderController));
router.get('/continue', isAuthenticated, orderController.showContinueOrderPage.bind(orderController));
router.post('/create', isAuthenticated, orderController.createOrder.bind(orderController));
router.get('/finish', isAuthenticated, orderController.showFinishPage.bind(orderController));
// Mount PDF generation route
router.get('/:orderId/pdf', isAuthenticated, firstOrderPdfController.download.bind(firstOrderPdfController)); // Default or First
router.get('/:orderId/continue-pdf', isAuthenticated, continueOrderPdfController.download.bind(continueOrderPdfController));

router.get('/history', isAuthenticated, orderController.showHistoryPage.bind(orderController));
router.delete('/:id', isAuthenticated, orderController.deleteOrder.bind(orderController));

export default router;
