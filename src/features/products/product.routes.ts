import { Router } from 'express';
import { ProductController } from './product.controller.js';
import { isAuthenticated } from '../../shared/middlewares/auth.middleware.js';
import type { RequestHandler } from 'express';

const router = Router();

const productController = new ProductController();

router.get(
  '/debug',
  productController.debug.bind(productController) as unknown as RequestHandler
);
router.get('/search', isAuthenticated, productController.search.bind(productController));

export default router;
