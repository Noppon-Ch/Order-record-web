-- 1. ล้าง Policy เดิมเพื่อจัดระเบียบใหม่ (รวมถึงอันที่ชื่อซ้ำหรือทับซ้อนกัน)
DROP POLICY IF EXISTS "customers_team_leader_all" ON customers; -- อันนี้กว้างเกินไปและอาจทำให้สับสน
DROP POLICY IF EXISTS "customers_team_select" ON customers;
DROP POLICY IF EXISTS "customers_team_insert" ON customers;
DROP POLICY IF EXISTS "customers_team_update" ON customers;

-- ลบอันที่ User สร้างไว้ก่อนหน้า (ถ้าอยากใช้ชื่อมาตรฐานใหม่) หรือจะคงไว้ก็ได้
-- DROP POLICY IF EXISTS "customer_delete_by_leader" ON customers; 

-- 2. สร้าง Policy สำหรับการ "ดูข้อมูล" (SELECT) ในทีม
-- อนุญาตให้ Leader, Co-leader, Member ดูได้
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

-- 3. สร้าง Policy สำหรับการ "เพิ่มข้อมูล" (INSERT) ในทีม
-- อนุญาตให้ Leader, Co-leader, Member เพิ่มได้
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

-- 4. สร้าง Policy สำหรับการ "แก้ไขข้อมูล" (UPDATE) ในทีม
-- อนุญาตให้ Leader, Co-leader, Member แก้ไขได้
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

-- 5. สร้าง Policy สำหรับการ "ลบข้อมูล" (DELETE) ในทีม
-- *** อนุญาตเฉพาะ Leader และ Co-leader เท่านั้น (Member ลบไม่ได้) ***
-- (ถ้า User มี policy "customer_delete_by_leader" อยู่แล้ว สามารถข้ามส่วนนี้ได้ แต่แนะนำให้รันเพื่อความชัวร์และใช้ชื่อมาตรฐาน)
DROP POLICY IF EXISTS "customer_delete_by_leader" ON customers; -- ลบของเก่าออกก่อน
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

-- 6. ส่วนข้อมูล Private (ไม่มีทีม)
-- ตรวจสอบว่ามี Policy สำหรับ Private แล้วหรือยัง ถ้ายังให้สร้างใหม่
-- (จาก CSV ดูเหมือนมี "customer_delete_by_user_no_team" แล้ว แต่อาจขาด Select/Update/Insert สำหรับ Private แบบ Explicit)

-- Private Select
DROP POLICY IF EXISTS "customers_select_own" ON customers;
CREATE POLICY "customers_private_select"
ON customers FOR SELECT TO authenticated
USING (
    customer_record_by_user_id = auth.uid() AND customer_record_by_team_id IS NULL
);

-- Private Insert
DROP POLICY IF EXISTS "customers_user_insert" ON customers;
CREATE POLICY "customers_private_insert"
ON customers FOR INSERT TO authenticated
WITH CHECK (
    customer_record_by_user_id = auth.uid() AND customer_record_by_team_id IS NULL
);

-- Private Update
DROP POLICY IF EXISTS "customers_update_own" ON customers;
DROP POLICY IF EXISTS "customers_user_update" ON customers;
CREATE POLICY "customers_private_update"
ON customers FOR UPDATE TO authenticated
USING (
    customer_record_by_user_id = auth.uid() AND customer_record_by_team_id IS NULL
);

-- Private Delete (ใช้ชื่อที่คุณสร้าง customer_delete_by_user_no_team ได้เลย หรือสร้างใหม่)
-- DROP POLICY IF EXISTS "customer_delete_by_user_no_team" ON customers;
-- CREATE POLICY "customers_private_delete" ... (เหมือนด้านบน)
