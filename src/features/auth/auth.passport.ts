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

  const supabaseAnon = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
    auth: {
      detectSessionInUrl: false,
      autoRefreshToken: false,
      persistSession: false,
    }
  });

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

      // Attach access_token and refresh_token for RLS and Refresh flow
      const userWithToken = {
        ...data.user,
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token
      };
      return done(null, userWithToken);
    }
  ));


  // Serialize/deserialize user for session
  passport.serializeUser((user: any, done) => {
    const sessionUser = {
      id: user.id,
      access_token: user.access_token,
      refresh_token: user.refresh_token, // Ideally store in DB or Redis, but session works for now
      expires_at: user.expires_at || (Date.now() + 3500 * 1000) // Default 1 hour - buffer
    };
    done(null, sessionUser);
  });

  passport.deserializeUser(async (req: Request, obj: any, done: (err: any, user?: any) => void) => {
    try {
      const accessToken = obj.access_token;
      const refreshToken = obj.refresh_token;

      // NOTE: We do NOT auto-refresh here anymore. 
      // We rely on the Client-SIDE interceptor to refresh if API calls fail with 401.
      // If we refresh here, we desync the cookie, causing Re-Login loops.

      // 1. Fetch User Profile
      const userProfile = await getUserProfile(obj.id);

      const user = userProfile
        ? { ...userProfile, id: obj.id, access_token: accessToken, refresh_token: refreshToken }
        : { id: obj.id, access_token: accessToken, refresh_token: refreshToken };

      done(null, user);
    } catch (error) {
      console.error('Error deserializing user:', error);
      done(null, null);
    }
  });
}
