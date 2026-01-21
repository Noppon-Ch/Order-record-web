export interface Customer {
  customer_id: string; // PK, uuid
  customer_citizen_id: string; // Unique Text
  
  // Names
  customer_fname_th: string | null;
  customer_lname_th: string | null;
  customer_fname_en: string | null;
  customer_lname_en: string | null;
  
  // Demographics
  customer_gender: string | null;
  customer_nationality: string | null;
  customer_birthdate: string | null; // date string
  
  // Contact & Address
  customer_phone: string | null;
  customer_address1: string | null;
  customer_address2: string | null;
  customer_zipcode: string | null;
  
  // Work & Tax
  customer_position: string | null;
  customer_tax_id: string | null;
  
  // System Info
  customer_registerdate: string | null;
  customer_consent_status: boolean | null;
  customer_recommender_id: string | null; // FK -> customers (Self reference)
  customer_record_by_user_id: string | null; // FK -> auth.users
  customer_created_at: string | null;
}