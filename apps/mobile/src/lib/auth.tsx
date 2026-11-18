import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

const GUEST_KEY = 'strata-guest-mode';

interface AuthState {
  session: Session | null;
  /** True until the stored session and guest choice have been read (and an anonymous session created if needed). */
  isLoading: boolean;
  error: Error | null;
  /** Retry anonymous sign-in, e.g. after a first launch with no signal. */
  retry: () => Promise<void>;
  /** A real account is signed in (not an anonymous session). Required for identifying rocks and the catalog. */
  isSignedIn: boolean;
  /** The user chose to continue without signing in: map and formation lookup only. */
  guestMode: boolean;
  enterGuestMode: () => void;
  /** Leaves guest mode, so the landing page shows again. */
  leaveGuestMode: () => void;
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
  // null until the saved guest choice has been read.
  const [guestMode, setGuestMode] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(GUEST_KEY)
      .then((value) => setGuestMode(value === '1'))
      .catch(() => setGuestMode(false));
  }, []);

  const enterGuestMode = useCallback(() => {
    setGuestMode(true);
    AsyncStorage.setItem(GUEST_KEY, '1').catch(() => undefined);
  }, []);

  const leaveGuestMode = useCallback(() => {
    setGuestMode(false);
    AsyncStorage.removeItem(GUEST_KEY).catch(() => undefined);
  }, []);

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
        // fresh anonymous session, and show the landing page again.
        leaveGuestMode();
        setTimeout(() => void ensureSession(), 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [ensureSession, leaveGuestMode]);

  const value: AuthState = {
    session,
    isLoading: isLoading || guestMode === null,
    error,
    retry: ensureSession,
    isSignedIn: session != null && !session.user.is_anonymous,
    guestMode: guestMode === true,
    enterGuestMode,
    leaveGuestMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
