import { createClient } from '@supabase/supabase-js';
import type { CreateCustomerDTO } from './customer.types.js';


const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;


export class CustomerService {
    async findByCitizenId(customer_citizen_id: string, accessToken?: string, userContext?: { userId?: string, teamId?: string }) {
        if (!customer_citizen_id) return null;
        // Use service role to look up citizens, applying manual scoping to handle duplicates (Private vs Team)
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

        let query = supabase
            .from('customers')
            .select('*')
            .eq('customer_citizen_id', customer_citizen_id);

        if (userContext?.teamId) {
            // Case 1: User is in a team -> Look for Team Record
            query = query.eq('customer_record_by_team_id', userContext.teamId);
        } else if (userContext?.userId) {
            // Case 2: User is NOT in a team -> Look for Private Record (Team is NULL)
            // ensuring we don't accidentally pick up a team record if the user joined one but context is missing (edge case)
            query = query
                .eq('customer_record_by_user_id', userContext.userId)
                .is('customer_record_by_team_id', null);
        }

        // Use limit(1) to avoid PGRST116 if multiple rows somehow exist despite scoping
        const { data, error } = await query.limit(1).maybeSingle();

        if (error) {
            console.error('Error finding customer by citizen ID:', error);
            // Don't throw database error to UI if it's just "not found" or similar query issue, 
            // but maybeSingle handles "not found" by returning null. 
            // Real errors (connection, syntax) should be thrown.
            throw new Error(`Database error: ${error.message}`);
        }
        return data;
    }

    async findById(customerId: string, accessToken?: string) {
        if (!customerId) return null;
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('customer_id', customerId)
            .single();

        if (error) {
            console.error('Error finding customer by ID:', error);
            throw new Error('Database error finding customer.');
        }
        return data;
    }

    async createCustomer(data: CreateCustomerDTO, accessToken?: string) {
        // Sanitize empty strings to null for optional fields (Postgres handles nulls better for non-constraints)
        const sanitizedData = Object.fromEntries(
            Object.entries(data).map(([key, value]) => [key, value === '' ? null : value])
        );

        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        const { data: customer, error } = await supabase
            .from('customers')
            .insert([sanitizedData])
            .select()
            .single();

        if (error) {
            console.error('Error creating customer:', error);
            if (error.code === '23505') { // Unique violation
                throw new Error('Customer with this Citizen ID already exists.');
            }
            throw new Error(error.message);
        }

        return customer;
    }

    async searchCustomers(query: string, accessToken?: string, userContext?: { userId: string, teamId?: string }) {
        if (!query) return [];
        // Use service role key to bypass RLS and allow scoped searching
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

        let queryBuilder = supabase
            .from('customers')
            .select('customer_id, customer_citizen_id, customer_fname_th, customer_lname_th')
            .or(`customer_citizen_id.ilike.%${query}%,customer_fname_th.ilike.%${query}%,customer_lname_th.ilike.%${query}%`)
            .limit(10);

        if (userContext?.teamId) {
            queryBuilder = queryBuilder.eq('customer_record_by_team_id', userContext.teamId);
        } else if (userContext?.userId) {
            queryBuilder = queryBuilder.eq('customer_record_by_user_id', userContext.userId)
                .is('customer_record_by_team_id', null);
        } else {
            return [];
        }

        const { data, error } = await queryBuilder;

        if (error) {
            console.error('Error searching customers:', error);
            throw new Error('Database error searching customers.');
        }

        return data;
    }

    async searchAddress(query: string, accessToken?: string) {
        if (!query) return [];
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        const { data, error } = await supabase
            .from('zipcode_th')
            .select('full_locate, zipcode')
            .ilike('full_locate', `%${query}%`)
            .limit(10);

        if (error) {
            console.error('Error searching address:', error);
            throw new Error('Database error searching address.');
        }

        return data;
    }

    async updateCustomer(customerId: string, data: Partial<CreateCustomerDTO>, accessToken?: string) {
        // Sanitize empty strings to null for optional fields
        const sanitizedData = Object.fromEntries(
            Object.entries(data).map(([key, value]) => [key, value === '' ? null : value])
        );

        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        const { data: customer, error } = await supabase
            .from('customers')
            .update(sanitizedData)
            .eq('customer_id', customerId)
            .select()
            .single();

        if (error) {
            console.error('Error updating customer:', error);
            throw new Error(error.message);
        }

        return customer;
    }

    async findAll(limit: number = 20, offset: number = 0, search?: string, accessToken?: string, userContext?: { userId: string, teamId?: string }) {
        // Use service role key to bypass potential RLS recursion issues
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

        let query = supabase
            .from('customers')
            .select('customer_id, customer_citizen_id, customer_fname_th, customer_lname_th, customer_phone, customer_position, customer_recommender_id, customer_registerdate')
            .range(offset, offset + limit - 1);

        // Team Scoping
        if (userContext?.teamId) {
            // New logic: Filter by team_id ONLY to show ALL team customers
            query = query.eq('customer_record_by_team_id', userContext.teamId);
        } else if (userContext?.userId) {
            query = query.eq('customer_record_by_user_id', userContext.userId)
                .is('customer_record_by_team_id', null);
        }

        if (search) {
            query = query.or(`customer_citizen_id.ilike.%${search}%,customer_fname_th.ilike.%${search}%,customer_lname_th.ilike.%${search}%`);
        }

        // Order by created_at desc to show newest first
        query = query.order('customer_created_at', { ascending: false });

        const { data: customers, error } = await query;

        if (error) {
            console.error('Error fetching customers:', error);
            throw new Error('Database error fetching customers.');
        }

        if (!customers || customers.length === 0) {
            return [];
        }

        // Fetch recommender names
        const recommenderIds = customers
            .map((c: any) => c.customer_recommender_id)
            .filter((id: string) => id && id.length > 0);

        const uniqueRecommenderIds = [...new Set(recommenderIds)];

        if (uniqueRecommenderIds.length > 0) {
            const { data: recommenders, error: recError } = await supabase
                .from('customers')
                .select('customer_citizen_id, customer_fname_th, customer_lname_th')
                .in('customer_citizen_id', uniqueRecommenderIds);

            if (!recError && recommenders) {
                const recommenderMap = new Map();
                recommenders.forEach((rec: any) => {
                    recommenderMap.set(rec.customer_citizen_id, `${rec.customer_fname_th} ${rec.customer_lname_th}`);
                });

                // Attach names
                return customers.map((c: any) => ({
                    ...c,
                    recommender_name: recommenderMap.get(c.customer_recommender_id) || '-'
                }));
            }
        }

        return customers.map((c: any) => ({
            ...c,
            recommender_name: '-'
        }));
    }

    async deleteCustomer(customerId: string, accessToken?: string) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('customer_id', customerId);

        if (error) {
            console.error('Error deleting customer:', error);
            throw new Error('Database error deleting customer.');
        }

        return true;
    }
}

export const customerService = new CustomerService();
