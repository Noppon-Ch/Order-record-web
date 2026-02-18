import passport from 'passport';
import { createClient } from '@supabase/supabase-js';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LineStrategy } from 'passport-line';
import type { Request } from 'express';
import { getUserProfile, upsertUserProfileAfterOAuth } from './auth.service.js';


export function setupPassport(session: any) {
  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const supabaseAnon = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!);

  // --- Google Strategy ---
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.google_client_id || '',
      clientSecret: process.env.google_client_secret || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '',
      passReqToCallback: true,
    },
    async (
      req: Request,
      accessToken: string,
      refreshToken: string,
      params: any,
      profile: any,
      done: (error: any, user?: any) => void
    ) => {
      const idToken = params.id_token;
      if (!idToken) {
        console.error('[Passport] ID Token is missing in Google OAuth response. Scopes:', req.query.scope);
        return done(new Error('Failed to get ID token from Google.'), false);
      }
      const { data, error } = await supabaseAnon.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) {
        console.error('[Supabase Auth] Login error:', error);
        return done(error, false);
      }

      // Upsert user profile logic moved to route handler (callback) to handle intents properly.
      // await upsertUserProfileAfterOAuth(data.user, 'google');

      // Attach access_token for RLS
      const userWithToken = { ...data.user, access_token: data.session?.access_token };
      return done(null, userWithToken);
    }
  ));


  // Serialize/deserialize user for session
  passport.serializeUser((user: any, done) => {
    // Store id, access_token, AND team_name in session
    // This allows us to skip the team lookup on every request if we already have it.
    // NOTE: If a user changes teams, they might need to re-login to see the new team name immediately in session-based contexts
    // or we need a way to silent-refresh the session. For now, this is a huge performance win.
    const sessionUser = {
      id: user.id,
      access_token: user.access_token,
      team_name: user.team_name // Store this!
    };
    done(null, sessionUser);
  });

  passport.deserializeUser(async (obj: { id: string, access_token?: string, team_name?: string }, done) => {
    // console.time('Passport-Deserialize-User');
    try {
      // 1. Fetch User Profile
      // Depending on requirements, we might even cache the profile in session if updates are rare.
      // But let's keep profile fresh for now, as it's a single quick PK lookup.
      const userProfile = await getUserProfile(obj.id);

      // 2. Resolve Team Name
      // Use cached team_name from session if available, otherwise fetch (fallback/lazy load).
      let teamName = obj.team_name;

      // Only fetch if NOT in session (e.g. first login before we patched this, or if we decide not to store it)
      if (teamName === undefined && obj.access_token) {
        // console.log('[Passport] Team name missing in session. Fetching from DB...');
        const scopedSupabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_ANON_KEY!,
          {
            global: {
              headers: {
                Authorization: `Bearer ${obj.access_token}`,
              },
            },
          }
        );

        const { data: membership } = await scopedSupabase
          .from('team_members')
          .select('teams(team_name)')
          .eq('user_id', obj.id)
          .eq('status', 'active')
          .maybeSingle();

        if (membership?.teams) {
          const teams = membership.teams as any;
          teamName = Array.isArray(teams) ? teams[0]?.team_name : teams?.team_name;
        }
      }

      const user = userProfile
        ? { ...userProfile, id: obj.id, access_token: obj.access_token, team_name: teamName }
        : { id: obj.id, access_token: obj.access_token, team_name: teamName };

      // console.timeEnd('Passport-Deserialize-User');
      done(null, user);
    } catch (error) {
      console.error('Error deserializing user (likely token expired):', error);
      done(null, null);
    }
  });
}
