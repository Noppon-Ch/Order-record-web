export interface Order {
  order_id: string; // PK, uuid
  order_date: string | null; // date string

  // Relationships
  order_customer_id: string; // FK -> customers
  order_recommender_id: string | null; // FK -> customers
  order_assistant_id: string | null; // FK -> customers
  order_record_by_user_id: string | null; // FK -> auth.users

  // Info
  position: string | null;

  // Financials (Integer/Satang)
  order_total_amount: number | null;
  order_discount: number | null;
  order_price_before_tax: number | null;
  order_tax: number | null;
  order_final_price: number | null;

  order_created_at: string | null;
  order_type: string | null;
  order_shipping_address: string | null;
}