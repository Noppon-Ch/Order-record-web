import type { Request, Response } from 'express';
import { customerService } from '../customers/customer.service.js';

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
            res.render('new', {
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
}

export const orderController = new OrderController();
