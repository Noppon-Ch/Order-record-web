-- ===================================================
-- Security Hardening: Strict Join Policy
-- ===================================================

-- This policy ensures that even if a user tries to insert a row directly,
-- they CANNOT set themselves as 'leader' or 'active'.
-- They MUST explicitly set role='member' and status='pending'.

CREATE POLICY "Allow user to join team as pending member"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
    -- 1. Can only insert for themselves
    user_id = auth.uid()
    
    -- 2. MUST be 'member' (cannot be 'leader')
    AND role = 'member'
    
    -- 3. MUST be 'pending' (cannot be 'active')
    AND status = 'pending'
);

-- Note: Since the database default for status is 'active', 
-- this policy effectively BLOCKS any insert that doesn't explicitly 
-- provide status='pending'. This is a good "secure by default" failure mode.
