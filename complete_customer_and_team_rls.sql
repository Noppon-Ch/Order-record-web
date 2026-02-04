-- 1. Enable RLS on the table (Just in case)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- 2. Clear all existing policies to avoid conflicts
DROP POLICY IF EXISTS "customers_user_select" ON customers;
DROP POLICY IF EXISTS "customers_private_select" ON customers;
DROP POLICY IF EXISTS "customers_team_select_all_roles" ON customers;
DROP POLICY IF EXISTS "customers_private_insert" ON customers;
DROP POLICY IF EXISTS "customers_team_insert_all_roles" ON customers;
DROP POLICY IF EXISTS "customers_private_update" ON customers;
DROP POLICY IF EXISTS "customers_team_update_all_roles" ON customers;
DROP POLICY IF EXISTS "customer_delete_by_user_no_team" ON customers;
DROP POLICY IF EXISTS "customers_team_delete_leaders_only" ON customers;
DROP POLICY IF EXISTS "customers_insert_by_user_or_team" ON customers;


-- ==========================================
-- SELECT POLICIES (Read Access)
-- ==========================================

-- 2.1 Private View: User sees only their own records that are NOT part of a team
CREATE POLICY "customers_private_select"
ON customers FOR SELECT TO authenticated
USING (
    customer_record_by_user_id = auth.uid() 
    AND customer_record_by_team_id IS NULL
);

-- 2.2 Team View: User sees records belonging to their ACTIVE team
CREATE POLICY "customers_team_select_all_roles"
ON customers FOR SELECT TO authenticated
USING (
    customer_record_by_team_id IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_id = customers.customer_record_by_team_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('leader', 'co-leader', 'member')
    )
);

-- ==========================================
-- INSERT POLICIES (Create Access)
-- ==========================================

-- 3.1 Private Insert: Create record with NO team
CREATE POLICY "customers_private_insert"
ON customers FOR INSERT TO authenticated
WITH CHECK (
    customer_record_by_user_id = auth.uid() 
    AND customer_record_by_team_id IS NULL
);

-- 3.2 Team Insert: Create record WITH team (Must be active member)
CREATE POLICY "customers_team_insert_all_roles"
ON customers FOR INSERT TO authenticated
WITH CHECK (
    customer_record_by_team_id IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_id = customers.customer_record_by_team_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('leader', 'co-leader', 'member')
    )
);

-- ==========================================
-- UPDATE POLICIES (Edit Access)
-- ==========================================

-- 4.1 Private Update: Only own records with NO team
CREATE POLICY "customers_private_update"
ON customers FOR UPDATE TO authenticated
USING (
    customer_record_by_user_id = auth.uid() 
    AND customer_record_by_team_id IS NULL
);

-- 4.2 Team Update: Members of the team can update
CREATE POLICY "customers_team_update_all_roles"
ON customers FOR UPDATE TO authenticated
USING (
    customer_record_by_team_id IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_id = customers.customer_record_by_team_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('leader', 'co-leader', 'member')
    )
);

-- ==========================================
-- DELETE POLICIES (Delete Access)
-- ==========================================

-- 5.1 Private Delete: Only own records with NO team
CREATE POLICY "customer_delete_by_user_no_team"
ON customers FOR DELETE TO authenticated
USING (
    customer_record_by_user_id = auth.uid() 
    AND customer_record_by_team_id IS NULL
);

-- 5.2 Team Delete: ONLY Leader/Co-leader can delete team records
CREATE POLICY "customers_team_delete_leaders_only"
ON customers FOR DELETE TO authenticated
USING (
    customer_record_by_team_id IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_id = customers.customer_record_by_team_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('leader', 'co-leader')
    )
);

-- ==========================================
-- TEAM MEMBER POLICIES (For Leaving/Deleting)
-- ==========================================

-- Ensure Leader can remove members (Already implicit in team_members logic generally, but if you need explicit RLS on team_members:)
-- RLS on team_members table is assumed to be handled separately or standard.
-- But if strict RLS is needed for leaving:

-- 6.1 Leader Delete Member (Allows leader to delete rows from team_members where they are leader of that team)
DROP POLICY IF EXISTS "leader_delete_team_member" ON team_members;
CREATE POLICY "leader_delete_team_member"
ON team_members FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM team_members as requester
        WHERE requester.team_id = team_members.team_id 
        AND requester.user_id = auth.uid()
        AND requester.role = 'leader'
        AND requester.status = 'active'
    )
);

-- 6.2 User Leave Team (Allows user to delete their OWN row)
DROP POLICY IF EXISTS "user_leave_teams" ON team_members;
CREATE POLICY "user_leave_teams"
ON team_members FOR DELETE TO authenticated
USING (
    user_id = auth.uid()
);
