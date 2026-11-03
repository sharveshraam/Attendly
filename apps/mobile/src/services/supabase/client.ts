import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { secureSessionStorage } from './secure-storage';

/**
 * Public Supabase client configuration.
 *
 * Primary source: EXPO_PUBLIC_* values inlined by Metro at BUILD time (from the
 * committed `.env`, `.env.local`, or EAS `env`). Fallback: the same values mirrored
 * into the Expo config `extra` (see app.config.ts) and read via expo-constants.
 * Both are public, RLS-protected client values — never a service-role key.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '';
const key =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  extra.supabasePublishableKey ||
  '';

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
      'Supabase client configuration is missing from this build. Rebuild with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY present.',
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

export const SUPABASE_PROJECT_URL = url;
