
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

// Create supabase client with optional JWT
export function getSupabaseClient(accessToken?: string) {
    if (accessToken) {
        return createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        });
    }
    return createClient(supabaseUrl, supabaseKey);
}

export async function getUserProfile(userId: string, accessToken?: string) {
    const supabase = getSupabaseClient(accessToken);
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    console.log('[Supabase] getUserProfile result:', { userId, data, error });
    if (error) throw error;
    return data;
}

export async function updateUserProfile(userId: string, updateData: any, accessToken?: string) {
    const supabase = getSupabaseClient(accessToken);
    const { data, error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', userId)
        .select();
    console.log('[Supabase] updateUserProfile result:', { userId, updateData, data, error });
    if (error) throw error;
    return data;
}
