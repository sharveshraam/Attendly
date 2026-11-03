import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { secureSessionStorage } from './secure-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient<Database> | null = null;

/**
 * Lazily create the single shared Supabase client. Sessions persist in secure
 * platform storage; tokens auto-refresh. detectSessionInUrl is disabled because
 * native deep links are handled explicitly by the auth callback route.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!isSupabaseConfigured || !url || !key) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/mobile/.env.local.',
    );
  }
  if (!client) {
    client = createClient<Database>(url, key, {
      auth: {
        storage: secureSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export const SUPABASE_PROJECT_URL = url ?? '';
