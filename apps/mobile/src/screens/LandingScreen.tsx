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
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StrataIllustration } from '../components/Lithology';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { colors, fonts } from '../theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Stage = 'start' | 'email' | 'code';

/**
 * First screen for people without a signed-in account. Sign-in is the primary
 * action; continuing as a guest opens the map with formation lookup only.
 */
export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
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
      if (!EMAIL_PATTERN.test(address)) {
        // The comma sits next to the period on most phone keyboards.
        throw new Error(
          address.includes(',') ? 'Email addresses use a period, not a comma.' : 'Enter a valid email address',
        );
      }
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
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.masthead}>
          <Text style={styles.wordmark} accessibilityRole="header">
            STRATA
          </Text>
          <Text style={styles.kicker}>A field guide to Montana &amp; Wyoming geology</Text>
        </View>

        {/* Kept through sign-in so the form doesn't sit under an empty page;
            shorter there so the field stays clear of the keyboard. */}
        <View style={styles.figure} accessible accessibilityLabel="Illustration of rock layers, oldest at the bottom">
          <StrataIllustration width={Math.min(width - 48, stage === 'start' ? 420 : 280)} />
          {stage === 'start' && (
            <Text style={styles.caption}>Rock layers stack up through time: the oldest lie at the bottom.</Text>
          )}
        </View>

        <View style={styles.intro}>
          <Text style={styles.headline}>Know the ground beneath you.</Text>
          {stage === 'start' && (
            <Text style={styles.body}>
              Tap anywhere on the map to read the rock under that spot: what it is, how it formed, and how long
              ago.
            </Text>
          )}
        </View>

        {/* Pinned to the bottom on the first screen; while signing in the
            form follows the headline, so no blank page opens up above it. */}
        <View style={[styles.actions, stage !== 'start' && styles.actionsInline]}>
          {stage === 'start' && (
            <>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}
                onPress={() => setStage('email')}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>Sign in</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={enterGuestMode} accessibilityRole="button">
                <Text style={styles.secondaryButtonText}>Continue without signing in</Text>
              </Pressable>
              <Text style={styles.note}>
                Without an account you can explore the map. Identifying rocks and saving a catalog need an account.
              </Text>
            </>
          )}

          {stage === 'email' && (
            <>
              <Text style={styles.prompt}>Sign in with your email. We&apos;ll send you a sign-in code.</Text>
              <TextInput
                style={[styles.input, error != null && styles.inputError]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError(null);
                }}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!busy}
                onSubmitEditing={sendCode}
                accessibilityLabel="Email address"
              />
              <FieldError message={error} />
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
                style={[styles.input, error != null && styles.inputError]}
                value={code}
                onChangeText={(text) => {
                  setCode(text);
                  setError(null);
                }}
                placeholder="Code from the email"
                placeholderTextColor={colors.muted}
                autoComplete="one-time-code"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                editable={!busy}
                onSubmitEditing={verifyCode}
                accessibilityLabel="Sign-in code"
              />
              <FieldError message={error} />
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

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Shown right under the field it is about, and announced by screen readers. */
function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 20,
  },
  masthead: {
    gap: 6,
  },
  wordmark: {
    fontFamily: fonts.labelBold,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: 11,
    color: colors.ink,
  },
  kicker: {
    fontFamily: fonts.label,
    fontSize: 13,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  figure: {
    gap: 8,
    alignItems: 'center',
  },
  caption: {
    alignSelf: 'stretch',
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    color: colors.muted,
  },
  intro: {
    gap: 8,
  },
  headline: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 28,
    lineHeight: 33,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkSoft,
  },
  actions: {
    marginTop: 'auto',
    gap: 12,
  },
  actionsInline: {
    marginTop: 8,
  },
  primaryButton: {
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: {
    backgroundColor: colors.accentPressed,
  },
  primaryButtonText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    letterSpacing: 0.3,
    color: '#fff',
  },
  secondaryButton: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.ink,
  },
  note: {
    fontFamily: fonts.serif,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
  },
  prompt: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 23,
    color: colors.inkSoft,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  inputError: {
    borderColor: colors.danger,
    borderWidth: 2,
  },
  linkRow: {
    alignSelf: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  linkText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.accent,
  },
  disabled: {
    opacity: 0.45,
  },
  error: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.danger,
    marginTop: -4,
  },
});
