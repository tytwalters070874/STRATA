import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { RootStackScreenProps } from '../navigation/types';

/**
 * Two ways to attach an email, both confirmed with a one-time code (no deep
 * links needed):
 * - link: a guest adds an email to their current account, keeping the same
 *   user id and catalog (updateUser + verifyOtp type 'email_change').
 * - signIn: sign in to an account created on another device
 *   (signInWithOtp + verifyOtp type 'email'). The guest catalog on this
 *   device is left behind.
 */
type Mode = 'link' | 'signIn';
type Step = { mode: Mode; stage: 'email' } | { mode: Mode; stage: 'code'; email: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) {
    let message = 'Could not delete your account. Please try again.';
    if (error instanceof FunctionsHttpError) {
      try {
        const body: { error?: string } = await error.context.json();
        if (typeof body.error === 'string') message = body.error;
      } catch {
        // Keep the generic message.
      }
    }
    throw new Error(message);
  }
  // The server has already deleted the user, so a global sign-out would fail.
  // Clear the local session; auth.tsx then starts a fresh guest session.
  await supabase.auth.signOut({ scope: 'local' });
}

export default function AccountScreen({ navigation }: RootStackScreenProps<'Account'>) {
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const user = session?.user ?? null;
  const isGuest = user?.is_anonymous ?? true;

  const [step, setStep] = useState<Step | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = (mode: Mode) => {
    setStep({ mode, stage: 'email' });
    setEmail('');
    setCode('');
    setError(null);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      if (!step) return;
      const address = email.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(address)) throw new Error('Enter a valid email address');

      const { error: sendError } =
        step.mode === 'link'
          ? await supabase.auth.updateUser({ email: address })
          : await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
      if (sendError) throw sendError;
      setStep({ mode: step.mode, stage: 'code', email: address });
    });

  const verifyCode = () =>
    run(async () => {
      if (!step || step.stage !== 'code') return;
      const token = code.trim();
      if (token.length === 0) throw new Error('Enter the code from the email');

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: step.email,
        token,
        type: step.mode === 'link' ? 'email_change' : 'email',
      });
      if (verifyError) throw verifyError;
      setStep(null);
      Alert.alert(
        step.mode === 'link' ? 'Catalog saved' : 'Signed in',
        step.mode === 'link'
          ? 'Your catalog is now tied to this email. Sign in with it on any device.'
          : 'Your catalog from your account is now on this device.',
      );
    });

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out?',
      'Your catalog stays with your account. This device switches to a new guest session.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          // auth.tsx starts a fresh guest session when it sees SIGNED_OUT.
          onPress: () => void run(async () => {
            const { error: signOutError } = await supabase.auth.signOut();
            if (signOutError) throw signOutError;
            // The catalog is cached on the phone; don't leave it behind for
            // the next (guest) session.
            queryClient.clear();
            navigation.popTo('Map');
          }),
        },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your catalog, rock photos, identification history' +
        (isGuest ? '' : ' and the email sign-in') +
        '. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void run(async () => {
              await deleteAccount();
              // Drop cached catalog data that belonged to the deleted user.
              queryClient.clear();
              navigation.popTo('Map');
              Alert.alert('Account deleted', 'Your account and everything in it have been deleted.');
            }),
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding" keyboardVerticalOffset={headerHeight}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          {isGuest ? (
            <>
              <Text style={styles.title}>Guest</Text>
              <Text style={styles.body}>
                Your catalog is saved to this phone's guest account. If you reinstall the app or
                change phones, it can't be recovered. Add an email to keep it.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>{user?.email}</Text>
              <Text style={styles.body}>Sign in with this email on any device to see your catalog.</Text>
            </>
          )}
        </View>

        {step === null && (
          <View style={styles.actions}>
            {isGuest ? (
              <>
                <Pressable style={styles.primaryButton} onPress={() => start('link')}>
                  <Text style={styles.primaryButtonText}>Save catalog with email</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => start('signIn')}>
                  <Text style={styles.secondaryButtonText}>I already have an account</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.secondaryButton} onPress={confirmSignOut} disabled={busy}>
                <Text style={styles.destructiveText}>Sign out</Text>
              </Pressable>
            )}
          </View>
        )}

        {step !== null && (
          <View style={styles.card}>
            {step.stage === 'email' ? (
              <>
                <Text style={styles.body}>
                  {step.mode === 'link'
                    ? "We'll email you a code to confirm the address."
                    : "We'll email you a code to sign in. Rocks saved as a guest on this phone won't carry over."}
                </Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#a8a296"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  editable={!busy}
                  onSubmitEditing={sendCode}
                />
              </>
            ) : (
              <>
                <Text style={styles.body}>Enter the code we sent to {step.email}.</Text>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  placeholderTextColor="#a8a296"
                  autoComplete="one-time-code"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  editable={!busy}
                  onSubmitEditing={verifyCode}
                />
              </>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.row}>
              <Pressable onPress={() => setStep(null)} disabled={busy} hitSlop={8}>
                <Text style={styles.linkText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.smallButton, busy && styles.disabled]}
                onPress={step.stage === 'email' ? sendCode : verifyCode}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>{step.stage === 'email' ? 'Send code' : 'Confirm'}</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {step === null && error && <Text style={styles.error}>{error}</Text>}

        {step === null && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delete account</Text>
            <Text style={styles.body}>
              Permanently delete your account, catalog, photos and identification history.
            </Text>
            <Pressable
              style={[styles.secondaryButton, busy && styles.disabled]}
              onPress={confirmDelete}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#d4453a" />
              ) : (
                <Text style={styles.destructiveText}>Delete account</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f4f0',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8a857a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1d1b16',
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: '#4a463e',
  },
  actions: {
    gap: 10,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd8ce',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1d1b16',
    backgroundColor: '#fbfaf8',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#6b4f2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c9c2b4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#3a372f',
    fontSize: 16,
    fontWeight: '600',
  },
  smallButton: {
    minWidth: 110,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#6b4f2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: '#6b4f2a',
    fontSize: 15,
    fontWeight: '600',
  },
  destructiveText: {
    color: '#d4453a',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
  error: {
    fontSize: 13,
    color: '#d4453a',
  },
});
