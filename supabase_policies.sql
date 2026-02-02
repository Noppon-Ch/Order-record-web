-- Enable Row Level Security on the teams table
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Policy: Allow Team Leaders to UPDATE their own team
-- This checks if the current user (auth.uid()) is a 'leader' in the 'team_members' table for the specific team.
CREATE POLICY "Enable update for team leaders"
ON public.teams
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM public.team_members 
    WHERE team_members.team_id = teams.team_id 
    AND team_members.role = 'leader'
    AND team_members.status = 'active'
  )
);

-- Policy: Allow Team Leaders to DELETE their own team
CREATE POLICY "Enable delete for team leaders"
ON public.teams
FOR DELETE
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM public.team_members 
    WHERE team_members.team_id = teams.team_id 
    AND team_members.role = 'leader'
    AND team_members.status = 'active'
  )
);

-- (Optional) Ensure Leaders can also VIEW (SELECT) the team they are editing
-- Often you might already have a public read policy, but if not:
CREATE POLICY "Enable read for team members"
ON public.teams
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM public.team_members 
    WHERE team_members.team_id = teams.team_id
  )
);
