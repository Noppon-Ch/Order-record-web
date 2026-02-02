export interface Customer {
    customer_registerdate?: string;
    customer_id?: string;
    customer_citizen_id: string;
    customer_fname_th?: string;
    customer_lname_th?: string;
    customer_fname_en?: string;
    customer_lname_en?: string;
    customer_gender?: string;
    customer_nationality?: string;
    customer_tax_id?: string;
    customer_phone?: string;
    customer_birthdate?: string; // string for input, or Date object
    customer_address1?: string;
    customer_address2?: string;
    customer_zipcode?: string;
    customer_position?: string;
    customer_consent_status?: boolean;
    customer_recommender_id?: string;
    customer_record_by_user_id?: string;
    customer_record_by_team_id?: string;
    customer_created_at?: string;
    recommender_name?: string; // Virtual field for display
}
export type CreateCustomerDTO = Omit<Customer, 'customer_id' | 'customer_created_at'>;
