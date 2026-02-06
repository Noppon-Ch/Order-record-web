-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing read policies
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_view_authenticated" ON public.user_profiles;

-- Create strict policy: Own profile OR Same Team members
-- Allows seeing profiles of users who are in the same team (any status)
CREATE POLICY "user_profiles_view_team_and_own"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id)
  OR
  (EXISTS (
     SELECT 1
     FROM team_members tm_me
     JOIN team_members tm_other ON tm_me.team_id = tm_other.team_id
     WHERE tm_me.user_id = auth.uid()
       AND tm_other.user_id = user_profiles.user_id
  ))
);

-- Update policy (unchanged)
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
CREATE POLICY "user_profiles_update_own"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
