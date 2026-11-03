"use client";

import { createClient } from "@/lib/supabase/client";
import { clearPrivateCache } from "@/lib/offline";

function origin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

/** Signup uses the existing email/password provider only (email confirmation ON). */
export async function signUp(email: string, password: string, displayName: string) {
  const supabase = createClient();
  const base = { email, password, options: { data: { display_name: displayName } } };
  const withRedirect = {
    ...base,
    options: { ...base.options, emailRedirectTo: `${origin()}/auth/callback?next=/onboarding` },
  };
  let result = await supabase.auth.signUp(withRedirect);
  // If the deployed origin is not yet in the Supabase auth allow-list, GoTrue
  // rejects the redirect. Retry with the account's configured site URL rather
  // than failing the whole signup.
  if (result.error && /redirect|allowed/i.test(result.error.message)) {
    result = await supabase.auth.signUp(base);
  }
  return result;
}

export async function signIn(email: string, password: string) {
  return createClient().auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (!error) clearPrivateCache();
  return { error };
}

/** Resend the existing email/password signup confirmation (no OAuth providers). */
export async function resendConfirmation(email: string) {
  const supabase = createClient();
  const emailRedirectTo = `${origin()}/auth/callback?next=/onboarding`;
  let result = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  });
  // Hosted origins not yet in the Auth allow-list make GoTrue reject the
  // redirect. Fall back to the project's configured site URL.
  if (result.error && /redirect|allowed/i.test(result.error.message)) {
    result = await supabase.auth.resend({ type: "signup", email });
  }
  return result;
}

export async function sendPasswordReset(email: string) {
  const supabase = createClient();
  let result = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin()}/reset-password`,
  });
  if (result.error && /redirect|allowed/i.test(result.error.message)) {
    result = await supabase.auth.resetPasswordForEmail(email);
  }
  return result;
}

export async function updatePassword(password: string) {
  return createClient().auth.updateUser({ password });
}

/**
 * Handle every shape of Supabase email redirect used by confirmation and
 * recovery: PKCE `code`, server-side `token_hash`+`type`, or implicit tokens in
 * the URL fragment. Returns the link type so the UI can route correctly.
 */
export async function consumeAuthRedirect(): Promise<{ ok: boolean; type?: string; error?: string }> {
  const supabase = createClient();
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");

  let error: string | undefined;
  let resolvedType = type ?? fragment.get("type") ?? undefined;

  if (tokenHash && type) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as never });
    error = result.error?.message;
  } else if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error?.message;
  } else if (accessToken && refreshToken) {
    const result = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    error = result.error?.message;
    resolvedType ??= "recovery";
  } else {
    return { ok: false, error: "This verification link is incomplete or has already been used." };
  }

  if (error) return { ok: false, error };
  try {
    window.history.replaceState({}, document.title, url.pathname + (url.searchParams.get("next") ? `?next=${encodeURIComponent(url.searchParams.get("next") ?? "")}` : ""));
  } catch {
    /* ignore */
  }
  return { ok: true, type: resolvedType };
}

export function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message);
    if (/Invalid login credentials/i.test(message)) return "Email or password is incorrect.";
    if (/Email not confirmed/i.test(message)) return "Please confirm your email before signing in.";
    if (/rate limit|too many/i.test(message)) return "Too many attempts. Please wait a little and try again.";
    if (/User already registered/i.test(message)) return "An account with this email already exists. Sign in instead.";
    return message;
  }
  return "Something went wrong. Please try again.";
}
