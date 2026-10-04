/**
 * Pre-login questionnaire — Yazio-style multi-step onboarding.
 * Captures goals, skin type, age, frequency, concerns.
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Dimensions, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FaceLogo } from '../components/FaceLogo';
import { FlutedGlass } from '../components/FlutedGlass';
import { useStore } from '../store';
import { C, R, T, S } from '../tokens';

const { width: W } = Dimensions.get('window');

interface Step {
  key: string;
  question: string;
  sub?: string;
  multi?: boolean;
  options: { value: string; label: string; icon: string }[];
}

const STEPS: Step[] = [
  {
    key: 'goals',
    question: 'What brought you here?',
    sub: 'Select all that apply',
    multi: true,
    options: [
      { value: 'clear',    label: 'Clear breakouts',         icon: '✦' },
      { value: 'aging',    label: 'Reduce signs of aging',   icon: '◎' },
      { value: 'tone',     label: 'Even my skin tone',       icon: '◈' },
      { value: 'routine',  label: 'Build a simple routine',  icon: '◉' },
      { value: 'glow',     label: 'Get that glow',           icon: '◌' },
      { value: 'confident',label: 'Feel more confident',     icon: '◯' },
    ],
  },
  {
    key: 'source',
    question: 'How did you find us?',
    options: [
      { value: 'social',   label: 'Social media',           icon: '📲' },
      { value: 'friend',   label: 'Friend recommendation',  icon: '🤝' },
      { value: 'appstore', label: 'App Store / Play Store', icon: '🔍' },
      { value: 'community',label: 'Skincare community',     icon: '🧴' },
      { value: 'other',    label: 'Somewhere else',         icon: '◌' },
    ],
  },
  {
    key: 'concern',
    question: 'Biggest skin concern?',
    sub: 'We\'ll prioritise this in your routine',
    multi: true,
    options: [
      { value: 'acne',      label: 'Acne & breakouts',           icon: '⊙' },
      { value: 'dryness',   label: 'Dryness & dehydration',      icon: '◎' },
      { value: 'darkspots', label: 'Dark spots',                 icon: '◈' },
      { value: 'texture',   label: 'Texture & pores',            icon: '◉' },
      { value: 'redness',   label: 'Redness & sensitivity',      icon: '◌' },
      { value: 'aging',     label: 'Fine lines & aging',         icon: '◯' },
    ],
  },
  {
    key: 'skintype',
    question: 'What\'s your skin type?',
    options: [
      { value: 'oily',       label: 'Oily',        icon: '💧' },
      { value: 'dry',        label: 'Dry',         icon: '🌵' },
      { value: 'combo',      label: 'Combination', icon: '⚖️' },
      { value: 'normal',     label: 'Normal',      icon: '✨' },
      { value: 'sensitive',  label: 'Sensitive',   icon: '🌸' },
    ],
  },
  {
    key: 'frequency',
    question: 'How often do you currently do skincare?',
    options: [
      { value: 'never',     label: 'Never — starting fresh',         icon: '🌱' },
      { value: 'sometimes', label: 'Occasionally — a few times/week',icon: '🔆' },
      { value: 'morning',   label: 'Daily — morning only',          icon: '☀️' },
      { value: 'twice',     label: 'Twice daily — dedicated',       icon: '⭐' },
      { value: 'complex',   label: 'I already have a complex stack', icon: '🔬' },
    ],
  },
  {
    key: 'age',
    question: 'Your age range?',
    sub: 'Helps us suggest age-appropriate actives',
    options: [
      { value: 'u20',  label: 'Under 20', icon: '🌿' },
      { value: '2029', label: '20 – 29',  icon: '✦' },
      { value: '3039', label: '30 – 39',  icon: '◎' },
      { value: '4049', label: '40 – 49',  icon: '◈' },
      { value: '50',   label: '50+',      icon: '◉' },
    ],
  },
];

export const Questionnaire: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { completeQuestionnaire, saveQuestionnaire } = useStore();
  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;
  const progress = (step + 1) / (STEPS.length + 1);

  const select = (value: string) => {
    setSelections(prev => {
      const existing = prev[current.key] ?? [];
      if (current.multi) {
        return {
          ...prev,
          [current.key]: existing.includes(value)
            ? existing.filter(v => v !== value)
            : [...existing, value],
        };
      }
      return { ...prev, [current.key]: [value] };
    });
    if (!current.multi) setTimeout(advance, 280);
  };

  const selected = (value: string) => (selections[current.key] ?? []).includes(value);

  const advance = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      if (isLast) {
        // Persist answers so onboarding actually shapes the routine & insights.
        saveQuestionnaire({
          goals:     selections.goals     ?? [],
          concern:   selections.concern   ?? [],
          skintype:  selections.skintype  ?? [],
          frequency: selections.frequency ?? [],
          age:       selections.age       ?? [],
          source:    selections.source    ?? [],
        });
        completeQuestionnaire();
        return;
      }
      setStep(s => s + 1);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const canAdvance = (selections[current.key] ?? []).length > 0;

  return (
    <View style={styles.root}>
      <Background />
      <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        {/* Brand mark */}
        <View style={styles.brand}>
          <FaceLogo size={22} strokeWidth={1.4} />
          <Text style={styles.wordmark}>poreless</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={[T.kicker, { color: C.ink3, textAlign: 'right', marginBottom: 28 }]}>
          {step + 1} of {STEPS.length}
        </Text>

        {/* Question */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], flex: 1 }}>
          <Text style={[T.h1, { fontSize: 30, marginBottom: 6 }]}>{current.question}</Text>
          {current.sub && (
            <Text style={[T.kicker, { color: C.ink3, marginBottom: 20 }]}>{current.sub}</Text>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>
            {current.options.map(opt => {
              const isSelected = selected(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => select(opt.value)}
                  activeOpacity={0.8}
                >
                  <FlutedGlass
                    padding={14}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardActive,
                    ]}
                    noTouch
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionIcon}>{opt.icon}</Text>
                      <Text style={[T.body, { flex: 1, fontWeight: isSelected ? '600' : '400', color: isSelected ? C.accentInk : C.ink }]}>
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <View style={styles.checkDot} />
                      )}
                    </View>
                  </FlutedGlass>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* CTA */}
        {current.multi && (
          <TouchableOpacity
            style={[styles.cta, !canAdvance && styles.ctaDisabled]}
            onPress={canAdvance ? advance : undefined}
            activeOpacity={0.85}
          >
            <Text style={[T.button, { color: C.bg, fontSize: 14 }]}>
              {isLast ? 'Build my routine →' : 'Continue →'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Skip */}
        {step > 0 && (
          <TouchableOpacity onPress={advance} style={styles.skip}>
            <Text style={[T.kicker, { color: C.ink4 }]}>SKIP</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: S.gutter },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22 },
  wordmark: {
    fontFamily: 'CormorantGaramond_400Italic',
    fontSize: 20,
    letterSpacing: -0.4,
    color: C.ink,
  },
  progressTrack: {
    height: 2,
    backgroundColor: C.line,
    borderRadius: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    backgroundColor: C.accent,
    borderRadius: 1,
  },
  optionCard: { borderColor: C.line },
  optionCardActive: {
    borderColor: C.accent,
    backgroundColor: C.accentSoft,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  checkDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.accent,
  },
  cta: {
    backgroundColor: C.ink,
    borderRadius: R.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  ctaDisabled: { backgroundColor: C.ink4 },
  skip: { alignItems: 'center', paddingVertical: 12 },
});
