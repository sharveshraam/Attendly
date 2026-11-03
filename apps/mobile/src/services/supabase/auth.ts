import * as Linking from 'expo-linking';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase } from './client';
import { APP_SCHEME } from '@/constants';

export function authRedirectUrl(path: string): string {
  return Linking.createURL(path, { scheme: APP_SCHEME });
}

export interface AuthResult {
  user: User | null;
  session: Session | null;
  /** True when the account needs email confirmation before sign-in. */
  needsVerification: boolean;
}

export async function signUp(email: string, password: string, displayName: string): Promise<AuthResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: authRedirectUrl('auth/callback'),
    },
  });
  if (error) throw error;
  // When email confirmation is required, Supabase returns a user but no session.
  const needsVerification = Boolean(data.user && !data.session);
  return { user: data.user, session: data.session, needsVerification };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: data.user, session: data.session, needsVerification: false };
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectUrl('auth/reset-password'),
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function resendVerification(email: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: authRedirectUrl('auth/callback') },
  });
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Exchange a recovery/confirmation deep link for a session. */
export async function exchangeDeepLink(url: string): Promise<Session | null> {
  const supabase = getSupabase();
  // Supabase recovery links carry token_hash + type; confirmation links carry code.
  const parsed = Linking.parse(url);
  const params = { ...(parsed.queryParams ?? {}) } as Record<string, string>;
  // Fragment-based implicit tokens (#access_token=...) are also supported.
  const fragment = url.split('#')[1];
  if (fragment) {
    for (const pair of fragment.split('&')) {
      const [k, v] = pair.split('=');
      if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }

  if (params.token_hash && params.type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: params.type as 'recovery' | 'signup' | 'email',
    });
    if (error) throw error;
    return data.session;
  }
  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return data.session;
  }
  if (params.access_token && params.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    return data.session;
  }
  return null;
}

export function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes('invalid login')) return 'Incorrect email or password.';
  if (lower.includes('already registered') || lower.includes('already been registered'))
    return 'An account with this email already exists. Try signing in.';
  if (lower.includes('email not confirmed')) return 'Please confirm your email before signing in.';
  if (lower.includes('rate limit') || lower.includes('too many'))
    return 'Too many attempts. Please wait a moment and try again.';
  if (lower.includes('network') || lower.includes('fetch'))
    return 'Network error. Check your connection and try again.';
  if (lower.includes('password')) return message;
  return message || 'Something went wrong. Please try again.';
}
