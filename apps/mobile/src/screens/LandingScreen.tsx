import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The hero is a stratigraphic column: bands of earth tones, stacked like rock
// layers, drawn with plain Views so the page needs no extra dependency.
const BANDS = [
  { color: '#4f6b6a', height: 26 },
  { color: '#d9c39a', height: 40 },
  { color: '#8c6a3f', height: 22 },
  { color: '#b9965f', height: 48 },
  { color: '#6b4f2a', height: 34 },
  { color: '#c9b08a', height: 30 },
];

type Stage = 'start' | 'email' | 'code';

/**
 * First screen for people without a signed-in account. Sign-in is the primary
 * action; continuing as a guest opens the map with formation lookup only.
 */
export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const { enterGuestMode } = useAuth();

  const [stage, setStage] = useState<Stage>('start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const address = email.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(address)) throw new Error('Enter a valid email address');
      const { error: sendError } = await supabase.auth.signInWithOtp({ email: address });
      if (sendError) throw sendError;
      setEmail(address);
      setStage('code');
    });

  // On success the session becomes a real account and the navigator replaces
  // this screen, so there is nothing to set afterwards.
  const verifyCode = () =>
    run(async () => {
      const token = code.trim();
      if (token.length === 0) throw new Error('Enter the code from the email');
      const { error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
      if (verifyError) throw verifyError;
    });

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column} accessibilityElementsHidden importantForAccessibility="no">
          {BANDS.map((band) => (
            <View key={band.color} style={[styles.band, { backgroundColor: band.color, height: band.height }]} />
          ))}
        </View>

        <Text style={styles.wordmark} accessibilityRole="header">
          STRATA
        </Text>
        <Text style={styles.tagline}>Know the ground beneath you.</Text>
        <Text style={styles.region}>Montana · Wyoming field geology</Text>

        <View style={styles.actions}>
          {stage === 'start' && (
            <>
              <Pressable style={styles.primaryButton} onPress={() => setStage('email')} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>Sign in</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={enterGuestMode}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>Continue without signing in</Text>
              </Pressable>
              <Text style={styles.note}>
                Without an account you can look up the formation under any point on the map. Identifying
                rocks and saving a catalog need an account.
              </Text>
            </>
          )}

          {stage === 'email' && (
            <>
              <Text style={styles.prompt}>Sign in with your email. We'll send you a sign-in code.</Text>
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
              <Pressable
                style={[styles.primaryButton, busy && styles.disabled]}
                onPress={sendCode}
                disabled={busy}
                accessibilityRole="button"
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Send code</Text>}
              </Pressable>
              <Pressable onPress={() => setStage('start')} disabled={busy} hitSlop={8} style={styles.linkRow}>
                <Text style={styles.linkText}>Back</Text>
              </Pressable>
            </>
          )}

          {stage === 'code' && (
            <>
              <Text style={styles.prompt}>Enter the code we sent to {email}.</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="Code from the email"
                placeholderTextColor="#a8a296"
                autoComplete="one-time-code"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                editable={!busy}
                onSubmitEditing={verifyCode}
              />
              <Pressable
                style={[styles.primaryButton, busy && styles.disabled]}
                onPress={verifyCode}
                disabled={busy}
                accessibilityRole="button"
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sign in</Text>}
              </Pressable>
              <Pressable
                onPress={() => {
                  setCode('');
                  setStage('email');
                }}
                disabled={busy}
                hitSlop={8}
                style={styles.linkRow}
              >
                <Text style={styles.linkText}>Use a different email</Text>
              </Pressable>
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </View>
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
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 10,
  },
  column: {
    alignSelf: 'stretch',
    height: 200,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
  },
  band: {
    width: '100%',
  },
  wordmark: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 8,
    color: '#1d1b16',
  },
  tagline: {
    fontSize: 18,
    color: '#4a463e',
  },
  region: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#8a857a',
  },
  actions: {
    marginTop: 28,
    gap: 12,
  },
  primaryButton: {
    height: 52,
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
    height: 52,
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
  note: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6b665c',
    textAlign: 'center',
  },
  prompt: {
    fontSize: 15,
    lineHeight: 21,
    color: '#4a463e',
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#ddd8ce',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#1d1b16',
    backgroundColor: '#fbfaf8',
  },
  linkRow: {
    alignSelf: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  linkText: {
    color: '#6b4f2a',
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
  error: {
    fontSize: 13,
    color: '#d4453a',
    textAlign: 'center',
  },
});
