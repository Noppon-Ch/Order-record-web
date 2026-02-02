import { createClient } from '@supabase/supabase-js';
import type { UserProfile } from '../../models/user_profiles.model.js';
import type { CreateUserProfileDTO } from '../../models/user_profiles.model.js';

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (supabase) {
    return supabase;
  }

  // Helper to robustly load and clean env vars
  function getEnv(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`${key} is required for Supabase`);
    return value.replace(/['"\s]/g, '');
  }

  const supabaseUrl = getEnv('SUPABASE_URL');
  const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  return supabase;
}

export async function upsertUserProfileAfterOAuth(
  user: any, // Expects a Supabase User object for both Google and LINE
  provider: 'google' | 'line'
): Promise<void> {
  if (!user) return;

  // The user object is now a Supabase User for both providers.

  // Ensure userId is a valid UUID (Supabase user id is always UUID)
  let userId = user.id;
  // If LINE login and userId is not UUID, try to extract from identities or skip upsert
  if (provider === 'line' && userId && !/^[0-9a-fA-F-]{36}$/.test(userId)) {
    // Try to get from identities (if available)
    const lineIdentity = user.identities?.find((i: { provider: string; provider_id: string }) => i.provider === 'line');
    if (lineIdentity && /^[0-9a-fA-F-]{36}$/.test(lineIdentity.user_id)) {
      userId = lineIdentity.user_id;
    } else {
      console.error('[Supabase] LINE login: user.id is not a valid UUID and cannot be mapped:', user.id);
      return;
    }
  }
  if (!userId || !/^[0-9a-fA-F-]{36}$/.test(userId)) {
    console.error('[Supabase] No valid userId (UUID) found in Supabase user object:', user.id);
    return;
  }

  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const email = user.email || '';
  const avatar = user.user_metadata?.picture || user.user_metadata?.avatar_url || null;
  const phone = user.phone || null;

  // Find the provider-specific user ID.
  // For Supabase auto-linking (like Google), it's in identities.
  // For manual linking (like our LINE setup), we put it in user_metadata.
  const providerUserId = user.identities?.find((i: { provider: string; provider_id: string }) => i.provider === provider)?.provider_id || user.user_metadata?.provider_user_id || null;


  // We ONLY update identity fields. We process critical fields (like role, phone, payment)
  // once during creation (if new) or let them persist if they exist.
  // Using `upsert` with just these fields will NOT nullify others if we don't include them,
  // PROVIDED we are confident `upsert` in Supabase (Postgres) merges by default if we validly hit the PK.
  // However, Supabase/PostgREST `upsert` replaces the row if no `ignoreDuplicates` or specific merge logic is used?
  // Actually, standard `upsert` usually REPLACES the row or UPDATES specified columns. 
  // If we pass a partial object to `upsert`, does it keep the rest?
  // NO. `upsert` essentially does `INSERT ... ON CONFLICT DO UPDATE SET ...`.
  // If we only pass these fields, the other fields might stay if we don't mention them?
  // Yes, if we use the JS client, it maps to `INSERT ... ON CONFLICT DO UPDATE`.
  // The JS client `upsert` sends the whole object. If we exclude keys, they won't be in the SET clause (for the UPDATE part).
  // BUT for the INSERT part, they will be null/default. 
  // Since we are likely logging in an existing user, this effectively acts as a PATCH for these specific fields.

  const profile: any = {
    user_id: userId,
    user_full_name: displayName,
    user_email: email,
    user_avatar_url: avatar,
    social_login_provider: provider,
    social_provider_user_id: providerUserId,
    // REMOVED: user_phone, user_payment_*, user_role, etc. to prevent overwriting with null.
  };

  // Log the profile data before sending to Supabase
  console.log('[Supabase] Upserting user_profiles:', JSON.stringify(profile, null, 2));


  // Upsert the profile into the user_profiles table
  const { error: upsertError } = await getSupabaseClient()
    .from('user_profiles')
    .upsert(profile as any, { onConflict: 'user_id' });

  if (upsertError) {
    console.error('[Supabase] Error upserting user profile:', upsertError);
    throw upsertError;
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await getSupabaseClient()
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('[Supabase] Error fetching user profile:', error);
    return null;
  }

  return data;
}
