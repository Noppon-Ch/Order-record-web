import { createClient } from '@supabase/supabase-js';
import type { Order } from '../../models/orders.model.js';
import type { OrderItem } from '../../models/order_items.model.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

interface CreateOrderParams {
    order: Partial<Order>;
    items: Partial<OrderItem>[];
}

export class OrderService {

    async createOrder(params: CreateOrderParams, accessToken?: string) {
        const { order, items } = params;

        // console.log('[OrderService] Creating Supabase client');
        // Use normal client for creation to respect RLS on insert if needed, 
        // or service role if we want to bypass checks during creation (usually safe for backend created orders).
        // Let's stick to anon/access token for creation unless issues arise, 
        // but for fetching team data (getOrders), we will definitely use service role.
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
        // console.log('[OrderService] Order created:', orderId);

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
        // console.log('[OrderService] Fetching order by ID:', orderId);
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

    async getOrders(query: string = '', page: number = 1, pageSize: number = 10, accessToken?: string, filters?: { userId?: string, teamId?: string | null }) {
        // console.log('[OrderService] Fetching orders with query:', query);

        // Use authenticated client to leverage RLS policies for security
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        // Calculate pagination range
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        // If searching, we MUST use !inner to filter Orders by Customer fields
        const customerRelation = query
            ? 'customers:orders_order_customer_id_fkey!inner'
            : 'customers:orders_order_customer_id_fkey';

        let queryBuilder = supabase
            .from('orders')
            .select(`
                *,
                order_items(*),
                ${customerRelation} (
                    customer_fname_th,
                    customer_lname_th
                ),
                recommender:orders_order_recommender_id_fkey (
                    customer_fname_th,
                    customer_lname_th
                )
            `, { count: 'exact' })
            .order('order_date', { ascending: false })
            .range(from, to);

        // Apply Logic Filters
        if (filters) {
            if (filters.userId) {
                queryBuilder = queryBuilder.eq('order_record_by_user_id', filters.userId);
            }

            if (filters.teamId !== undefined) {
                if (filters.teamId === null) {
                    queryBuilder = queryBuilder.is('order_record_by_team_id', null);
                } else {
                    queryBuilder = queryBuilder.eq('order_record_by_team_id', filters.teamId);
                }
            }
        }

        // Apply filters if query exists
        if (query) {
            queryBuilder = queryBuilder.or(`customer_fname_th.ilike.%${query}%,customer_lname_th.ilike.%${query}%`, { foreignTable: 'customers' });
        }

        // Filter only 'f_order' or relevant types if needed, but for history usually all.

        const { data: orders, error, count } = await queryBuilder;

        if (error) {
            console.error('[OrderService] Error fetching orders:', error);
            throw new Error(`Failed to fetch orders: ${error.message}`);
        }

        // Fetch Recorder Profiles manually (since no direct FK to user_profiles)
        if (orders && orders.length > 0) {
            const userIds = [...new Set(orders.map(o => o.order_record_by_user_id).filter(id => id))];
            if (userIds.length > 0) {
                // Use the same client to fetch profiles
                const { data: profiles, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('user_id, user_full_name')
                    .in('user_id', userIds);

                if (!profileError && profiles) {
                    orders.forEach(order => {
                        const profile = profiles.find(p => p.user_id === order.order_record_by_user_id);
                        (order as any).recorder = profile || null;
                    });
                }
            }
        }

        return { data: orders, count };
    }


    async deleteOrder(orderId: string, accessToken?: string) {
        // console.log('[OrderService] Deleting order:', orderId);
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
