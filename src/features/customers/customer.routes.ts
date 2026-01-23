import { Router } from 'express';
import { customerController } from './customer.controller.js';
import { isAuthenticated } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

// Show add customer form
router.get('/add', isAuthenticated, customerController.showAddForm.bind(customerController));

// Show finish page
router.get('/add/finish/:customerId', isAuthenticated, customerController.showFinishPage.bind(customerController));

// Handle add customer POST
router.get('/search', isAuthenticated, customerController.search.bind(customerController));
router.post('/', isAuthenticated, customerController.addCustomer.bind(customerController));

export default router;
