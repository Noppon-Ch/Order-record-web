import type { Customer } from "../../models/customers.model.js";
import type { UserProfile, CreateUserProfileDTO } from "../../models/user_profiles.model.js";
import type { Order } from "../../models/orders.model.js";
import type { OrderItem } from "../../models/order_items.model.js";
import type { Product } from "../../models/products.model.js";
import type { ConsentDoc } from "../../models/consent_docs.model.js";
import type { ConsentRecord } from "../../models/consent_records.model.js";

export type { UserProfile, CreateUserProfileDTO };

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile;
        Insert: CreateUserProfileDTO;
        Update: Partial<CreateUserProfileDTO>;
      };
      customers: {
        Row: Customer;
        Insert: Omit<Customer, "customer_created_at">;
        Update: Partial<Omit<Customer, "customer_created_at">>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, "order_created_at">;
        Update: Partial<Omit<Order, "order_created_at">>;
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, "created_at">;
        Update: Partial<Omit<OrderItem, "created_at">>;
      };
      products: {
        Row: Product;
        Insert: Product;
        Update: Partial<Product>;
      };
      consent_docs: {
        Row: ConsentDoc;
        Insert: Omit<ConsentDoc, "created_at">;
        Update: Partial<Omit<ConsentDoc, "created_at">>;
      };
      consent_records: {
        Row: ConsentRecord;
        Insert: Omit<ConsentRecord, "created_at">;
        Update: Partial<Omit<ConsentRecord, "created_at">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
