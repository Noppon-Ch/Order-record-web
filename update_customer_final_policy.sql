-- 1. ล้าง Policy เดิมเพื่อจัดระเบียบใหม่ (รวมถึงอันที่ชื่อซ้ำหรือทับซ้อนกัน)
DROP POLICY IF EXISTS "customers_user_select" ON customers; -- CRITICAL: ลบ Policy ที่ทำให้เกิด Leak (User เห็นข้อมูลทีมเพราะเป็นคนสร้าง)
DROP POLICY IF EXISTS "customers_team_leader_all" ON customers;
DROP POLICY IF EXISTS "customers_team_select" ON customers;
DROP POLICY IF EXISTS "customers_team_insert" ON customers;
DROP POLICY IF EXISTS "customers_team_update" ON customers;
DROP POLICY IF EXISTS "customers_select_own" ON customers;
DROP POLICY IF EXISTS "customers_team_select_all_roles" ON customers;
DROP POLICY IF EXISTS "customers_private_select" ON customers;

-- 2. สร้าง Policy สำหรับการ "ดูข้อมูล" (SELECT)
-- 2.1 กรณี Private: ดูได้เฉพาะของตัวเอง และต้องไม่มีสังกัดทีม
CREATE POLICY "customers_private_select"
ON customers FOR SELECT TO authenticated
USING (
    customer_record_by_user_id = auth.uid() 
    AND customer_record_by_team_id IS NULL
);

-- 2.2 กรณี Team: ดูได้เฉพาะข้อมูลที่สังกัดทีมที่ตัวเองเป็นสมาชิก (Active)
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

-- 3. สร้าง Policy สำหรับการ "เพิ่มข้อมูล" (INSERT)
-- 3.1 กรณี Private
DROP POLICY IF EXISTS "customers_private_insert" ON customers;
CREATE POLICY "customers_private_insert"
ON customers FOR INSERT TO authenticated
WITH CHECK (
    customer_record_by_user_id = auth.uid() 
    AND customer_record_by_team_id IS NULL
);

-- 3.2 กรณี Team
DROP POLICY IF EXISTS "customers_team_insert_all_roles" ON customers;
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
-- Note: ควรลบ Policy "customers_insert_by_user_or_team" ที่ใช้ JWT ถ้าต้องการความปลอดภัยสูงสุดจากการลบ User
DROP POLICY IF EXISTS "customers_insert_by_user_or_team" ON customers;

-- 4. สร้าง Policy สำหรับการ "แก้ไขข้อมูล" (UPDATE)
-- 4.1 กรณี Private
DROP POLICY IF EXISTS "customers_private_update" ON customers;
CREATE POLICY "customers_private_update"
ON customers FOR UPDATE TO authenticated
USING (
    customer_record_by_user_id = auth.uid() 
    AND customer_record_by_team_id IS NULL
);

-- 4.2 กรณี Team
DROP POLICY IF EXISTS "customers_team_update_all_roles" ON customers;
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

-- 5. สร้าง Policy สำหรับการ "ลบข้อมูล" (DELETE)
-- 5.1 กรณี Private (ลบของตัวเองที่ไม่มีทีม)
DROP POLICY IF EXISTS "customer_delete_by_user_no_team" ON customers;
CREATE POLICY "customer_delete_by_user_no_team"
ON customers FOR DELETE TO authenticated
USING (
    customer_record_by_user_id = auth.uid() 
    AND customer_record_by_team_id IS NULL
);

-- 5.2 กรณี Team (เฉพาะ Leader/Co-leader)
DROP POLICY IF EXISTS "customer_delete_by_leader" ON customers;
DROP POLICY IF EXISTS "customers_team_delete_leaders_only" ON customers;
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
