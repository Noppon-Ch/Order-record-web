import { createClient } from '@supabase/supabase-js';
import type { CreateCustomerDTO } from './customer.types.js';


const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;


export class CustomerService {
    async findByCitizenId(customer_citizen_id: string, accessToken?: string) {
        if (!customer_citizen_id) return null;
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);
        const { data, error } = await supabase
            .from('customers')
            .select('customer_id')
            .eq('customer_citizen_id', customer_citizen_id)
            .maybeSingle();
        if (error) {
            throw new Error('Database error.');
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

    async searchCustomers(query: string, accessToken?: string) {
        if (!query) return [];
        const supabase = createClient(supabaseUrl, supabaseAnonKey, accessToken ? {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        } : undefined);

        const { data, error } = await supabase
            .from('customers')
            .select('customer_id, customer_citizen_id, customer_fname_th, customer_lname_th')
            .or(`customer_citizen_id.ilike.%${query}%,customer_fname_th.ilike.%${query}%,customer_lname_th.ilike.%${query}%`)
            .limit(10);

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
}

export const customerService = new CustomerService();
