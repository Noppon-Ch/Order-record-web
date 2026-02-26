-- SQL Script v3: Fix Customers RLS Policies (Restore Hierarchy-only access for Members)
-- Run this in the Supabase SQL Editor

-- 1. Ensure RLS is enabled
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts and clean up the leak
DROP POLICY IF EXISTS "customers_team_select_by_all_role" ON public.customers;
DROP POLICY IF EXISTS "customers_team_member_hierarchy_select" ON public.customers;
DROP POLICY IF EXISTS "customers_private_select" ON public.customers;
DROP POLICY IF EXISTS "customers_team_insert_all_roles" ON public.customers;
DROP POLICY IF EXISTS "customers_private_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_team_update_all_roles" ON public.customers;
DROP POLICY IF EXISTS "customers_private_update" ON public.customers;

-- 3. SELECT POLICIES (View/Read)

-- [LEADERS/CO-LEADERS]: Can see ALL customers in their team
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

-- [MEMBERS]: Can ONLY see customers in their Upline or Downline hierarchy
-- Starting point is their customer_id_of_user in team_members
CREATE POLICY "customers_team_member_hierarchy_select" ON public.customers
FOR SELECT 
TO authenticated 
USING (
    (get_user_team_role(get_current_user_team_id()) = 'member'::text) AND 
    (customer_record_by_team_id = get_current_user_team_id()) AND 
    (customer_citizen_id = ANY (get_member_hierarchy_ids_v3()))
);

-- [CREATOR ACCESS]: Ensure anyone can see customers they PERONALLY recorded
-- This is tightened to prevent accidental team-wide access.
CREATE POLICY "customers_private_select" ON public.customers
FOR SELECT 
TO authenticated 
USING (
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

-- 4. INSERT POLICIES

-- Allow members to insert into team
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

-- Allow private insert
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

-- Team update (Members can update if roles match or they are the creator)
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

-- Creator update (Tightened)
CREATE POLICY "customers_private_update" ON public.customers
FOR UPDATE 
TO authenticated 
USING (
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
