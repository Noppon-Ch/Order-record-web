export interface UserProfile {
  user_id: string; // PK, uuid (Matches auth.users.id)
  created_at: string;
  
  // Personal Info
  user_full_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  user_avatar_url: string | null;
  
  // System Info
  social_login_provider: string | null;
  // NOTE: You must add this column to your 'user_profiles' table in Supabase.
  // SQL: ALTER TABLE public.user_profiles ADD COLUMN social_provider_user_id TEXT;
  social_provider_user_id: string | null;
  user_consent_record_id: string | null;  
  
  // Payment Info
  user_payment_channel: string | null;
  user_payment_bank: string | null;
  user_payment_id: string | null;

  user_role: 'user'
}

// DTO for creating a user profile (all fields except created_at, which is usually set by DB)
export type CreateUserProfileDTO = Omit<UserProfile, 'created_at'>;