import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FaceLogo } from '../components/FaceLogo';
import { signIn } from '../services/auth';
import { useStore } from '../store';
import { C, R, T, S } from '../tokens';

interface Props {
  onSignUp: () => void;
}

export const Login: React.FC<Props> = ({ onSignUp }) => {
  const { login } = useStore();
  const insets = useSafeAreaInsets();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [emailFocus, setEmailFocus] = useState(false);
  const [passFocus,  setPassFocus]  = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleContinue = async () => {
    if (!email.trim()) { setError('Please enter your email.'); return; }
    setError('');
    setLoading(true);
    try {
      const user = await signIn(email.trim(), password);
      login(user);
    } catch (e: any) {
      setError(e.message ?? 'Sign-in failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Background />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={styles.hero}>
            <FaceLogo size={68} animated color={C.ink} />
            <Text style={styles.wordmark}>poreless</Text>
            <Text style={[T.kicker, { color: C.ink3, marginTop: 6, textAlign: 'center', lineHeight: 17, letterSpacing: 1.0 }]}>
              ritual is everything.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email */}
            <View>
              <Text style={[T.kicker, { marginBottom: 6 }]}>EMAIL</Text>
              <TextInput
                style={[styles.input, emailFocus && styles.inputFocus]}
                value={email}
                onChangeText={t => { setEmail(t); setError(''); }}
                onFocus={() => setEmailFocus(true)}
                onBlur={() => setEmailFocus(false)}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                placeholder="you@example.com"
                placeholderTextColor={C.ink4}
              />
            </View>

            {/* Password */}
            <View style={{ marginTop: 16 }}>
              <Text style={[T.kicker, { marginBottom: 6 }]}>PASSWORD</Text>
              <TextInput
                style={[styles.input, passFocus && styles.inputFocus]}
                value={password}
                onChangeText={t => { setPassword(t); setError(''); }}
                onFocus={() => setPassFocus(true)}
                onBlur={() => setPassFocus(false)}
                secureTextEntry
                placeholder="Your password"
                placeholderTextColor={C.ink4}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={[T.bodySm, { color: C.danger }]}>{error}</Text>
              </View>
            ) : null}

            {/* Primary CTA */}
            <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue} activeOpacity={0.85} disabled={loading}>
              {loading
                ? <ActivityIndicator color={C.bg} />
                : <Text style={[T.button, { color: C.bg, fontSize: 14 }]}>Continue →</Text>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.line} />
              <Text style={[T.kicker, { color: C.ink4, marginHorizontal: 10 }]}>OR</Text>
              <View style={styles.line} />
            </View>

            {/* Social buttons */}
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.ghostBtn}
                activeOpacity={0.7}
                onPress={() => setError('Apple sign-in coming soon.')}
              >
                <Text style={[T.button, { color: C.ink2 }]}> Apple</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ghostBtn}
                activeOpacity={0.7}
                onPress={() => setError('Google sign-in coming soon.')}
              >
                <Text style={[T.button, { color: C.ink2 }]}>G Google</Text>
              </TouchableOpacity>
            </View>

            {/* Sign-up link */}
            <View style={styles.signUpRow}>
              <Text style={[T.bodySm, { color: C.ink3 }]}>New here? </Text>
              <TouchableOpacity onPress={onSignUp} activeOpacity={0.7}>
                <Text style={[T.bodySm, { color: C.accent, fontWeight: '600' }]}>Create an account →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: S.gutter, flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 44 },
  wordmark: {
    fontFamily: 'CormorantGaramond_400Italic',
    fontSize: 48,
    letterSpacing: -0.96,
    color: C.ink,
    marginTop: 14,
  },
  form: {},
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: C.ink,
  },
  inputFocus: { borderColor: C.ink2 },
  errorBox: {
    backgroundColor: '#FEF0EF',
    borderRadius: R.md,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F5C2BF',
  },
  primaryBtn: {
    backgroundColor: C.ink,
    borderRadius: R.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 14,
  },
  line: { flex: 1, height: 1, backgroundColor: C.line },
  socialRow: { flexDirection: 'row', gap: 10 },
  ghostBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.line2,
    borderRadius: R.md,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: C.surface,
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
});
