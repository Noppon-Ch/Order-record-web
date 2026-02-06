CREATE POLICY "teams_update_policy"
ON public.teams
FOR UPDATE
TO authenticated
USING (
  (owner_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM team_members tm
  WHERE ((tm.team_id = teams.team_id) AND (tm.user_id = auth.uid()) AND (tm.status = 'active'::text) AND (tm.role = 'leader'::text))))
)
WITH CHECK (
  (owner_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM team_members tm
  WHERE ((tm.team_id = teams.team_id) AND (tm.user_id = auth.uid()) AND (tm.status = 'active'::text) AND (tm.role = 'leader'::text))))
);
