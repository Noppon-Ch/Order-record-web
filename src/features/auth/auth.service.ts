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


  const profile: CreateUserProfileDTO = {
    user_id: userId,
    user_full_name: displayName,
    user_email: email,
    user_avatar_url: avatar,
    social_login_provider: provider,
    social_provider_user_id: providerUserId,
    user_phone: phone,
    user_consent_record_id: null, // or provide appropriate value
    user_payment_channel: null,   // or provide appropriate value
    user_payment_bank: null,      // or provide appropriate value
    user_payment_id: null,        // or provide appropriate value
  };

  // Log the profile data before sending to Supabase
  console.log('[Supabase] Upserting user_profiles:', JSON.stringify(profile, null, 2));


}
