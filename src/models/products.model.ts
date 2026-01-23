export interface Product {
  product_code: string; // PK, text
  product_id: number | null; // bigint -> number
  
  // Details
  product_name_th: string | null;
  product_name_en: string | null;
  color_th: string | null;
  color_en: string | null;
  product_size: string | null; // แก้ไขชื่อจาก Size เป็น product_size
  
  // Price
  price_per_unit: number | null; // bigint -> number
  
  // Measurements (bigint -> number)
  Under_bust: number | null;
  Top_bust: number | null;
  Waist_min: number | null;
  Waist_max: number | null;
  Hip_min: number | null;
  Hip_max: number | null;
  Bust_min: number | null;
  Bust_max: number | null;
  Hight_min: number | null;
  Hight_max: number | null;
}