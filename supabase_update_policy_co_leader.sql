-- Update policy "team_members_update_by_leader" to include co-leaders
-- Original request: Add co-leader to the allowed roles for updating

ALTER POLICY "team_members_update_by_leader"
ON "public"."team_members"
TO authenticated
USING (
  (auth.uid() = user_id) 
  AND (role IN ('leader', 'co-leader'))
)
WITH CHECK (
  -- Ensure user_id and team_id cannot be changed during update
  (user_id = (SELECT tm.user_id FROM team_members tm WHERE tm.id = team_members.id))
  AND 
  (team_id = (SELECT tm.team_id FROM team_members tm WHERE tm.id = team_members.id))
);
