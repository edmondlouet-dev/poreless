import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Linking, Animated,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Wind } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FaceLogo } from '../components/FaceLogo';
import { MetricStrip } from '../components/MetricStrip';
import { RoutineRow } from '../components/RoutineRow';
import { FlutedGlass } from '../components/FlutedGlass';
import { LiveActivityWidget } from '../components/LiveActivityWidget';
import { SkeletonLines } from '../components/Skeleton';
import { AmbientModeOverlay, type AmbientStep } from '../components/AmbientModeOverlay';
import type { ARMotion } from '../components/ARSculptOverlay';
import { useStore, type SkinScores } from '../store';
import { buildRoutine, buildEveningRoutine, routineGaps, STEP_LABEL, type ProductCategory } from '../products';
import { getRitual, adaptRoutineForRitual } from '../rituals';
import { C, R, T, S } from '../tokens';

// Maps each score chip to a field on the scan result so the strip reflects the
// real last scan and can be compared against the previous one.
const SCORE_FIELDS: { key: string; label: string; field: keyof SkinScores }[] = [
  { key: 'overall', label: 'Overall',   field: 'overall' },
  { key: 'acne',    label: 'Acne',      field: 'acne' },
  { key: 'hydro',   label: 'Hydration', field: 'hydration' },
  { key: 'tone',    label: 'Tone',      field: 'tone' },
  { key: 'pore',    label: 'Pores',     field: 'pores' },
  { key: 'red',     label: 'Calm',      field: 'redness' },
  { key: 'oil',     label: 'Oil',       field: 'oil' },
  { key: 'tex',     label: 'Texture',   field: 'texture' },
];

const WHY: Partial<Record<string, string>> = {
  spf:         'UV index 6 today. SPF reduces UV-induced free radicals and prevents hyperpigmentation. Reapply every 2h outdoors.',
  antiox:      'Vitamin C neutralises free radicals. Layered before SPF it amplifies photoprotection by up to 8x.',
  serum:       'Treatment serums go on after cleansing so actives penetrate before heavier occlusives seal them out.',
  cleanser:    'A gentle cleanser removes overnight sebum without stripping the barrier.',
  moisturizer: 'Locking in moisture is non-negotiable. A compromised barrier lets everything else work less effectively.',
  retinoid:    'Adapalene accelerates cell turnover. PM only — UV degrades retinoids and increases photosensitivity.',
};

// How each product type is applied — drives the in-Ambient AR guide.
const APPLY_MOTION: Record<ProductCategory, ARMotion> = {
  cleanser:    'apply',
  moisturizer: 'press',
  spf:         'press',
  serum:       'pat',
  antiox:      'pat',
  retinoid:    'pat',
  exfoliant:   'apply',
};

const BROWSE_URLS: Record<ProductCategory, string> = {
  cleanser:    'https://www.sephora.com/search?keyword=CeraVe+La+Roche-Posay+gentle+cleanser',
  moisturizer: 'https://www.sephora.com/search?keyword=La+Mer+Tatcha+luxury+moisturizer+cream',
  spf:         'https://www.sephora.com/search?keyword=EltaMD+UV+Clear+mineral+SPF+tinted',
  serum:       'https://www.sephora.com/search?keyword=hyaluronic+acid+2%25+B5+serum+treatment',
  antiox:      'https://www.sephora.com/search?keyword=SkinCeuticals+CE+Ferulic+vitamin+C+serum',
  retinoid:    'https://www.sephora.com/search?keyword=Differin+adapalene+gel+retinoid+night',
  exfoliant:   "https://www.sephora.com/search?keyword=Paula%27s+Choice+BHA+2%25+salicylic+exfoliant",
};

const CONCERN_INSIGHT: Record<string, string> = {
  acne:      'Your goal is clearer skin — a BHA exfoliant 2–3×/week keeps pores clear; pair with niacinamide AM.',
  dryness:   'You flagged dryness — layer hyaluronic acid on damp skin, then seal with a ceramide moisturiser.',
  darkspots: 'For dark spots, Vitamin C every morning under SPF fades pigment faster than either alone.',
  texture:   'For texture & pores, alternate a gentle exfoliant with retinoid nights — never the same evening.',
  redness:   'You flagged sensitivity — keep it barrier-first: ceramides, centella, and fragrance-free formulas.',
  aging:     'For fine lines, a nightly retinoid plus daily SPF is the most evidence-backed pairing there is.',
};

function getDailyInsight(scores: any, uv: number, tempUnit: string, concern?: string): string {
  // A flagged concern from onboarding leads when the scan looks otherwise stable.
  if (concern && CONCERN_INSIGHT[concern] && (!scores || scores.overall >= 72)) {
    return CONCERN_INSIGHT[concern]!;
  }
  if (!scores) return `UV ${uv} today — your SPF is your single most important product.`;
  if (scores.hydration < 70)
    return `Hydration ${scores.hydration} — apply HA serum within 60 sec of cleansing. Damp skin absorbs 2x more.`;
  if (scores.oil > 70)
    return `Oil elevated (${scores.oil}). Niacinamide regulates sebum by up to 52% with consistent AM use.*`;
  if (scores.acne < 65)
    return `Acne score ${scores.acne}. BHA (salicylic acid) penetrates pores and reduces comedones by ~50% in 8 weeks.*`;
  if (uv >= 6)
    return `UV ${uv} — free radicals peak 10am–2pm. Consistent SPF use reduces photoaging markers by up to 24%.*`;
  return `Skin score ${scores.overall} — barrier health is strong. Consistency compounds: 90 days beats any serum.`;
}

export const Today: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    owned, streak, activeRitual, user, lastScores, prevScores, temperatureUnit,
    ritualStreaks, completeDailyRitual, logRoutineUsage,
    userShelf, faceMetrics, questionnaireAnswers, isAnalyzing,
  } = useStore();
  const [activeMetric, setActiveMetric] = useState('overall');
  const [quickAdd, setQuickAdd]         = useState('');
  const [showAmbient, setShowAmbient]   = useState(false);

  // Live clock — updates every minute to drive greeting + AM/PM routine switch.
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hour     = now.getHours();
  const isPM     = hour >= 17;
  const timeOfDay: 'AM' | 'PM' = isPM ? 'PM' : 'AM';
  const greeting = hour < 12 ? 'good morning' : hour < 17 ? 'good afternoon' : 'good evening';

  // The delta card "pops" each time a different score chip is tapped.
  const popAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    popAnim.setValue(0.6);
    Animated.spring(popAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 220 }).start();
  }, [activeMetric]);

  // Evening folds any missed morning steps into tonight (conflict-aware); the
  // morning is a straight AM routine.
  const evening = isPM ? buildEveningRoutine(owned, false) : null;
  const routine = evening ? evening.steps : buildRoutine(owned, 'AM');
  const compensations = evening?.compensations ?? [];
  const carried = compensations.filter(c => c.action === 'carried');
  const dropped = compensations.filter(c => c.action === 'dropped');
  const carriedCats = new Set(carried.map(c => c.category));

  const gaps    = routineGaps(owned, questionnaireAnswers.concern);

  // Concern flagging → which routine categories directly serve the user's goals,
  // so the relevant steps get a "for your <concern>" badge.
  const CONCERN_CATS: Record<string, ProductCategory[]> = {
    acne:      ['exfoliant', 'serum'],
    texture:   ['exfoliant', 'retinoid'],
    darkspots: ['antiox'],
    aging:     ['retinoid', 'antiox'],
    dryness:   ['serum', 'moisturizer'],
    redness:   ['moisturizer'],
  };
  const primaryConcern = questionnaireAnswers.concern[0];
  const concernCats = new Set(primaryConcern ? (CONCERN_CATS[primaryConcern] ?? []) : []);
  const CONCERN_NAME: Record<string, string> = {
    acne: 'acne', texture: 'texture', darkspots: 'dark spots',
    aging: 'aging', dryness: 'dryness', redness: 'sensitivity',
  };

  // Completion is tracked here so tapping the Live Activity checks off the next
  // step in the routine below (and toggling a row updates the widget).
  const [completed, setCompleted] = useState<Set<number>>(() => new Set([0, 1]));
  const toggleStep = (i: number) =>
    setCompleted(prev => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  const completeNext = () =>
    setCompleted(prev => {
      const n = new Set(prev);
      for (let i = 0; i < routine.length; i++) { if (!n.has(i)) { n.add(i); break; } }
      return n;
    });

  const ritual   = activeRitual ? getRitual(activeRitual) : undefined;
  const tomorrow = activeRitual ? adaptRoutineForRitual(activeRitual, owned) : [];

  // Progressive decoupling: 7+ consecutive days on this ritual
  const ritualMastered = !!(activeRitual && (ritualStreaks[activeRitual] ?? 0) >= 7);

  // Ambient mode steps from the current morning routine
  const ambientSteps: AmbientStep[] = routine.map(s => ({
    label:       STEP_LABEL[s.category],
    productName: s.name,
    duration:    Math.max(s.mins * 20, 15),
    motion:      APPLY_MOTION[s.category] ?? 'apply',
  }));

  // Live Activity widget data — driven by the real completion set.
  const completedCount = routine.length > 0
    ? Array.from(completed).filter(i => i < routine.length).length
    : 0;
  const liveProgress   = routine.length > 0 ? completedCount / routine.length : 0;
  const allDone        = routine.length > 0 && completedCount >= routine.length;
  const nextStepIdx    = routine.findIndex((_, i) => !completed.has(i));

  const days   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const dateStr = `${days[now.getDay()]} · ${months[now.getMonth()]} ${now.getDate()}`;
  const firstName = user?.name?.split(' ')[0]?.toLowerCase() ?? 'alex';

  const UV = 6;
  const tempC = 23;
  const tempDisplay = temperatureUnit === 'F' ? `${Math.round(tempC * 9 / 5 + 32)}°F` : `${tempC}°C`;
  const insight = getDailyInsight(lastScores, UV, temperatureUnit, questionnaireAnswers.concern[0]);

  // Score chips reflect the real last scan; tapping one reveals the delta.
  const metrics = SCORE_FIELDS.map(f => {
    const v = lastScores ? lastScores[f.field] : 0;
    return { key: f.key, value: String(v), label: f.label, dot: (v < 65 ? 'warn' : 'good') as 'warn' | 'good' };
  });
  const selField = SCORE_FIELDS.find(f => f.key === activeMetric) ?? SCORE_FIELDS[0]!;
  const curVal   = lastScores ? lastScores[selField.field] : 0;
  const prevVal  = prevScores ? prevScores[selField.field] : curVal;
  const delta    = curVal - prevVal;
  const trend    = delta > 1 ? 'improving' : delta < -1 ? 'softening' : 'holding steady';
  const trendColor = delta > 1 ? C.sage : delta < -1 ? C.warn : C.ink3;

  // Cosmetic Conflict Harmonizer — surfaces on the dashboard the moment a shelf
  // product clashes with the barrier read from the latest scan. A product the
  // Gemini chemist flagged (warningText) wins; otherwise fall back to a local
  // active-vs-barrier check so the banner still works in simulation.
  const HARSH = ['retinol', 'retinyl', 'tretinoin', 'adapalene', 'glycolic acid',
    'salicylic acid', 'benzoyl peroxide', 'ascorbic acid', 'vitamin c', 'lactic acid'];
  const barrierFatigued = /sensiti|fatig/i.test(faceMetrics.barrierStatus);
  const flaggedProduct  = userShelf.find(p => !!p.warningText);
  const conflictProduct = flaggedProduct ?? (barrierFatigued
    ? userShelf.find(p => p.ingredients.some(i => HARSH.some(h => i.toLowerCase().includes(h))))
    : undefined);
  const conflictActive = conflictProduct?.ingredients.find(i => HARSH.some(h => i.toLowerCase().includes(h)));
  const conflictCopy = conflictProduct?.warningText ?? null;

  return (
    <View style={styles.root}>
      <Background />

      {/* Ambient Mode overlay — full-screen, above everything */}
      {showAmbient && (
        <AmbientModeOverlay
          steps={ambientSteps}
          ritualKey={activeRitual ?? undefined}
          onComplete={() => {
            if (activeRitual) completeDailyRitual(activeRitual);
            logRoutineUsage();            // draw down the shelf for products used
            setShowAmbient(false);
          }}
          onDismiss={() => setShowAmbient(false)}
        />
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 4, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand row */}
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <FaceLogo size={26} strokeWidth={1.4} />
            <Text style={styles.wordmark}>poreless</Text>
          </View>
          <View style={styles.streak}>
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path d="M12 3c0 4-4 5-4 9a4 4 0 0 0 8 0c0-2-1-3-2-4 0 2-1 3-2 3 0-3 0-5 0-8z"
                fill="none" stroke={C.warn} strokeWidth={1.6}
                strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={[T.num, { fontSize: 13, fontWeight: '600', color: C.warn }]}>{streak}</Text>
          </View>
        </View>

        {/* Live Activity widget — tap to check off the next routine step below */}
        {routine.length > 0 && (
          <LiveActivityWidget
            currentStep={STEP_LABEL[routine[nextStepIdx >= 0 ? nextStepIdx : routine.length - 1]?.category] ?? ''}
            progress={liveProgress}
            streak={streak}
            ritualName={ritual?.name}
            onAdvance={ritualMastered ? undefined : completeNext}
            allDone={allDone}
          />
        )}

        {/* Date + greeting */}
        <View style={{ marginBottom: 14 }}>
          <Text style={[T.kicker, { marginBottom: 5 }]}>{dateStr} · {tempDisplay} · UV {UV}</Text>
          <Text style={[T.h1, { fontSize: 30 }]}>
            {greeting},{' '}
            <Text style={{ fontStyle: 'italic', color: C.accentInk }}>{firstName}</Text>
          </Text>
        </View>

        {/* DAILY BRIEF — science insight */}
        <FlutedGlass padding={14} style={{ marginBottom: 16 }}>
          <Text style={[T.kicker, { color: C.accent, marginBottom: 6 }]}>✦ DAILY BRIEF</Text>
          <Text style={[T.bodySm, { color: C.ink2, lineHeight: 18 }]}>{insight}</Text>
          {lastScores && (
            <View style={{ flexDirection: 'row', gap: 0, marginTop: 12 }}>
              {[
                { label: 'SKIN SCORE', value: String(lastScores.overall) },
                { label: 'HYDRATION',  value: String(lastScores.hydration) },
                { label: 'STREAK',     value: `${streak}d` },
              ].map((s, i) => (
                <View key={s.label} style={[
                  styles.briefStat,
                  i > 0 && { borderLeftWidth: 1, borderLeftColor: C.line },
                ]}>
                  <Text style={[T.num, { fontSize: 20, fontWeight: '700', color: C.ink }]}>{s.value}</Text>
                  <Text style={[T.kicker, { color: C.ink3, fontSize: 8, letterSpacing: 0.3, marginTop: 2 }]}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={[T.bodySm, { color: C.ink4, fontSize: 9, marginTop: 8 }]}>
            * Peer-reviewed research. Not medical advice. Individual results vary.
          </Text>
        </FlutedGlass>

        {/* Active ritual banner */}
        {ritual && (
          <FlutedGlass padding={10} style={{ marginBottom: 14, borderColor: C.accent }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[T.kicker, { color: C.accent, flex: 1 }]}>
                ✦ {ritual.culture.toUpperCase()} · {ritual.name}
                {ritualMastered ? ' · MASTERED' : ` · DAY ${(ritualStreaks[activeRitual!] ?? 0) + 1} OF 7`}
              </Text>
            </View>
          </FlutedGlass>
        )}

        {/* Score strip — tap a chip to see how it moved since the last scan */}
        <View style={styles.sectionHeader}>
          <Text style={T.kicker}>SCORES</Text>
          <Text style={[T.kicker, { color: C.ink4, fontSize: 8 }]}>TAP FOR CHANGE</Text>
        </View>
        <View style={{ marginBottom: 10 }}>
          <MetricStrip metrics={metrics} active={activeMetric} onPick={setActiveMetric} />
        </View>
        <Animated.View style={{ transform: [{ scale: popAnim }], opacity: popAnim }}>
          <FlutedGlass padding={14} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={[T.num, { fontSize: 30, fontWeight: '700', color: C.ink }]}>{curVal}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[T.body, { fontWeight: '600', fontSize: 14 }]}>{selField.label}</Text>
                <Text style={[T.bodySm, { color: trendColor, fontSize: 12, marginTop: 2, fontWeight: '600' }]}>
                  {delta > 0 ? '▲' : delta < 0 ? '▼' : '■'} {delta > 0 ? '+' : ''}{delta} ·{' '}
                  {delta > 1 ? 'improved' : delta < -1 ? 'dipped' : 'steady'}
                </Text>
              </View>
              <View style={styles.lastChip}>
                <Text style={[T.kicker, { color: C.ink4, fontSize: 8 }]}>LAST SCAN</Text>
                <Text style={[T.num, { color: C.ink2, fontSize: 17, fontWeight: '600' }]}>{prevVal}</Text>
              </View>
            </View>
          </FlutedGlass>
        </Animated.View>

        {/* Cosmetic Conflict Harmonizer banner — shimmers while the chemist thinks */}
        {isAnalyzing ? (
          <FlutedGlass padding={12} style={[styles.harmonizer, { marginBottom: 16 }]}>
            <Text style={[T.kicker, { color: C.warn, marginBottom: 8 }]}>✦ CONFLICT HARMONIZER · ANALYSING</Text>
            <SkeletonLines lines={2} lastWidth="70%" />
          </FlutedGlass>
        ) : conflictProduct && (conflictCopy || conflictActive) && (
          <FlutedGlass padding={12} style={[styles.harmonizer, { marginBottom: 16 }]}>
            <Text style={[T.kicker, { color: C.warn, marginBottom: 4 }]}>✦ CONFLICT HARMONIZER</Text>
            <Text style={[T.bodySm, { color: C.ink2, lineHeight: 17 }]}>
              <Text style={{ fontWeight: '600' }}>{conflictProduct.name}</Text>
              {conflictCopy
                ? <> — {conflictCopy}</>
                : <> has <Text style={{ fontWeight: '600' }}>{conflictActive}</Text>. Your barrier reads{' '}
                    {faceMetrics.barrierStatus.toLowerCase()} — ease it back in once calm.</>}
            </Text>
          </FlutedGlass>
        )}

        {/* Routine */}
        <View style={styles.sectionHeader}>
          <Text style={[T.kicker, { flex: 1 }]}>{isPM ? 'THIS EVENING' : 'THIS MORNING'} · AUTO-GENERATED</Text>
          <Text style={[T.num, { fontSize: 10, color: C.ink3 }]}>{routine.length} steps</Text>
        </View>

        {/* Ambient mode + quick-add row */}
        <View style={styles.routineToolbar}>
          <View style={styles.quickAdd}>
            <TextInput
              style={styles.quickInput}
              placeholder="add step…"
              placeholderTextColor={C.ink3}
              value={quickAdd}
              onChangeText={setQuickAdd}
              onSubmitEditing={() => setQuickAdd('')}
            />
            <TouchableOpacity style={styles.addBtn} activeOpacity={0.7}>
              <Text style={[T.button, { color: C.ink, fontSize: 16, lineHeight: 18 }]}>+</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.ambientBtn}
            onPress={() => setShowAmbient(true)}
            activeOpacity={0.8}
          >
            <Wind size={14} strokeWidth={1.2} color={C.accentInk} />
            <Text style={[T.button, { color: C.accentInk, fontSize: 11 }]}>Ambient</Text>
          </TouchableOpacity>
        </View>

        {/* ── Progressive decoupling: mastered ritual → single conclude button ── */}
        {ritualMastered && ritual ? (
          <TouchableOpacity
            style={styles.concludeBtn}
            onPress={() => { completeDailyRitual(activeRitual!); logRoutineUsage(); }}
            activeOpacity={0.85}
          >
            <Text style={[T.button, { color: C.bg, fontSize: 14 }]}>
              ✦  Conclude Tonight's Mastered Ritual
            </Text>
            <Text style={[T.kicker, { color: 'rgba(255,255,255,0.55)', marginTop: 6, fontSize: 9 }]}>
              {ritual.name} · {ritualStreaks[activeRitual!]} day streak
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            {routine.map((step, i) => {
              const tag = carriedCats.has(step.category)
                ? 'carried from AM'
                : concernCats.has(step.category) && primaryConcern
                  ? `for your ${CONCERN_NAME[primaryConcern] ?? primaryConcern}`
                  : undefined;
              return (
                <RoutineRow
                  key={`${step.name}-${i}`}
                  idx={i + 1}
                  stepName={STEP_LABEL[step.category]}
                  productName={step.name}
                  time={!isPM && i < 2 ? `7:4${i + 2}` : undefined}
                  why={WHY[step.category]}
                  tag={tag}
                  done={completed.has(i)}
                  onToggle={() => toggleStep(i)}
                />
              );
            })}

            {/* Evening compensator note — what was folded in or held back */}
            {isPM && compensations.length > 0 && (
              <FlutedGlass padding={12} style={styles.compensator}>
                <Text style={[T.kicker, { color: C.accent, marginBottom: 6 }]}>✦ EVENING COMPENSATOR</Text>
                {carried.length > 0 && (
                  <Text style={[T.bodySm, { color: C.ink2, lineHeight: 17 }]}>
                    Folded in {carried.map(c => c.step).join(', ')} — missed this morning and safe to do tonight.
                  </Text>
                )}
                {dropped.map(d => (
                  <Text key={d.step} style={[T.bodySm, { color: C.ink3, lineHeight: 17, marginTop: carried.length ? 6 : 0 }]}>
                    <Text style={{ fontWeight: '600', color: C.ink2 }}>{d.step} held back</Text> — {d.reason}
                  </Text>
                ))}
              </FlutedGlass>
            )}
          </>
        )}

        {/* TOMORROW — reshaped by the active ritual */}
        {ritual && tomorrow.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 18 }]}>
              <Text style={[T.kicker, { flex: 1, color: C.accent }]}>
                TOMORROW · {ritual.culture.toUpperCase()} METHOD
              </Text>
              <Text style={[T.num, { fontSize: 10, color: C.ink3 }]}>{tomorrow.length} steps</Text>
            </View>
            <Text style={[T.bodySm, { color: C.ink3, marginBottom: 10, lineHeight: 17 }]}>
              Your <Text style={{ fontStyle: 'italic', color: C.accentInk }}>{ritual.name}</Text> ritual
              reshapes tomorrow's routine — steps follow the tradition, matched to what's on your shelf.
            </Text>
            {tomorrow.map((t, i) => (
              <FlutedGlass key={`${t.step}-${i}`} padding={12} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <Text style={[T.num, { fontSize: 11, color: C.accent, width: 22 }]}>
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontWeight: '600', fontSize: 13 }]}>{t.step}</Text>
                    <Text style={[T.bodySm, { color: C.ink3, marginTop: 2 }]}>{t.product}</Text>
                  </View>
                </View>
              </FlutedGlass>
            ))}
          </>
        )}

        {/* Gaps — with Browse links */}
        {gaps.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 18 }]}>
              <Text style={T.kicker}>GAPS IN YOUR ROUTINE</Text>
              <Text style={[T.num, { fontSize: 10, color: C.warn }]}>{gaps.length} missing</Text>
            </View>
            <Text style={[T.bodySm, { color: C.ink3, marginBottom: 10, lineHeight: 17 }]}>
              {primaryConcern
                ? `Prioritised for your ${CONCERN_NAME[primaryConcern] ?? primaryConcern} goal. Browse curated matches below.`
                : 'Your stack is incomplete. Browse curated matches below.'}
            </Text>
            {gaps.map(g => (
              <FlutedGlass key={g.key} padding={12} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.gapDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontWeight: '600', textTransform: 'capitalize' }]}>{g.label}</Text>
                    <Text style={[T.bodySm, { color: C.ink3, marginTop: 2, lineHeight: 16 }]}>{g.reason}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.browseBtn}
                    activeOpacity={0.7}
                    onPress={() => Linking.openURL(BROWSE_URLS[g.key as ProductCategory] ?? 'https://www.sephora.com')}
                  >
                    <Text style={[T.button, { fontSize: 11 }]}>Browse →</Text>
                  </TouchableOpacity>
                </View>
              </FlutedGlass>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: S.gutter },
  brandRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8, marginBottom: 4,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: {
    fontFamily: 'CormorantGaramond_400Italic',
    fontSize: 22, letterSpacing: -0.44, color: C.ink,
  },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  briefStat: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  routineToolbar: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'stretch' },
  quickAdd: { flex: 1, flexDirection: 'row', gap: 6 },
  quickInput: {
    flex: 1, backgroundColor: C.surface2, borderRadius: R.md,
    paddingHorizontal: 10, paddingVertical: 7,
    fontFamily: 'Inter_400Regular', fontSize: 12, color: C.ink,
  },
  addBtn: {
    width: 30, height: 30, borderRadius: R.md,
    borderWidth: 1, borderColor: C.line2,
    backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  ambientBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: R.md,
    backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accent + '55',
  },
  concludeBtn: {
    backgroundColor: C.ink, borderRadius: R.md,
    paddingVertical: 16, alignItems: 'center',
    marginBottom: 14,
  },
  harmonizer: { borderColor: 'rgba(193,140,60,0.40)', backgroundColor: '#FEF6EC' },
  compensator: { marginTop: 4, marginBottom: 4, borderColor: C.accent + '44', backgroundColor: C.accentSoft },
  lastChip: { alignItems: 'center', paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: C.line },
  gapDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.warn, flexShrink: 0 },
  browseBtn: {
    borderWidth: 1, borderColor: C.accent + '80',
    borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: C.accentSoft,
  },
});
