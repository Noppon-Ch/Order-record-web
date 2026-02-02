import type { Request, Response } from 'express';
import { customerService } from '../customers/customer.service.js';
import { orderService } from './order.service.js';
import { teamService } from '../teams/services/team.service.js';

export class OrderController {

    // Show New Order Page
    async showNewOrderPage(req: Request, res: Response) {
        try {
            const customerId = req.query.customerId as string;
            let customer = null;
            let recommender = null;
            const accessToken = (req.user as any)?.access_token; // Extract access token

            if (customerId) {
                // Determine if it's citizen_id or UUID. 
                if (customerId.length === 13 && /^\d+$/.test(customerId)) {
                    customer = await customerService.findByCitizenId(customerId, accessToken);
                } else {
                    customer = await customerService.findById(customerId, accessToken);
                }

                // If customer has a referrer, fetch their details
                // Assuming customer_recommender_id holds the Citizen ID of the referrer
                if (customer && customer.customer_recommender_id) {
                    recommender = await customerService.findByCitizenId(customer.customer_recommender_id, accessToken);
                }
            }

            // Pass customer data to view if found
            res.render('first', {
                customer,
                recommender,
                user: req.user // Pass logged in user info if needed
            });
        } catch (error) {
            console.error('Error showing new order page:', error);
            // Show detailed error message
            res.status(500).render('error', {
                message: error instanceof Error ? error.message : 'Unknown error loading new order page'
            });
        }
    }

    // Show Continue Order Page (Type C)
    async showContinueOrderPage(req: Request, res: Response) {
        try {
            const customerId = req.query.customerId as string;
            let customer = null;
            let recommender = null;
            const accessToken = (req.user as any)?.access_token;

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
        } catch (error) {
            console.error('Error showing continue order page:', error);
            res.status(500).render('error', {
                message: error instanceof Error ? error.message : 'Unknown error loading continue order page'
            });
        }
    }

    // Show Finish Order Page
    // Show Finish Order Page
    async showFinishPage(req: Request, res: Response) {
        try {
            const customerId = req.query.customerId as string;
            const orderId = req.query.orderId as string;

            const accessToken = (req.user as any)?.access_token;

            let customer = null;
            let order = null;

            if (orderId) {
                order = await orderService.getOrderById(orderId, accessToken);
                if (order && order.order_customer_id) {
                    // Fetch customer from order
                    customer = await customerService.findById(order.order_customer_id, accessToken);
                }
            } else if (customerId) {
                // Fallback if only customer provided (less ideal for this new requirement)
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
                order, // Pass order to view
                user: req.user
            });
        } catch (error) {
            console.error('Error showing finish order page:', error);
            res.status(500).render('error', {
                message: error instanceof Error ? error.message : 'Unknown error loading finish order page'
            });
        }
    }
    // Create New Order
    async createOrder(req: Request, res: Response) {
        try {
            const { order, items } = req.body;
            const accessToken = (req.user as any)?.access_token;
            const userId = (req.user as any)?.id;

            console.log('[OrderController] Creating order for user:', userId);

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
        } catch (error) {
            console.error('[OrderController] Error creating order:', error);
            res.status(500).json({
                error: 'Failed to create order',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Show Order History Page
    async showHistoryPage(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const query = req.query.q as string || '';
            const accessToken = (req.user as any)?.access_token;

            const userTeam = await teamService.getTeamByUserId((req.user as any)?.id || '');
            const userContext: { userId: string, teamId?: string, role?: string } = {
                userId: (req.user as any)?.id || ''
            };
            if (userTeam?.team?.team_id) {
                userContext.teamId = userTeam.team.team_id;
            }

            const currentUserMember = userTeam?.members?.find(m => m.user_id === userContext.userId);
            if (currentUserMember?.role) {
                userContext.role = currentUserMember.role;
            }

            const { data: orders, count } = await orderService.getOrders(query, page, 10, accessToken, userContext);

            res.render('history', {
                orders: orders || [],
                currentPage: page,
                totalPages: Math.ceil((count || 0) / 10),
                query,
                user: req.user
            });
        } catch (error) {
            console.error('[OrderController] Error showing history page:', error);
            res.status(500).render('error', {
                message: error instanceof Error ? error.message : 'Unknown error loading history page'
            });
        }
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
        } catch (error) {
            console.error('[OrderController] Error deleting order:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error deleting order'
            });
        }
    }
}

export const orderController = new OrderController();
