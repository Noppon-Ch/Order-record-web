-- SQL Script to update Customers RLS Policies with Hierarchy (Upline/Downline) support for Members
-- Run this in the Supabase SQL Editor

-- 1. Ensure RLS is enabled
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "customers_team_select_by_all_role" ON public.customers;
DROP POLICY IF EXISTS "customers_team_member_hierarchy_select" ON public.customers;
DROP POLICY IF EXISTS "customers_private_select" ON public.customers;
DROP POLICY IF EXISTS "customers_team_insert_all_roles" ON public.customers;
DROP POLICY IF EXISTS "customers_private_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_team_update_all_roles" ON public.customers;
DROP POLICY IF EXISTS "customers_private_update" ON public.customers;

-- 3. SELECT POLICIES (View/Read)

-- Leaders and Co-leaders: Can see ALL customers in their team
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
        AND tm.role = ANY (ARRAY['leader'::text, 'co-leader'::text])
    ))
);

-- Members: Can ONLY see customers in their Upline or Downline hierarchy
CREATE POLICY "customers_team_member_hierarchy_select" ON public.customers
FOR SELECT 
TO authenticated 
USING (
    (get_user_team_role(get_current_user_team_id()) = 'member'::text) AND 
    (customer_record_by_team_id = get_current_user_team_id()) AND 
    (customer_citizen_id = ANY (get_member_hierarchy_ids_v3()))
);

-- Creator Backup: Ensure anyone (even members) can see customers they personally created 
-- (Essential for .insert().select() and editing their own records)
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

-- 4. INSERT POLICIES

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

-- 5. UPDATE POLICIES

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
);

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
);
