import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FaceLogo } from '../components/FaceLogo';
import { signUp } from '../services/auth';
import { useStore } from '../store';
import { C, R, T, S } from '../tokens';

interface Props {
  onBack: () => void;
}

export const SignUp: React.FC<Props> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { login } = useStore();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const validate = () => {
    if (!name.trim())          return 'Please enter your name.';
    if (!email.includes('@'))  return 'Please enter a valid email.';
    if (password.length < 8)   return 'Password must be at least 8 characters.';
    if (password !== confirm)  return 'Passwords don\'t match.';
    return null;
  };

  const handleSignUp = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);
    try {
      const user = await signUp(name.trim(), email.trim(), password);
      login(user);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Background />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back */}
          <TouchableOpacity onPress={onBack} style={styles.back}>
            <Text style={[T.kicker, { color: C.ink3 }]}>← BACK</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <FaceLogo size={40} />
            <Text style={styles.title}>Create account</Text>
            <Text style={[T.kicker, { color: C.ink3, marginTop: 4 }]}>
              ritual is everything.
            </Text>
          </View>

          {/* Fields */}
          <View style={styles.fields}>
            <Field label="YOUR NAME" value={name} onChangeText={setName} placeholder="Alex Chen" autoComplete="name" />
            <Field label="EMAIL" value={email} onChangeText={setEmail} placeholder="you@example.com"
              keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Field label="PASSWORD" value={password} onChangeText={setPassword} placeholder="8+ characters" secureTextEntry />
            <Field label="CONFIRM PASSWORD" value={confirm} onChangeText={setConfirm} placeholder="Same again" secureTextEntry />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={[T.bodySm, { color: C.danger }]}>{error}</Text>
            </View>
          ) : null}

          {/* Password strength hint */}
          {password.length > 0 && (
            <View style={styles.strengthRow}>
              {['Length 8+', 'Mixed case', 'Has number'].map((hint, i) => {
                const checks = [password.length >= 8, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password)];
                return (
                  <View key={hint} style={[styles.strengthChip, { backgroundColor: checks[i] ? C.sageSoft : C.surface2 }]}>
                    <Text style={[T.pill, { color: checks[i] ? C.sage : C.ink4 }]}>{checks[i] ? '✓ ' : '○ '}{hint}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity style={styles.cta} onPress={handleSignUp} activeOpacity={0.85} disabled={loading}>
            {loading
              ? <ActivityIndicator color={C.bg} />
              : <Text style={[T.button, { color: C.bg, fontSize: 14 }]}>Create account →</Text>
            }
          </TouchableOpacity>

          <Text style={[T.kicker, { color: C.ink4, textAlign: 'center', marginTop: 16, lineHeight: 16 }]}>
            By signing up you agree to our Terms of Service.{'\n'}
            Your password is securely hashed — we never store it plaintext.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const Field: React.FC<{
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; secureTextEntry?: boolean;
  keyboardType?: any; autoCapitalize?: any; autoComplete?: any;
}> = ({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, autoComplete }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[T.kicker, { marginBottom: 6 }]}>{label}</Text>
      <TextInput
        style={[styles.input, focused && styles.inputFocus]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.ink4}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'words'}
        autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: S.gutter, flexGrow: 1 },
  back: { marginBottom: 20 },
  header: { alignItems: 'center', marginBottom: 32 },
  title: {
    fontFamily: 'CormorantGaramond_400Regular',
    fontSize: 32,
    letterSpacing: -0.6,
    color: C.ink,
    marginTop: 12,
  },
  fields: {},
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F5C2BF',
  },
  strengthRow: { flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  strengthChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill },
  cta: {
    backgroundColor: C.ink,
    borderRadius: R.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
