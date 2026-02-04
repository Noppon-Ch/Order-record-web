-- Policy for Leaders to insert private customer records for a member they are removing (or just managing)
-- Allows INSERT if the record is private (team_id IS NULL) AND the user (customer_record_by_user_id) is in a team where auth user is a leader.

CREATE POLICY "leaders_create_private_customer_for_member" ON public.customers
FOR INSERT
WITH CHECK (
  customer_record_by_team_id IS NULL
  AND
  EXISTS (
    SELECT 1 
    FROM team_members target_member
    JOIN team_members leader_me ON target_member.team_id = leader_me.team_id
    WHERE 
      target_member.user_id = customers.customer_record_by_user_id
      AND leader_me.user_id = auth.uid()
      AND leader_me.role IN ('leader', 'co-leader')
      AND leader_me.status = 'active'
  )
);
