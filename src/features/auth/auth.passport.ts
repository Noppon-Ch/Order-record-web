import passport from 'passport';
import { createClient } from '@supabase/supabase-js';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LineStrategy } from 'passport-line';
import type { Request } from 'express';


export function setupPassport(session: any) {
  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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
        return done(new Error('Failed to get ID token from Google.'), false);
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) return done(error, false);
      return done(null, data.user);
    }
  ));


  // Serialize/deserialize user for session
  passport.serializeUser((user, done) => {
    done(null, user);
  });
  passport.deserializeUser((obj: any, done) => {
    done(null, obj);
  });
}
