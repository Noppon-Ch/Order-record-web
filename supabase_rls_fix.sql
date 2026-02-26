-- SQL Script to fix Customers RLS Policies for Member role
-- Run this in the Supabase SQL Editor

-- 1. Enable RLS (just in case)
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing problematic policies for customers
DROP POLICY IF EXISTS "customers_team_insert_all_roles" ON public.customers;
DROP POLICY IF EXISTS "customers_team_select_by_all_role" ON public.customers;
DROP POLICY IF EXISTS "customers_private_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_private_select" ON public.customers;
DROP POLICY IF EXISTS "customers_private_update" ON public.customers;
DROP POLICY IF EXISTS "customers_team_update_all_roles" ON public.customers;
DROP POLICY IF EXISTS "customers_enhanced_visibility_policy" ON public.customers;

-- 3. Create updated policies

-- INSERT: Allow members, co-leaders, and leaders to insert customer records for their team
CREATE POLICY "customers_team_insert_all_roles" ON public.customers
FOR INSERT 
TO authenticated 
WITH CHECK (
    (customer_record_by_team_id IS NOT NULL) AND 
    (EXISTS ( 
        SELECT 1 FROM team_members 
        WHERE team_id = customers.customer_record_by_team_id 
        AND user_id = auth.uid() 
        AND status = 'active' 
        AND role = ANY (ARRAY['leader'::text, 'co-leader'::text, 'member'::text])
    ))
);

-- INSERT (Fallback/Private): Allow insertion if it's their own record (with team or without)
CREATE POLICY "customers_private_insert" ON public.customers
FOR INSERT 
TO authenticated 
WITH CHECK (
    (customer_record_by_user_id = auth.uid()) AND 
    (
        (customer_record_by_team_id IS NULL) OR 
        (EXISTS ( 
            SELECT 1 FROM team_members tm 
            WHERE tm.team_id = customers.customer_record_by_team_id 
            AND tm.user_id = auth.uid() 
            AND tm.status = 'active' 
        ))
    )
);

-- SELECT: Allow members to see team customers
CREATE POLICY "customers_team_select_by_all_role" ON public.customers
FOR SELECT 
TO authenticated 
USING (
    (customer_record_by_team_id IS NOT NULL) AND 
    (EXISTS ( 
        SELECT 1 FROM team_members tm 
        WHERE tm.team_id = customers.customer_record_by_team_id 
        AND tm.user_id = auth.uid() 
        AND tm.status = 'active' 
        AND tm.role = ANY (ARRAY['leader'::text, 'co-leader'::text, 'member'::text])
    ))
);

-- SELECT (Private + Team visibility for creator): Ensure creator can always see their own record
CREATE POLICY "customers_private_select" ON public.customers
FOR SELECT 
TO authenticated 
USING (
    (customer_record_by_user_id = auth.uid()) OR 
    (
        (customer_record_by_team_id IS NOT NULL) AND 
        (EXISTS ( 
            SELECT 1 FROM team_members tm 
            WHERE tm.team_id = customers.customer_record_by_team_id 
            AND tm.user_id = auth.uid() 
            AND tm.status = 'active' 
        ))
    )
);

-- UPDATE: Allow members to update records in their team
CREATE POLICY "customers_team_update_all_roles" ON public.customers
FOR UPDATE 
TO authenticated 
USING (
    (customer_record_by_team_id IS NOT NULL) AND 
    (EXISTS ( 
        SELECT 1 FROM team_members 
        WHERE team_id = customers.customer_record_by_team_id 
        AND user_id = auth.uid() 
        AND status = 'active' 
        AND role = ANY (ARRAY['leader'::text, 'co-leader'::text, 'member'::text])
    ))
)
WITH CHECK (
    (customer_record_by_team_id IS NOT NULL) AND 
    (EXISTS ( 
        SELECT 1 FROM team_members 
        WHERE team_id = customers.customer_record_by_team_id 
        AND user_id = auth.uid() 
        AND status = 'active' 
        AND role = ANY (ARRAY['leader'::text, 'co-leader'::text, 'member'::text])
    ))
);

-- UPDATE (Private/Creator): Ensure creator can update their own record
CREATE POLICY "customers_private_update" ON public.customers
FOR UPDATE 
TO authenticated 
USING (
    (customer_record_by_user_id = auth.uid()) OR 
    (
        (customer_record_by_team_id IS NOT NULL) AND 
        (EXISTS ( 
            SELECT 1 FROM team_members tm 
            WHERE tm.team_id = customers.customer_record_by_team_id 
            AND tm.user_id = auth.uid() 
            AND tm.status = 'active' 
        ))
    )
)
WITH CHECK (
    (customer_record_by_user_id = auth.uid()) OR 
    (
        (customer_record_by_team_id IS NOT NULL) AND 
        (EXISTS ( 
            SELECT 1 FROM team_members tm 
            WHERE tm.team_id = customers.customer_record_by_team_id 
            AND tm.user_id = auth.uid() 
            AND tm.status = 'active' 
        ))
    )
);

-- 4. Fix Unified Roles for other tables (16481 -> authenticated)
-- Products
DROP POLICY IF EXISTS "allow_authenticated_select_products" ON public.products;
CREATE POLICY "allow_authenticated_select_products" ON public.products FOR SELECT TO authenticated USING (true);

-- Teams
DROP POLICY IF EXISTS "teams_read_policy" ON public.teams;
CREATE POLICY "teams_read_policy" ON public.teams FOR SELECT TO authenticated USING ((EXISTS (SELECT 1 FROM team_members tm WHERE ((tm.team_id = teams.team_id) AND (tm.user_id = auth.uid())))) OR (status = 'active'::text));

-- Zipcode
DROP POLICY IF EXISTS "Allow authenticated read" ON public.zipcode_th;
CREATE POLICY "Allow authenticated read" ON public.zipcode_th FOR SELECT TO authenticated USING (true);
