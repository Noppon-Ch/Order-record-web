export interface Customer {
    customer_registerdate?: string | undefined;
    customer_id?: string | undefined;
    customer_citizen_id: string;
    customer_fname_th?: string | undefined;
    customer_lname_th?: string | undefined;
    customer_fname_en?: string | undefined;
    customer_lname_en?: string | undefined;
    customer_gender?: string | undefined;
    customer_nationality?: string | undefined;
    customer_tax_id?: string | undefined;
    customer_phone?: string | undefined;
    customer_birthdate?: string | undefined; // string for input, or Date object
    customer_address1?: string | undefined;
    customer_address2?: string | undefined;
    customer_zipcode?: string | undefined;
    customer_position?: string | undefined;
    customer_consent_status?: boolean | undefined;
    customer_recommender_id?: string | undefined;
    customer_record_by_user_id?: string | undefined;
    customer_record_by_team_id?: string | undefined;
    customer_created_at?: string | undefined;
    recommender_name?: string | undefined; // Virtual field for display
}
export type CreateCustomerDTO = Omit<Customer, 'customer_id' | 'customer_created_at'>;
