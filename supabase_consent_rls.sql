-- Enable RLS on both tables
ALTER TABLE public.consent_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- 1. Policies for consent_docs
-- Allow everyone (including unauthenticated users) to read active consent docs
-- This is necessary so the frontend can fetch terms before login
CREATE POLICY "Public read access to active consent docs"
ON public.consent_docs
FOR SELECT
USING (is_active = true);

-- Allow service role (admin) to manage docs (implicit, but can be explicit if needed)
-- Note: Service role bypasses RLS, so no policy needed for admin writes if using service role key.


-- 2. Policies for consent_records
-- Users can view their own consent records
CREATE POLICY "Users can view own consent records"
ON public.consent_records
FOR SELECT
USING (auth.uid() = record_by_user_id);

-- Users can insert their own consent records
-- This allows the authenticated user to record their consent (if we were doing it from client side).
-- Since we are doing it from backend (auth.service.ts) using Service Role Key?
-- Wait, auth.service.ts uses `getSupabaseClient()` which loads `SUPABASE_SERVICE_ROLE_KEY`.
-- So the backend uses ADMIN privileges. It bypasses RLS.
-- However, IF we ever want to allow client-side consent recording, this policy is useful.
CREATE POLICY "Users can insert own consent records"
ON public.consent_records
FOR INSERT
WITH CHECK (auth.uid() = record_by_user_id);

-- 3. (Optional) Allow Team Leaders to see consent records of their team members?
-- If `consent_for_team_id` is used:
-- CREATE POLICY "Team leaders can view team consent records"
-- ON public.consent_records
-- FOR SELECT
-- USING (
--   EXISTS (
--     SELECT 1 FROM public.teams
--     WHERE teams.team_id = consent_records.consent_for_team_id
--     AND (teams.owner_user_id = auth.uid()) -- or check team_members role
--   )
-- );
