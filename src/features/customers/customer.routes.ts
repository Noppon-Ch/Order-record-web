import { Router } from 'express';
import { customerController } from './customer.controller.js';
import { customerPdfController } from './customer-pdf.controller.js';
import { isAuthenticated } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

// Show add customer form
router.get('/add-new-customer', isAuthenticated, customerController.showAddForm.bind(customerController));

// Show finish page
router.get('/add/finish/:customerId', isAuthenticated, customerController.showFinishPage.bind(customerController));

// Handle add customer POST
router.get('/search', isAuthenticated, customerController.search.bind(customerController));
router.get('/search-address', isAuthenticated, customerController.searchAddress.bind(customerController));
router.get('/api/:customerId', isAuthenticated, customerController.getCustomerDetails.bind(customerController));
router.post('/', isAuthenticated, customerController.addCustomer.bind(customerController));

// Old customer routes
router.get('/add-old-customer', isAuthenticated, customerController.showAddOldCustomerForm.bind(customerController));
router.post('/add-old-customer', isAuthenticated, customerController.addOldCustomer.bind(customerController));

// Edit customer
router.get('/edit/:customerId', isAuthenticated, customerController.showEditForm.bind(customerController));
router.post('/edit/:customerId', isAuthenticated, customerController.updateCustomer.bind(customerController));

// List customers
router.get('/list', isAuthenticated, customerController.listCustomers.bind(customerController));
router.post('/delete/:customerId', isAuthenticated, customerController.deleteCustomer.bind(customerController));

// PDF Download
router.get('/:customerId/pdf', isAuthenticated, customerPdfController.download.bind(customerPdfController));

export default router;
