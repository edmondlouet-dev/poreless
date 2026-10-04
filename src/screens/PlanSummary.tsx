/**
 * PlanSummary — the "your protocol is ready" moment, shown once right after
 * onboarding (inspired by the goal-summary screen in modern nutrition apps,
 * reinterpreted in the Poreless sand-and-terracotta aesthetic).
 *
 * It turns the questionnaire answers into a plan that visibly belongs to THIS
 * user: a primary goal, a ring of targets, concern themes, and a warm editorial
 * read of where they're headed. Everything here is derived from their answers,
 * so the app feels built around them from the first screen.
 */
import React, { useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FaceLogo } from '../components/FaceLogo';
import { FlutedGlass } from '../components/FlutedGlass';
import { useStore } from '../store';
import { C, R, T, S } from '../tokens';

// Highlights skin-science terms in terracotta orange inline within a Text block.
const HIGHLIGHT_TERMS = [
  'BHA cadence', 'barrier support', 'barrier-first', 'barrier',
  'ceramides', 'ceramide', 'retinoid', 'SPF', 'antioxidant', 'humectant',
  'hyaluronic acid', 'resurfacing', 'nightly retinoid', 'vitamin C + SPF',
  'actives', 'layering', 'pigment', 'BHA', 'consistent', 'fragrance-free',
];

function HighlightedLine({ text, style }: { text: string; style?: object }) {
  const sorted = [...HIGHLIGHT_TERMS].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `(${sorted.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi',
  );
  const parts = text.split(pattern);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <Text key={i} style={{ color: '#E07A5F', fontWeight: '600' }}>{part}</Text>
          : <Text key={i}>{part}</Text>,
      )}
    </Text>
  );
}

// Concern → the plan's centre of gravity.
const CONCERN_PLAN: Record<string, { focus: string; target: number; goal: string; line: string }> = {
  acne:      { focus: 'Clarity',    target: 90, goal: 'clearer, calmer skin', line: 'a steady BHA cadence and barrier support to bring breakouts down without stripping' },
  dryness:   { focus: 'Hydration',  target: 92, goal: 'deep, lasting hydration', line: 'humectant layering on damp skin, sealed with ceramides, to rebuild a plump, dewy barrier' },
  darkspots: { focus: 'Even tone',  target: 88, goal: 'a brighter, more even tone', line: 'daily antioxidant + SPF to fade pigment and protect your progress' },
  texture:   { focus: 'Smoothness', target: 89, goal: 'refined texture & pores', line: 'gentle resurfacing alternated with retinoid nights to smooth and tighten over time' },
  redness:   { focus: 'Calm',       target: 91, goal: 'a calmer, less reactive complexion', line: 'a barrier-first, fragrance-free approach that quiets reactivity week by week' },
  aging:     { focus: 'Firmness',   target: 90, goal: 'firmer, more resilient skin', line: 'a nightly retinoid paired with disciplined SPF — the most evidence-backed pairing there is' },
};

const DEFAULT_PLAN = { focus: 'Balance', target: 90, goal: 'healthy, resilient skin', line: 'a simple, consistent routine tuned to your skin and built to compound' };

const CONCERN_LABEL: Record<string, string> = {
  acne: 'Acne', dryness: 'Dryness', darkspots: 'Dark spots',
  texture: 'Texture', redness: 'Redness', aging: 'Aging',
};
const GOAL_LABEL: Record<string, string> = {
  clear: 'Clear skin', aging: 'Anti-aging', tone: 'Even tone',
  routine: 'Simple routine', glow: 'Glow', confident: 'Confidence',
};
const SKIN_LABEL: Record<string, string> = {
  oily: 'Oily', dry: 'Dry', combo: 'Combination', normal: 'Normal', sensitive: 'Sensitive',
};
const CADENCE: Record<string, string> = {
  never: 'AM', sometimes: 'AM', morning: 'AM', twice: 'AM+PM', complex: 'AM+PM',
};

interface Props { onContinue: () => void; }

export const PlanSummary: React.FC<Props> = ({ onContinue }) => {
  const insets = useSafeAreaInsets();
  const { questionnaireAnswers: a } = useStore();

  const primaryConcern = a.concern[0] ?? '';
  const plan = CONCERN_PLAN[primaryConcern] ?? DEFAULT_PLAN;
  const cadence = CADENCE[a.frequency[0] ?? 'morning'] ?? 'AM';
  const skin = SKIN_LABEL[a.skintype[0] ?? ''] ?? 'Balanced';

  // Theme chips — the user's own words, deduped.
  const themes = [
    ...a.concern.map(c => CONCERN_LABEL[c]).filter(Boolean),
    ...a.goals.map(g => GOAL_LABEL[g]).filter(Boolean),
  ].slice(0, 6);

  const targets = [
    { value: String(plan.target), label: 'Target', tone: C.ink,    fill: C.surface },
    { value: plan.focus,          label: 'Focus',  tone: C.accentInk, fill: C.accentSoft },
    { value: '12 wk',             label: 'Plan',   tone: C.sage,    fill: C.sageSoft },
    { value: cadence,             label: 'Cadence',tone: C.ink2,    fill: C.surface2 },
  ];

  // Soft staged entrance.
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 120 }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <Background />
      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: rise }] }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <FaceLogo size={24} strokeWidth={1.4} />
            <Text style={styles.wordmark}>poreless</Text>
          </View>

          <Text style={[T.kicker, { color: C.accent, marginBottom: 8 }]}>✦ YOUR PROTOCOL IS READY</Text>
          <Text style={[T.h1, { fontSize: 32, lineHeight: 38, marginBottom: 6 }]}>
            A plan built around{' '}
            <Text style={{ fontStyle: 'italic', color: C.accentInk }}>{plan.goal}</Text>.
          </Text>

          {/* Primary goal card with the ring of targets */}
          <FlutedGlass padding={18} style={{ marginTop: 18, marginBottom: 16 }}>
            <Text style={[T.kicker, { color: C.accent, marginBottom: 14, letterSpacing: 2.4 }]}>YOUR TARGETS</Text>
            <View style={styles.ringRow}>
              {targets.map(t => (
                <View key={t.label} style={styles.target}>
                  <View style={[styles.ring, { backgroundColor: t.fill }]}>
                    <Text style={[T.num, { color: t.tone, fontSize: t.value.length > 4 ? 13 : 17, fontWeight: '700' }]}>
                      {t.value}
                    </Text>
                  </View>
                  <Text style={[T.kicker, { color: C.ink3, fontSize: 8, marginTop: 6 }]}>{t.label.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          </FlutedGlass>

          {/* Editorial read — personalised to their answers */}
          <FlutedGlass padding={16} style={{ marginBottom: 16 }}>
            <Text style={[T.kicker, { color: C.accent, marginBottom: 10, letterSpacing: 2.4 }]}>HOW WE'LL GET THERE</Text>
            <HighlightedLine
              text={`For your ${skin.toLowerCase()} skin, your routine leads with ${plan.line}. We'll track it on every scan and adjust as your skin responds — so the plan keeps fitting you, not the other way around.`}
              style={[T.body, { color: C.ink2, lineHeight: 24, fontSize: 16 }]}
            />
          </FlutedGlass>

          {/* Theme chips */}
          {themes.length > 0 && (
            <>
              <Text style={[T.kicker, { color: C.ink3, marginBottom: 10 }]}>WE'RE FOCUSING ON</Text>
              <View style={styles.chipWrap}>
                {themes.map((th, i) => (
                  <View key={th + i} style={[styles.chip, i % 2 === 0 ? styles.chipAccent : styles.chipSage]}>
                    <Text style={[T.pill, { color: i % 2 === 0 ? C.accentInk : C.sage, fontSize: 12 }]}>{th}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {/* Pinned CTA — frosted glass with pale terracotta tint */}
        <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity onPress={onContinue} activeOpacity={0.88} style={styles.ctaOuter}>
            <BlurView intensity={55} tint="light" style={styles.ctaBlur}>
              <View style={styles.ctaTint} />
              <Text style={styles.ctaText}>Begin my protocol →</Text>
            </BlurView>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: S.gutter },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 26 },
  wordmark: {
    fontFamily: 'CormorantGaramond_400Italic',
    fontSize: 21, letterSpacing: -0.4, color: C.ink,
  },
  ringRow: { flexDirection: 'row', justifyContent: 'space-between' },
  target: { alignItems: 'center', flex: 1 },
  ring: {
    width: 62, height: 62, borderRadius: 31,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.line2,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, borderWidth: 1 },
  chipAccent: { backgroundColor: C.accentSoft, borderColor: C.accent + '44' },
  chipSage: { backgroundColor: C.sageSoft, borderColor: C.sage + '44' },
  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: S.gutter, paddingTop: 12,
    backgroundColor: 'rgba(251,250,247,0.92)',
    borderTopWidth: 1, borderTopColor: C.line,
  },
  ctaOuter: {
    borderRadius: R.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(224,122,95,0.35)',
  },
  ctaBlur: {
    paddingVertical: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  ctaTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(224,122,95,0.18)',
  },
  ctaText: {
    fontFamily: 'CormorantGaramond_400Regular',
    fontSize: 22,
    color: '#3A1A08',
    letterSpacing: 0.1,
    zIndex: 1,
  },
});
