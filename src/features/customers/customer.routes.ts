import { Router } from 'express';
import { customerController } from './customer.controller.js';
import { isAuthenticated } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

// Show add customer form
router.get('/add', isAuthenticated, customerController.showAddForm.bind(customerController));

// Handle add customer POST
router.post('/', isAuthenticated, customerController.addCustomer.bind(customerController));

export default router;
