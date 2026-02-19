import type { Request, Response } from 'express';
import { productService } from './product.service.js';

export class ProductController {

    // Normal Search
    async search(req: Request, res: Response) {
        try {
            const query = req.query.q as string;
            // console.log('[ProductController] Product Search Controller - Query:', query);

            // Extract access token for RLS
            // Prioritize Authorization header (for API retries), fallback to session
            let accessToken = (req.user as any)?.access_token;
            let tokenSource = 'Session';
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                accessToken = authHeader.split(' ')[1];
                tokenSource = 'Header';
            }
            if (req.path === '/search') {
                console.log(`[ProductController] Search Request. Token Source: ${tokenSource}. Has Token: ${!!accessToken}`);
            }

            const products = await productService.searchProducts(query, accessToken);
            // console.log('[ProductController] Products returned:', products?.length);

            res.json(products);
        } catch (error: any) {
            console.error('[ProductController] Error in product search:', error);
            // Return 401 for valid interceptor handling
            if (error?.message?.includes('JWT expired') || error?.code === 'PGRST303') {
                return res.status(401).json({ error: 'Token expired' });
            }
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
        } catch (error: any) {
            console.error('[ProductController] Error loading product list:', error);

            // Handle JWT Expiry for Page Load
            if (error?.message?.includes('JWT expired') || error?.code === 'PGRST303') {
                // Try to Refresh! (Seamless experience)
                const refreshToken = req.cookies?.refresh_token;
                if (refreshToken) {
                    try {
                        const { refreshSession } = await import('../auth/auth.service.js');
                        const { session, error: refreshError } = await refreshSession(refreshToken);

                        if (session && !refreshError) {
                            // Update Cookies
                            res.cookie('refresh_token', session.refresh_token, {
                                httpOnly: true,
                                secure: process.env.NODE_ENV === 'production',
                                sameSite: 'lax',
                                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
                            });

                            // Update user token
                            if (req.user) (req.user as any).access_token = session.access_token;

                            // RETRY Logic via Recursion?
                            // Since we don't have recursive structure here easily,
                            // simplest is redirect to same URL (reload) which will pick up new cookie?
                            // NO, access token is in memory/session. Reloading page might work if session is updated?
                            // Session store (Passport) needs update.
                            // But we updated cookie.
                            // Actually, simple redirect to current URL works because:
                            // Middleware runs -> deserializeUser -> checks session/token.
                            // BUT we rely on access token in SESSION, not cookie for access token.
                            // So we must redirect to /auth/refresh? Or just force re-login if too complex for now.
                            // Better: Redirect to login with flag.
                            return res.redirect('/login?session_expired=true');
                        }
                    } catch (e) { console.error(e); }
                }
                return res.redirect('/login?session_expired=true');
            }
            res.status(500).send('Error loading product list');
        }
    }
}

export const productController = new ProductController();
