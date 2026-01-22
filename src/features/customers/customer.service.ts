import { createClient } from '@supabase/supabase-js';
import type { CreateCustomerDTO } from './customer.types.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export class CustomerService {
    async findByCitizenId(customer_citizen_id: string) {
        if (!customer_citizen_id) return null;
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

    async createCustomer(data: CreateCustomerDTO) {
        // Sanitize empty strings to null for optional fields (Postgres handles nulls better for non-constraints)
        const sanitizedData = Object.fromEntries(
            Object.entries(data).map(([key, value]) => [key, value === '' ? null : value])
        );

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
}

export const customerService = new CustomerService();
