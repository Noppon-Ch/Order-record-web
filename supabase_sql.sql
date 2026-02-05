-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.consent_docs (
  consent_doc_id uuid NOT NULL DEFAULT gen_random_uuid(),
  consent_type text NOT NULL,
  consent_version text NOT NULL,
  consent_content text,
  consent_effective_date date DEFAULT CURRENT_DATE,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT consent_docs_pkey PRIMARY KEY (consent_doc_id)
);
CREATE TABLE public.consent_records (
  consent_record_id uuid NOT NULL DEFAULT gen_random_uuid(),
  consent_doc_id uuid,
  sign_by_id uuid,
  consent_status boolean DEFAULT true,
  record_by_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  consent_for_team_id uuid,
  CONSTRAINT consent_records_pkey PRIMARY KEY (consent_record_id),
  CONSTRAINT consent_records_consent_doc_id_fkey FOREIGN KEY (consent_doc_id) REFERENCES public.consent_docs(consent_doc_id),
  CONSTRAINT consent_records_sign_by_id_fkey FOREIGN KEY (sign_by_id) REFERENCES public.customers(customer_id),
  CONSTRAINT consent_records_record_by_user_id_fkey FOREIGN KEY (record_by_user_id) REFERENCES auth.users(id),
  CONSTRAINT consent_records_consent_for_team_id_fkey FOREIGN KEY (consent_for_team_id) REFERENCES public.teams(team_id)
);
CREATE TABLE public.customers (
  customer_id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_citizen_id text NOT NULL,
  customer_fname_th text,
  customer_lname_th text,
  customer_fname_en text,
  customer_lname_en text,
  customer_gender text,
  customer_nationality text,
  customer_tax_id text,
  customer_phone text,
  customer_birthdate date,
  customer_registerdate date,
  customer_address1 text,
  customer_address2 text,
  customer_zipcode text,
  customer_position text,
  customer_consent_status boolean DEFAULT false,
  customer_recommender_id text,
  customer_record_by_user_id uuid,
  customer_created_at timestamp with time zone DEFAULT now(),
  customer_record_by_team_id uuid,
  CONSTRAINT customers_pkey PRIMARY KEY (customer_id),
  CONSTRAINT customers_customer_record_by_user_id_fkey FOREIGN KEY (customer_record_by_user_id) REFERENCES auth.users(id),
  CONSTRAINT customers_team_id_fkey FOREIGN KEY (customer_record_by_team_id) REFERENCES public.teams(team_id)
);
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  product_code text,
  product_name text,
  product_size text,
  product_color text,
  product_price integer,
  quantity integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id),
  CONSTRAINT order_items_product_code_fkey FOREIGN KEY (product_code) REFERENCES public.products(product_code)
);
CREATE TABLE public.orders (
  order_id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_date date DEFAULT CURRENT_DATE,
  order_customer_id uuid NOT NULL,
  position text,
  order_recommender_id uuid,
  order_assistant_id uuid,
  order_total_amount integer DEFAULT 0,
  order_discount integer DEFAULT 0,
  order_price_before_tax integer DEFAULT 0,
  order_tax integer DEFAULT 0,
  order_final_price integer DEFAULT 0,
  order_record_by_user_id uuid,
  order_created_at timestamp with time zone DEFAULT now(),
  order_type text,
  order_shipping_address text,
  order_record_by_team_id uuid,
  CONSTRAINT orders_pkey PRIMARY KEY (order_id),
  CONSTRAINT orders_order_record_by_user_id_fkey FOREIGN KEY (order_record_by_user_id) REFERENCES auth.users(id),
  CONSTRAINT orders_order_customer_id_fkey FOREIGN KEY (order_customer_id) REFERENCES public.customers(customer_id),
  CONSTRAINT orders_order_recommender_id_fkey FOREIGN KEY (order_recommender_id) REFERENCES public.customers(customer_id),
  CONSTRAINT orders_order_assistant_id_fkey FOREIGN KEY (order_assistant_id) REFERENCES public.customers(customer_id),
  CONSTRAINT orders_team_id_fkey FOREIGN KEY (order_record_by_team_id) REFERENCES public.teams(team_id)
);
CREATE TABLE public.products (
  product_id smallint,
  product_code text NOT NULL,
  product_name_th text,
  product_name_en text,
  color_th text,
  color_en text,
  product_size text,
  under_bust smallint,
  top_bust smallint,
  price_per_unit integer,
  waist_min smallint,
  waist_max smallint,
  hip_min smallint,
  hip_max smallint,
  bust_min smallint,
  bust_max smallint,
  hight_min smallint,
  hight_max smallint,
  CONSTRAINT products_pkey PRIMARY KEY (product_code)
);
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  user_id uuid NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'member'::text,
  status text DEFAULT 'active'::text,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_members_pkey PRIMARY KEY (id),
  CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id),
  CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.teams (
  team_id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_name text NOT NULL,
  team_code text NOT NULL UNIQUE,
  owner_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'pending'::text,
  CONSTRAINT teams_pkey PRIMARY KEY (team_id),
  CONSTRAINT teams_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_profiles (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_full_name text,
  user_email text,
  user_avatar_url text,
  social_login_provider text,
  user_phone text,
  user_payment_channel text,
  user_payment_bank text,
  user_payment_id text,
  user_consent_record_id text,
  social_provider_user_id text,
  user_role text,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.zipcode_th (
  province text,
  district text,
  subdistrict text,
  zipcode bigint NOT NULL,
  full_locate text NOT NULL,
  CONSTRAINT zipcode_th_pkey PRIMARY KEY (full_locate)
);