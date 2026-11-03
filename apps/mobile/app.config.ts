import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config. Extends app.json and mirrors the public Supabase client
 * configuration into `extra` so it is available at runtime via
 * `Constants.expoConfig.extra` as a fallback if Metro's EXPO_PUBLIC_* inlining
 * is ever unavailable. These are public, RLS-protected client values — never a
 * service-role key.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabasePublishableKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

  return {
    ...config,
    name: config.name ?? 'Attendly',
    slug: config.slug ?? 'attendly',
    extra: {
      ...config.extra,
      supabaseUrl,
      supabasePublishableKey,
    },
  };
};
