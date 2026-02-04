-- 1. DROP Policy เก่าที่อาจจะค้างอยู่ หรือตีกัน
DROP POLICY IF EXISTS "customers_delete_own" ON customers;
DROP POLICY IF EXISTS "customers_user_delete" ON customers;
DROP POLICY IF EXISTS "customer_delete_by_user_no_team" ON customers;
DROP POLICY IF EXISTS "delete_private_customers" ON customers;
DROP POLICY IF EXISTS "delete_team_customers_by_leaders" ON customers;

-- 2. สร้าง Policy ลบข้อมูล "ส่วนตัว" (Private)
-- ใช้ auth.uid() ปกติ ไม่ซับซ้อน
CREATE POLICY "delete_private"
ON customers
FOR DELETE
TO authenticated
USING (
    (customer_record_by_user_id = auth.uid()) 
    AND 
    (customer_record_by_team_id IS NULL)
);

-- 3. สร้าง Policy ลบข้อมูล "ทีม" (Leader & Co-leader)
-- ลองเปลี่ยนมาใช้ JWT Claims ตาม Pattern เดิมของระบบคุณ (customers_team_leader_all)
-- วิธีนี้มักจะไม่มีปัญหาเรื่อง Permission ของตาราง team_members
CREATE POLICY "delete_team_by_jwt_role"
ON customers
FOR DELETE
TO authenticated
USING (
    -- เช็คว่าใน Token มีข้อมูล Team ID
    (auth.jwt() ->> 'team_id') IS NOT NULL 
    -- สถานะ Team ใน Token ต้อง Active
    AND (auth.jwt() ->> 'team_status') = 'active'
    -- Role ใน Token ต้องเป็น Leader หรือ Co-leader
    AND (auth.jwt() ->> 'team_role') IN ('leader', 'co-leader')
    -- และข้อมูลที่จะลบ ต้องเป็นของ Team ID นี้
    AND customer_record_by_team_id = ((auth.jwt() ->> 'team_id')::uuid)
);

-- Note: หากระบบของคุณไม่ได้อัปเดต Role ลงใน JWT ทันที (ต้อง Login ใหม่ถึงจะเห็น) 
-- อาจจะต้องใช้วิธี Query Database (Subquery) แทน แต่จาก Policy เดิมที่คุณมี ดูเหมือนระบบจะใช้ JWT Claims เป็นหลัก