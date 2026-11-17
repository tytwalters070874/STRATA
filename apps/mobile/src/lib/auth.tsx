import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  /** True until the stored session has been read (and an anonymous one created if needed). */
  isLoading: boolean;
  error: Error | null;
  /** Retry anonymous sign-in, e.g. after a first launch with no signal. */
  retry: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function signInAnonymously() {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

/**
 * Every user gets a session: the stored one if present, otherwise a new
 * anonymous user. Anonymous users can later be upgraded to email/OAuth by
 * linking an identity, keeping the same user id and catalog.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const ensureSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) await signInAnonymously();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Auth methods are deferred out of this callback because calling them
    // inside it can deadlock supabase-js.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'INITIAL_SESSION') {
        // Fired once on subscribe with the stored session, if any.
        if (nextSession) setIsLoading(false);
        else setTimeout(() => void ensureSession(), 0);
      } else if (event === 'SIGNED_OUT') {
        // Sign-out, or a stored refresh token that was rejected: start a
        // fresh anonymous session.
        setTimeout(() => void ensureSession(), 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [ensureSession]);

  return (
    <AuthContext.Provider value={{ session, isLoading, error, retry: ensureSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
