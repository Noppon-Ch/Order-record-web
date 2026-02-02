-- Drop the problematic policy
DROP POLICY IF EXISTS "team_members_select_active_leader_or_member" ON public.team_members;

-- Create correct policy for SELECT (Viewing members)
CREATE POLICY "team_members_select_policy"
ON public.team_members
FOR SELECT
TO authenticated
USING (
    -- 1. I can always see my own row (this covers the 'pending' seeing themselves case)
    user_id = auth.uid()
    
    OR

    -- 2. I can see rows of a team IF I am an 'active' member of that team
    (
        EXISTS (
            SELECT 1 
            FROM public.team_members AS my_membership 
            WHERE my_membership.user_id = auth.uid() 
            AND my_membership.team_id = team_members.team_id -- Match the team of the row we are trying to view
            AND my_membership.status = 'active'
        )
    )
);

-- Note: The UPDATE and DELETE policies you created earlier are likely fine if they correctly identify the user.
-- But ensure they don't conflict.
