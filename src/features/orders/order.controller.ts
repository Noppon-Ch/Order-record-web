import type { Request, Response } from 'express';
import { customerService } from '../customers/customer.service.js';
import { orderService } from './order.service.js';
import { teamService } from '../teams/services/team.service.js';

export class OrderController {

    // Show New Order Page
    // Show New Order Page
    async showNewOrderPage(req: Request, res: Response) {
        const handleShowNewOrder = async (token: string, isRetry = false) => {
            try {
                const customerId = req.query.customerId as string;
                let customer = null;
                let recommender = null;
                // Use provided token or fallback to user token
                const accessToken = token || (req.user as any)?.access_token;

                if (customerId) {
                    if (customerId.length === 13 && /^\d+$/.test(customerId)) {
                        customer = await customerService.findByCitizenId(customerId, accessToken);
                    } else {
                        customer = await customerService.findById(customerId, accessToken);
                    }

                    if (customer && customer.customer_recommender_id) {
                        recommender = await customerService.findByCitizenId(customer.customer_recommender_id, accessToken);
                    }
                }

                res.render('first', {
                    customer,
                    recommender,
                    user: req.user
                });
            } catch (error: any) {
                console.error('Error showing new order page:', error);

                if ((error?.message?.includes('JWT expired') || error?.code === 'PGRST303') && !isRetry) {
                    const refreshToken = req.cookies?.refresh_token;
                    console.log('[ShowNewOrderPage] JWT Expired. Attempting Refresh.');

                    if (refreshToken) {
                        try {
                            const { refreshSession } = await import('../auth/auth.service.js');
                            const { session, error: refreshError } = await refreshSession(refreshToken);

                            if (session && !refreshError) {
                                console.log('[ShowNewOrderPage] Refresh Successful. Retrying...');
                                res.cookie('refresh_token', session.refresh_token, {
                                    httpOnly: true,
                                    secure: false, // process.env.NODE_ENV === 'production',
                                    sameSite: 'lax',
                                    maxAge: 30 * 24 * 60 * 60 * 1000
                                });

                                if (req.user) (req.user as any).access_token = session.access_token;
                                return handleShowNewOrder(session.access_token, true);
                            } else {
                                console.error('[ShowNewOrderPage] Refresh Failed:', refreshError);
                            }
                        } catch (e) {
                            console.error('[ShowNewOrderPage] Seamless Refresh failed:', e);
                        }
                    } else {
                        console.log('[ShowNewOrderPage] No Refresh Token Cookie found.');
                    }
                    return res.redirect('/login?session_expired=true');
                } else if (error?.message?.includes('JWT expired')) {
                    return res.redirect('/login?session_expired=true');
                }

                res.status(500).render('error', {
                    message: error instanceof Error ? error.message : 'Unknown error loading new order page'
                });
            }
        }
        await handleShowNewOrder((req.user as any)?.access_token);
    }

    // Show Continue Order Page (Type C)
    async showContinueOrderPage(req: Request, res: Response) {
        const handleShowContinue = async (token: string, isRetry = false) => {
            try {
                const customerId = req.query.customerId as string;
                let customer = null;
                let recommender = null;
                const accessToken = token || (req.user as any)?.access_token;

                if (customerId) {
                    if (customerId.length === 13 && /^\d+$/.test(customerId)) {
                        customer = await customerService.findByCitizenId(customerId, accessToken);
                    } else {
                        customer = await customerService.findById(customerId, accessToken);
                    }

                    if (customer && customer.customer_recommender_id) {
                        recommender = await customerService.findByCitizenId(customer.customer_recommender_id, accessToken);
                    }
                }

                res.render('continue', {
                    customer,
                    recommender,
                    user: req.user
                });
            } catch (error: any) {
                console.error('Error showing continue order page:', error);

                if ((error?.message?.includes('JWT expired') || error?.code === 'PGRST303') && !isRetry) {
                    const refreshToken = req.cookies?.refresh_token;
                    console.log('[ShowContinuePage] JWT Expired. Attempting Refresh.');
                    console.log('[ShowContinuePage] Cookie Refresh Token Present:', !!refreshToken);

                    if (refreshToken) {
                        try {
                            const { refreshSession } = await import('../auth/auth.service.js');
                            const { session, error: refreshError } = await refreshSession(refreshToken);

                            if (session && !refreshError) {
                                console.log('[ShowContinuePage] Refresh Successful. Retrying...');
                                res.cookie('refresh_token', session.refresh_token, {
                                    httpOnly: true,
                                    secure: false, // process.env.NODE_ENV === 'production',
                                    sameSite: 'lax',
                                    maxAge: 30 * 24 * 60 * 60 * 1000
                                });

                                if (req.user) (req.user as any).access_token = session.access_token;
                                return handleShowContinue(session.access_token, true);
                            } else {
                                console.error('[ShowContinuePage] Refresh Failed:', refreshError);
                            }
                        } catch (e) { console.error('[ShowContinuePage] Exception during refresh:', e); }
                    } else {
                        console.log('[ShowContinuePage] No Refresh Token Cookie found.');
                    }
                    return res.redirect('/login?session_expired=true');
                } else if (error?.message?.includes('JWT expired')) {
                    return res.redirect('/login?session_expired=true');
                }

                res.status(500).render('error', {
                    message: error instanceof Error ? error.message : 'Unknown error loading continue order page'
                });
            }
        }
        await handleShowContinue((req.user as any)?.access_token);
    }

    // Show Finish Order Page
    // Show Finish Order Page
    // Show Finish Order Page
    async showFinishPage(req: Request, res: Response) {
        const handleShowFinish = async (token: string, isRetry = false) => {
            try {
                const customerId = req.query.customerId as string;
                const orderId = req.query.orderId as string;

                const accessToken = token || (req.user as any)?.access_token;

                let customer = null;
                let order = null;

                if (orderId) {
                    order = await orderService.getOrderById(orderId, accessToken);
                    if (order && order.order_customer_id) {
                        customer = await customerService.findById(order.order_customer_id, accessToken);
                    }
                } else if (customerId) {
                    if (customerId.length === 13 && /^\d+$/.test(customerId)) {
                        customer = await customerService.findByCitizenId(customerId, accessToken);
                    } else {
                        customer = await customerService.findById(customerId, accessToken);
                    }
                }

                if (!customer) {
                    return res.status(404).render('error', { message: 'Customer data required for finish page' });
                }

                res.render('order-finish', {
                    customer,
                    order,
                    user: req.user
                });
            } catch (error: any) {
                console.error('Error showing finish order page:', error);

                if ((error?.message?.includes('JWT expired') || error?.code === 'PGRST303') && !isRetry) {
                    const refreshToken = req.cookies?.refresh_token;
                    console.log('[ShowFinishPage] JWT Expired. Attempting Refresh.');
                    console.log('[ShowFinishPage] Cookie Refresh Token Present:', !!refreshToken);

                    if (refreshToken) {
                        try {
                            const { refreshSession } = await import('../auth/auth.service.js');
                            const { session, error: refreshError } = await refreshSession(refreshToken);

                            if (session && !refreshError) {
                                console.log('[ShowFinishPage] Refresh Successful. Retrying...');
                                res.cookie('refresh_token', session.refresh_token, {
                                    httpOnly: true,
                                    secure: false, // process.env.NODE_ENV === 'production',
                                    sameSite: 'lax',
                                    maxAge: 30 * 24 * 60 * 60 * 1000
                                });

                                if (req.user) (req.user as any).access_token = session.access_token;
                                return handleShowFinish(session.access_token, true);
                            } else {
                                console.error('[ShowFinishPage] Refresh Failed:', refreshError);
                            }
                        } catch (e) { console.error('[ShowFinishPage] Exception during refresh:', e); }
                    } else {
                        console.log('[ShowFinishPage] No Refresh Token Cookie found.');
                    }
                    return res.redirect('/login?session_expired=true');
                } else if (error?.message?.includes('JWT expired')) {
                    return res.redirect('/login?session_expired=true');
                }

                res.status(500).render('error', {
                    message: error instanceof Error ? error.message : 'Unknown error loading finish order page'
                });
            }
        }
        await handleShowFinish((req.user as any)?.access_token);
    }
    // Create New Order
    async createOrder(req: Request, res: Response) {
        try {
            const { order, items } = req.body;
            let accessToken = (req.user as any)?.access_token;
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                accessToken = authHeader.split(' ')[1];
            }
            const userId = (req.user as any)?.id;

            // console.log('[OrderController] Creating order for user:', userId);

            // Add recorder info
            const orderData = {
                ...order,
                order_record_by_user_id: userId
            };

            const userTeam = await teamService.getTeamByUserId(userId);
            if (userTeam?.team) {
                (orderData as any).order_record_by_team_id = userTeam.team.team_id;
            }

            const newOrder = await orderService.createOrder({ order: orderData, items }, accessToken);

            res.status(201).json({ message: 'Order created successfully', orderId: newOrder.order_id });
        } catch (error: any) {
            console.error('[OrderController] Error creating order:', error);
            if (error?.message?.includes('JWT expired') || error?.code === 'PGRST303') {
                return res.status(401).json({ error: 'Token expired' });
            }
            res.status(500).json({
                error: 'Failed to create order',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Show Order History Page
    async showHistoryPage(req: Request, res: Response) {
        const handleShowHistory = async (token: string, isRetry = false) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const query = req.query.q as string || '';
                const accessToken = token || (req.user as any)?.access_token;
                const userId = (req.user as any)?.id;

                let filterTeamId: string | null = null;
                let filterUserId: string | undefined = userId;
                let userRole: string | null = null;

                const userTeamData = await teamService.getTeamByUserId(userId);

                if (userTeamData && userTeamData.team) {
                    const myMembership = userTeamData.members.find(m => m.user_id === userId);
                    if (myMembership && myMembership.status === 'active') {
                        filterTeamId = userTeamData.team.team_id;
                        userRole = myMembership.role;

                        if (['leader', 'co-leader'].includes(myMembership.role)) {
                            filterUserId = undefined;
                        } else {
                            filterUserId = userId;
                        }
                    }
                }

                const filters: { userId?: string, teamId?: string | null } = {
                    teamId: filterTeamId
                };
                if (filterUserId) {
                    filters.userId = filterUserId;
                }

                const itemsPerPage = 10;
                const { data: orders, count } = await orderService.getOrders(query, page, itemsPerPage, accessToken, filters);

                res.render('history', {
                    orders: orders || [],
                    currentPage: page,
                    totalPages: Math.ceil((count || 0) / itemsPerPage),
                    totalItems: count || 0,
                    query,
                    user: req.user,
                    userRole: userRole
                });
            } catch (error: any) {
                console.error('[OrderController] Error showing history page:', error);

                if ((error?.message?.includes('JWT expired') || error?.code === 'PGRST303') && !isRetry) {
                    const refreshToken = req.cookies?.refresh_token;
                    if (refreshToken) {
                        try {
                            const { refreshSession } = await import('../auth/auth.service.js');
                            const { session, error: refreshError } = await refreshSession(refreshToken);

                            if (session && !refreshError) {
                                res.cookie('refresh_token', session.refresh_token, {
                                    httpOnly: true,
                                    secure: process.env.NODE_ENV === 'production',
                                    sameSite: 'lax',
                                    maxAge: 30 * 24 * 60 * 60 * 1000
                                });

                                if (req.user) (req.user as any).access_token = session.access_token;
                                return handleShowHistory(session.access_token, true);
                            }
                        } catch (e) { console.error(e); }
                    }
                    return res.redirect('/login?session_expired=true');
                } else if (error?.message?.includes('JWT expired')) {
                    return res.redirect('/login?session_expired=true');
                }

                res.status(500).render('error', {
                    message: error instanceof Error ? error.message : 'Unknown error loading history page'
                });
            }
        }
        await handleShowHistory((req.user as any)?.access_token);
    }

    // Delete Order
    async deleteOrder(req: Request, res: Response) {
        try {
            const orderId = req.params.id;
            const accessToken = (req.user as any)?.access_token;

            if (typeof orderId !== 'string') {
                res.status(400).json({ success: false, message: 'Invalid order ID' });
                return;
            }

            await orderService.deleteOrder(orderId, accessToken);

            res.json({ success: true, message: 'Order deleted successfully' });
        } catch (error: any) {
            console.error('[OrderController] Error deleting order:', error);
            if (error?.message?.includes('JWT expired') || error?.code === 'PGRST303') {
                return res.status(401).json({ error: 'Token expired' });
            }
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error deleting order'
            });
        }
    }
}

export const orderController = new OrderController();
