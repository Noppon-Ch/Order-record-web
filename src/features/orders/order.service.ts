import { createClient } from '@supabase/supabase-js';
import type { Order } from '../../models/orders.model.js';
import type { OrderItem } from '../../models/order_items.model.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

interface CreateOrderParams {
    order: Partial<Order>;
    items: Partial<OrderItem>[];
}

export class OrderService {

    async createOrder(params: CreateOrderParams, accessToken?: string) {
        const { order, items } = params;

        console.log('[OrderService] Creating Supabase client');
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        // 1. Insert Order
        // Force order_type to 'f_order' as requested
        // Convert currency fields to Satang (Integer)
        const orderData = {
            ...order,
            order_total_amount: Math.round((order.order_total_amount || 0) * 100),
            order_discount: Math.round((order.order_discount || 0) * 100),
            order_price_before_tax: Math.round((order.order_price_before_tax || 0) * 100),
            order_tax: Math.round((order.order_tax || 0) * 100),
            order_final_price: Math.round((order.order_final_price || 0) * 100),
            order_type: order.order_type || 'f_order',
            order_created_at: new Date().toISOString()
        };

        const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert(orderData)
            .select()
            .single();

        if (orderError) {
            console.error('[OrderService] Error creating order:', orderError);
            throw new Error(`Failed to create order: ${orderError.message}`);
        }

        if (!newOrder) {
            throw new Error('Order creation failed: No data returned');
        }

        const orderId = newOrder.order_id;
        console.log('[OrderService] Order created:', orderId);

        // 2. Insert Order Items
        if (items && items.length > 0) {
            const itemsData = items.map(item => ({
                ...item,
                product_price: Math.round((item.product_price || 0) * 100), // Convert to Satang
                order_id: orderId,
                created_at: new Date().toISOString()
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(itemsData);

            if (itemsError) {
                console.error('[OrderService] Error creating order items:', itemsError);
                // Note: In a real production app with raw SQL or RPC, we'd roll back the order here.
                // With client-side chaining, we run the risk of orphaned orders if items fail.
                // For now, we verify items before sending or accept this risk for the MVP.
                throw new Error(`Failed to create order items: ${itemsError.message}`);
            }
        }

        return newOrder;
    }

    async getOrderById(orderId: string, accessToken?: string) {
        console.log('[OrderService] Fetching order by ID:', orderId);
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('order_id', orderId)
            .single();

        if (error) {
            console.error('[OrderService] Error fetching order:', error);
            return null;
        }

        return order;
    }

    async getOrders(query: string = '', page: number = 1, pageSize: number = 10, accessToken?: string) {
        console.log('[OrderService] Fetching orders with query:', query);
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        // Calculate pagination range
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let queryBuilder = supabase
            .from('orders')
            .select(`
                *,
                order_items(*),
                customers:orders_order_customer_id_fkey (
                    customer_fname_th,
                    customer_lname_th
                ),
                recommender:orders_order_recommender_id_fkey (
                    customer_fname_th,
                    customer_lname_th
                )
            `, { count: 'exact' })
            .range(from, to)
            .order('order_date', { ascending: false });

        // Apply filters if query exists
        if (query) {
            // Note: Searching on joined text column might be tricky in Supabase basic filtering
            // For now, simpler filtering on order fields or exact matches.
            // Or use Full Text Search if setup.
            // Let's try to filter by customer name if possible, but standard 'ilike' on joined column needs specific syntax or not supported directly easily without embedding.
            // For MVP, likely filtering by order_type or known ID. 
            // If user searches name, we might need a separate RPC or more complex query.
            // Let's implement basics first.
            // Or filter by available text columns if any. 
        }

        // Filter only 'f_order' or relevant types if needed, but for history usually all.

        const { data, error, count } = await queryBuilder;

        if (error) {
            console.error('[OrderService] Error fetching orders:', error);
            throw new Error(`Failed to fetch orders: ${error.message}`);
        }

        return { data, count };
    }


    async deleteOrder(orderId: string, accessToken?: string) {
        console.log('[OrderService] Deleting order:', orderId);
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        // Delete order items first
        await supabase.from('order_items').delete().eq('order_id', orderId);

        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('order_id', orderId);

        if (error) {
            console.error('[OrderService] Error deleting order:', error);
            throw new Error(`Failed to delete order: ${error.message}`);
        }
    }

    async getOrderItems(orderId: string, accessToken?: string) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        const { data, error } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', orderId);

        if (error) {
            console.error('[OrderService] Error fetching order items:', error);
            return [];
        }
        return data;
    }
}

export const orderService = new OrderService();
