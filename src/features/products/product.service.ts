import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export interface Product {
    product_code: string;
    product_name_th: string;
    product_name_en: string;
    price_per_unit: number;
    color_th: string;
    product_size: string; // ต้องตรงกับ schema
}

export class ProductService {
    async searchProducts(query: string, accessToken?: string) {
        if (!query) {
            // console.log('[ProductService] No query provided');
            return [];
        }
        // console.log('[ProductService] Creating Supabase client');
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        // Log environment variables (mask key)
        // console.log('[ProductService] SUPABASE_URL:', supabaseUrl);
        // console.log('[ProductService] SUPABASE_ANON_KEY:', supabaseAnonKey ? supabaseAnonKey.slice(0, 6) + '...' : 'undefined');

        // Use only columns that exist in the table
        const selectColumns = 'product_code, product_name_th, product_name_en, price_per_unit, color_th, product_size';
        // console.log('[ProductService] Selecting columns:', selectColumns);

        // Use only product_code.ilike.${query}% for starts-with search
        const filter = `product_code.ilike.${query}%`;
        // console.log('[ProductService] Using filter:', filter);

        // Log equivalent SQL for debugging
        // console.log(`[ProductService] Equivalent SQL: select ${selectColumns} from products where product_code ilike '${query}%' limit 10;`);

        const { data, error, status, statusText } = await supabase
            .from('products')
            .select(selectColumns)
            .filter('product_code', 'ilike', `${query}%`)
            .limit(10);

        // Log raw response for debugging
        // console.log('[ProductService] Supabase response:', { data, error, status, statusText });

        if (error) {
            console.error('[ProductService] Error searching products:', error);
            throw new Error('Database error searching products.');
        }

        // console.log(`[ProductService] Found ${data?.length || 0} products`);
        if (data && data.length > 0) {
            // console.log('[ProductService] First product:', data[0]);
        }
        return data;
    }

    async listProducts(query: string, limit: number, offset: number, accessToken?: string) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        const selectColumns = `
            product_code, product_name_th, color_th, product_size, price_per_unit,
            under_bust, top_bust, waist_min, waist_max, hip_min, hip_max, 
            bust_min, bust_max, hight_min, hight_max
        `;

        let queryBuilder = supabase.from('products').select(selectColumns, { count: 'exact' });

        if (query) {
            queryBuilder = queryBuilder.or(`product_code.ilike.${query}%,product_name_th.ilike.%${query}%`);
        } else {
            // Default sort if no query
            queryBuilder = queryBuilder.order('product_code', { ascending: true });
        }

        const { data, count, error } = await queryBuilder
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('[ProductService] Error listing products:', error);
            throw new Error('Database error listing products.');
        }

        return { products: data || [], total: count || 0 };
    }
}

export const productService = new ProductService();
