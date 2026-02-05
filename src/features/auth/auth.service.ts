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
  provider: 'google' | 'line',
  intent: 'login' | 'register' = 'login'
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

  // --- Check if User Exists ---
  const existingProfile = await getUserProfile(userId);

  // --- Strict Login Check ---
  // If trying to LOGIN but no profile exists, reject.
  if (intent === 'login' && !existingProfile) {
    console.warn(`[Auth] User ${userId} tried to login but has no profile. Rejecting.`);
    throw new Error('User not found. Please register first.');
  }

  // --- Prepare Profile Data ---
  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const email = user.email || '';
  const avatar = user.user_metadata?.picture || user.user_metadata?.avatar_url || null;
  const phone = user.phone || null;

  // Find the provider-specific user ID.
  const providerUserId = user.identities?.find((i: { provider: string; provider_id: string }) => i.provider === provider)?.provider_id || user.user_metadata?.provider_user_id || null;

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

  // --- Record Consent ---
  // Only record consent if this is a registration flow (implies they agreed on the UI)
  // OR if we decide later to force re-consent on login (but logic here is specific to initial flow).
  if (intent === 'register') {
    try {
      await recordUserConsent(userId, 'platform_terms', '1.0');
    } catch (consentError) {
      console.error('[Supabase] Error recording consent:', consentError);
      // Don't block login if consent recording fails, but log it.
    }
  }
}

// Helper to record consent
async function recordUserConsent(userId: string, consentType: string, version: string) {
  const client = getSupabaseClient();

  // 1. Get the consent_doc_id for the specified type/version
  const { data: docData, error: docError } = await client
    .from('consent_docs')
    .select('consent_doc_id')
    .eq('consent_type', consentType)
    .eq('consent_version', version)
    .eq('is_active', true)
    .single();

  if (docError || !docData) {
    console.warn(`[Supabase] Active consent doc not found for ${consentType} v${version}`);
    return;
  }

  // Cast docData to any to avoid 'never' type error
  const docId = (docData as any).consent_doc_id;

  // 2. Check if user already has a record for this doc
  const { data: existingRecord, error: checkError } = await (client
    .from('consent_records')
    .select('consent_record_id')
    .eq('record_by_user_id', userId)
    .eq('consent_doc_id', docId) as any) // Cast the query builder or result if needed, but simpler to cast result logic
    .single();

  if (existingRecord) {
    // Already recorded
    return;
  }

  // 3. Insert new consent record
  const { error: insertError } = await client
    .from('consent_records')
    .insert([
      {
        consent_doc_id: docId,
        record_by_user_id: userId,
        consent_status: true,
      }
    ] as any);

  if (insertError) {
    console.error('[Supabase] Error inserting consent record:', insertError);
  } else {
    console.log(`[Supabase] Recorded consent ${consentType} v${version} for user ${userId}`);
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
