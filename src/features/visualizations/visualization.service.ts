import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export interface ScoreNode {
    customer_id: string;
    customer_citizen_id: string; // Used for linking recommender
    customer_name: string;
    customer_position: string | null;
    recommender_id: string | null;
    customer_recommender_name?: string;
    customer_registerdate?: string;
    tree_level: number;
    self_private_score: number;
    total_score: number;
    children: ScoreNode[];
}

export class VisualizationService {

    async getScoreSummary(year: number, month: number, accessToken?: string) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        // console.log(`[VisualizationService] 1. Fetching customers...`);

        // 1. Fetch all customers
        // We need all customers to build the full tree
        const { data: customers, error: customerError } = await supabase
            .from('customers')
            .select('customer_id, customer_citizen_id, customer_fname_th, customer_lname_th, customer_position, customer_recommender_id, customer_registerdate');

        if (customerError) {
            console.error(`[VisualizationService] Error fetching customers:`, customerError);
            throw new Error(`Error fetching customers: ${customerError.message}`);
        }
        // console.log(`[VisualizationService] Fetched ${customers?.length || 0} customers.`);
        if (!customers) return [];

        // 2. Fetch orders for the specific month/year
        // Calculate date range
        const startDate = new Date(year, month - 1, 1).toISOString();
        const endDate = new Date(year, month, 0, 23, 59, 59).toISOString(); // Last day of month

        // console.log(`[VisualizationService] 2. Date Range: ${startDate} to ${endDate}`);
        // console.log(`[VisualizationService] Fetching orders...`);

        const { data: orders, error: orderError } = await supabase
            .from('orders')
            .select('order_customer_id, order_total_amount')
            .gte('order_date', startDate)
            .lte('order_date', endDate);

        if (orderError) {
            console.error(`[VisualizationService] Error fetching orders:`, orderError);
            throw new Error(`Error fetching orders: ${orderError.message}`);
        }

        // console.log(`[VisualizationService] Fetched ${orders?.length || 0} orders.`);


        // 3. Aggregate Orders by Customer
        const customerScores = new Map<string, number>();
        orders?.forEach(order => {
            const currentScore = customerScores.get(order.order_customer_id) || 0;
            // 1 Baht = 1 Point. Stored as Satang (Integer) in DB.
            // So order_total_amount / 100 = Points.
            const points = (order.order_total_amount || 0) / 100;
            customerScores.set(order.order_customer_id, currentScore + points);
        });

        // console.log(`[VisualizationService] 3. Aggregated scores for ${customerScores.size} unique customers.`);

        // 4. Build Tree
        const customerMap = new Map<string, ScoreNode>();

        // Initialize nodes
        customers.forEach(c => {
            customerMap.set(c.customer_citizen_id, {
                customer_id: c.customer_id,
                customer_citizen_id: c.customer_citizen_id,
                customer_name: `${c.customer_fname_th || ''} ${c.customer_lname_th || ''}`.trim(),
                customer_position: c.customer_position || '-',
                recommender_id: c.customer_recommender_id,
                customer_registerdate: c.customer_registerdate,
                tree_level: 1, // Default to 1
                self_private_score: customerScores.get(c.customer_id) || 0,
                total_score: 0, // Will calculate later
                children: []
            });
        });

        const rootNodes: ScoreNode[] = [];

        // Link parent-child
        customerMap.forEach(node => {
            if (node.recommender_id && customerMap.has(node.recommender_id)) {
                // Has valid parent in the list
                const parent = customerMap.get(node.recommender_id)!;
                parent.children.push(node);
                node.customer_recommender_name = parent.customer_name;
            } else {
                // No parent, or parent not found -> Root node
                rootNodes.push(node);
            }
        });

        // 5. Calculate Total Scores & Assign Levels (Recursive)
        const calculateScoresAndLevels = (node: ScoreNode, level: number): number => {
            node.tree_level = level;

            let childrenScore = 0;
            node.children.forEach(child => {
                childrenScore += calculateScoresAndLevels(child, level + 1);
            });

            node.total_score = node.self_private_score + childrenScore;
            return node.total_score;
        };

        rootNodes.forEach(node => calculateScoresAndLevels(node, 1));

        // 6. Flatten for Table Display (DFS)
        const flattenedList: ScoreNode[] = [];
        const flatten = (node: ScoreNode) => {
            flattenedList.push(node);
            node.children.forEach(child => flatten(child));
        };

        rootNodes.forEach(node => flatten(node));



        // console.log(`[VisualizationService] 5. Returning ${flattenedList.length} flattened nodes.`);

        return flattenedList;
    }
}

export const visualizationService = new VisualizationService();
