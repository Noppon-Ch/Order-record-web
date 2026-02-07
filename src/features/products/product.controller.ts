import type { Request, Response } from 'express';
import { productService } from './product.service.js';

export class ProductController {

    // Normal Search
    async search(req: Request, res: Response) {
        try {
            const query = req.query.q as string;
            // console.log('[ProductController] Product Search Controller - Query:', query);

            // Extract access token for RLS
            const accessToken = (req.user as any)?.access_token;

            const products = await productService.searchProducts(query, accessToken);
            // console.log('[ProductController] Products returned:', products?.length);

            res.json(products);
        } catch (error) {
            console.error('[ProductController] Error in product search:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Debug Search
    async debug(req: Request, res: Response) {
        try {
            const query = req.query.q as string || '';
            const accessToken = (req.user as any)?.access_token;
            // console.log('[ProductController] Debug Product Search - Query:', query);

            // Search with token
            const products = await productService.searchProducts(query, accessToken);

            // Count total (system check, using fresh client might bypass RLS if using service role, 
            // but we only have ANON key here usually. 
            // Ideally we should use the same token to see what the USER sees)
            const { createClient } = require('@supabase/supabase-js');
            // If we want to check "Does the table have data AT ALL?", we might need service key, 
            // but let's stick to anon + token if possible, or just anon.
            // Actually, if RLS is on, anon key without token = 0 rows.

            const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!,
                accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : undefined
            );

            const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true });

            res.json({
                message: 'Debug Info',
                searchQuery: query,
                isAuthenticated: !!accessToken,
                foundInSearch: products.length,
                totalInTable: count,
                searchError: null,
                countError: error,
                firstMatch: products[0]
            });
        } catch (error) {
            console.error('[ProductController] Debug Error:', error);
            res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
        }
    }

    // Product List Page
    async listPage(req: Request, res: Response) {
        try {
            const query = req.query.search as string || '';
            const page = parseInt(req.query.page as string) || 1;
            const limit = 20; // Items per page
            const offset = (page - 1) * limit;
            const accessToken = (req.user as any)?.access_token;

            // console.log(`[ProductController] Listing products page:${page} query:${query}`);
            const { products, total } = await productService.listProducts(query, limit, offset, accessToken);

            res.render('product_list', {
                products,
                searchQuery: query,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                user: req.user,
                path: req.path
            });
        } catch (error) {
            console.error('[ProductController] Error loading product list:', error);
            res.status(500).send('Error loading product list');
        }
    }
}

export const productController = new ProductController();
