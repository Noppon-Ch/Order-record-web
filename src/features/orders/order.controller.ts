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
            const userId = (req.user as any)?.id;

            // Determine if user is in a team (Active) to switch display mode
            let filterTeamId: string | null = null; // Default: Not in team (or pending) -> Filter by NULL team_id
            let filterUserId: string | undefined = userId; // Default: Filter by current user
            let userRole: string | null = null;

            // Check team status
            // Note: This fetches full members list, might be heavy if team is huge, 
            // but for MVP/SME scale it's fine.
            const userTeamData = await teamService.getTeamByUserId(userId);

            if (userTeamData && userTeamData.team) {
                // Check if *this* user is active in the team
                const myMembership = userTeamData.members.find(m => m.user_id === userId);
                if (myMembership && myMembership.status === 'active') {
                    // Context: User IS active in a team
                    filterTeamId = userTeamData.team.team_id;
                    userRole = myMembership.role;

                    // Check Role
                    if (['leader', 'co-leader'].includes(myMembership.role)) {
                        // Leaders/Co-leaders can see ALL orders in the team
                        // So we REMOVE the userId filter
                        filterUserId = undefined;
                        // Note: Ensure RLS allows this (it should if policies are correct)
                    } else {
                        // Members see only THEIR OWN orders in the team
                        filterUserId = userId;
                    }
                }
            }

            // If user is not active in team (filterTeamId stays null), filterUserId stays userId.

            const filters: { userId?: string, teamId?: string | null } = {
                teamId: filterTeamId
            };
            if (filterUserId) {
                filters.userId = filterUserId;
            }

            const { data: orders, count } = await orderService.getOrders(query, page, 10, accessToken, filters);

            res.render('history', {
                orders: orders || [],
                currentPage: page,
                totalPages: Math.ceil((count || 0) / 10),
                query,
                user: req.user,
                userRole: userRole
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
