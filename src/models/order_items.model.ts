export interface OrderItem {
  id: string; // PK, uuid
  order_id: string | null; // FK -> orders
  
  // Product Link & Snapshot
  product_code: string | null; // FK -> products
  product_name: string | null;
  product_size: string | null;
  product_color: string | null;
  product_price: number | null; // integer
  quantity: number | null; // integer
  
  created_at: string | null;
}