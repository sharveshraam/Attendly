import { useEffect } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase/client';
import { useSessionStore } from '@/store/useSessionStore';
import * as authService from '@/services/supabase/auth';

/** Mount once (root layout) to restore and track the auth session. */
export function useAuthListener(): void {
  const setSession = useSessionStore((s) => s.setSession);
  const setInitialized = useSessionStore((s) => s.setInitialized);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setInitialized(true);
      return;
    }
    const supabase = getSupabase();
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session);
          setInitialized(true);
        }
      })
      .catch(() => {
        if (active) setInitialized(true);
      });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [setSession, setInitialized]);
}

export function useAuth() {
  const user = useSessionStore((s) => s.user);
  const session = useSessionStore((s) => s.session);
  const initialized = useSessionStore((s) => s.initialized);
  return {
    user,
    session,
    initialized,
    isAuthenticated: Boolean(session),
    signIn: authService.signIn,
    signUp: authService.signUp,
    signOut: authService.signOut,
    requestPasswordReset: authService.requestPasswordReset,
    updatePassword: authService.updatePassword,
    resendVerification: authService.resendVerification,
    friendlyAuthError: authService.friendlyAuthError,
  };
}
