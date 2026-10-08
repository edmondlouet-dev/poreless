import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Wind, Sun, Hourglass, CalendarDays } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FaceLogo } from '../components/FaceLogo';
import { RoutineRow } from '../components/RoutineRow';
import { FlutedGlass } from '../components/FlutedGlass';
import { AmbientModeOverlay, type AmbientStep } from '../components/AmbientModeOverlay';
import { MonthlyRecap } from '../components/MonthlyRecap';
import type { TabKey } from '../components/TabBar';
import { useStore, type SkinScores } from '../store';
import { buildRoutine, buildEveningRoutine, routineGaps, STEP_LABEL, type ProductCategory } from '../products';
import { checkShelf } from '../conflicts';
import { trialDue, VERDICT_ADVICE, type TrialVerdict } from '../trials';
import { buildRecap, recapIsEmpty, lastMonthKey } from '../recap';
import { fetchUV, uvBand, type UVState } from '../services/uv';
import { scheduleSpfReapply } from '../services/reminders';
import { routineKey, monthLabel, shortDate } from '../dates';
import { C, R, T, S } from '../tokens';

const WHY: Partial<Record<string, string>> = {
  spf:         'Daily SPF is the best-evidenced way to slow sun-related skin ageing and dark spots. Reapply every 2h outdoors.',
  antiox:      'Vitamin C is an antioxidant. Worn under SPF it can add some extra protection; it does not replace sunscreen.',
  serum:       'Treatment serums go on after cleansing, before heavier creams.',
  cleanser:    'A gentle cleanser removes oil and sunscreen without stripping the skin.',
  moisturizer: 'Moisturiser holds water in the outer layer of skin and helps it feel comfortable, especially alongside actives.',
  retinoid:    'Retinoids speed up skin cell turnover. Use at night, wear SPF by day, and avoid them during pregnancy.',
  exfoliant:   'Exfoliating acids are evening products; start 2–3 nights a week and not on the same night as a retinoid.',
};

// Neutral searches by product type, not brand picks.
const BROWSE_QUERY: Record<ProductCategory, string> = {
  cleanser:    'gentle fragrance-free face cleanser',
  moisturizer: 'fragrance-free ceramide moisturiser',
  spf:         'broad spectrum SPF 50 face sunscreen',
  serum:       'hyaluronic acid serum',
  antiox:      'vitamin C serum',
  retinoid:    'adapalene 0.1% gel',
  exfoliant:   'salicylic acid 2% exfoliant',
};

const CONCERN_INSIGHT: Record<string, string> = {
  acne:      'Your goal is clearer skin. A salicylic acid exfoliant 2–3 times a week helps keep pores clear.',
  dryness:   'You flagged dryness. Apply hyaluronic acid to damp skin, then seal it in with a ceramide moisturiser.',
  darkspots: 'For dark spots, daily SPF matters most. Vitamin C each morning underneath may help them fade.',
  texture:   'For texture and pores, alternate a gentle exfoliant with retinoid nights, never the same evening.',
  redness:   'You flagged sensitivity. Keep it simple and fragrance-free, and add one new product at a time.',
  aging:     'For fine lines, a nightly retinoid plus daily SPF is the most evidence-backed pairing there is.',
};

const SPF_INSIGHT =
  'Daily SPF is your most important product. In a 4.5-year trial, daily sunscreen users showed about 24% less skin ageing.*';

function getDailyInsight(scores: SkinScores | null, concern?: string): string {
  // A flagged concern from onboarding leads when the scan looks otherwise stable.
  if (concern && CONCERN_INSIGHT[concern] && (!scores || scores.overall >= 72)) {
    return CONCERN_INSIGHT[concern]!;
  }
  if (!scores) return SPF_INSIGHT;
  if (scores.hydration < 70)
    return `Skin looked a little dry in your last scan (${scores.hydration}). Apply hyaluronic acid to slightly damp skin, then moisturiser.`;
  // Oil is scored higher = less shiny, so a LOW number means a shiny T-zone.
  if (scores.oil < 55)
    return `Your T-zone looked shiny in your last scan (${scores.oil}). Niacinamide may help with oiliness over several weeks.`;
  if (scores.acne < 65)
    return `Some visible spots in your last scan (${scores.acne}). Salicylic acid (BHA) can help keep pores clear; give it 6–8 weeks.`;
  return SPF_INSIGHT;
}

const CONCERN_CATS: Record<string, ProductCategory[]> = {
  acne:      ['exfoliant', 'serum'],
  texture:   ['exfoliant', 'retinoid'],
  darkspots: ['antiox'],
  aging:     ['retinoid', 'antiox'],
  dryness:   ['serum', 'moisturizer'],
  redness:   ['moisturizer'],
};
const CONCERN_NAME: Record<string, string> = {
  acne: 'acne', texture: 'texture', darkspots: 'dark spots',
  aging: 'aging', dryness: 'dryness', redness: 'sensitivity',
};

const hhmm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

interface Props { onNavigate: (tab: TabKey) => void }

export const Today: React.FC<Props> = ({ onNavigate }) => {
  const insets = useSafeAreaInsets();
  const {
    user, shelf, scans, lastScores, streak, skinFeel, questionnaireAnswers,
    completions, doneSteps, trials, spfReapplyAt,
    toggleStep, completeRoutine, setTrialVerdict, setSpfReapplyAt,
  } = useStore();
  const [showAmbient, setShowAmbient] = useState(false);
  const [recapMonth, setRecapMonth]   = useState<string | null>(null);
  const [verdictShown, setVerdictShown] = useState<{ name: string; verdict: TrialVerdict } | null>(null);
  const [uv, setUV] = useState<UVState>({ status: 'loading' });
  const [reminderSet, setReminderSet] = useState(false);

  // Live clock — updates every minute to drive greeting + AM/PM routine switch.
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Today's UV, fetched without prompting; the user asks for location explicitly.
  const loadUV = useCallback((ask: boolean) => {
    setUV({ status: 'loading' });
    fetchUV(ask).then(setUV);
  }, []);
  useEffect(() => { loadUV(false); }, [loadUV]);

  const hour     = now.getHours();
  const isPM     = hour >= 17;
  const slot     = isPM ? 'PM' : 'AM';
  const key      = routineKey(slot, now);
  const greeting = hour < 12 ? 'good morning' : hour < 17 ? 'good afternoon' : 'good evening';

  // Evening folds any missed morning steps into tonight (conflict-aware).
  const amDone  = completions.includes(routineKey('AM', now));
  const evening = isPM ? buildEveningRoutine(shelf, amDone, now) : null;
  const routine = evening ? evening.steps : buildRoutine(shelf, 'AM', now);
  const compensations = evening?.compensations ?? [];
  const carried = compensations.filter(c => c.action === 'carried');
  const dropped = compensations.filter(c => c.action === 'dropped');
  const carriedCats = new Set(carried.map(c => c.category));

  const done    = new Set(doneSteps[key] ?? []);
  const allDone = routine.length > 0 && routine.every(s => done.has(s.category));
  const finished = completions.includes(key);

  const primaryConcern = questionnaireAnswers.concern[0];
  const concernCats = new Set(primaryConcern ? (CONCERN_CATS[primaryConcern] ?? []) : []);
  const gaps = routineGaps(shelf, questionnaireAnswers.concern);

  const uvReading = uv.status === 'ok' ? uv.reading : null;
  const protectToday = !!uvReading && uvBand(uvReading.maxToday).protect;

  // Ticking SPF on a day that needs sun protection sets a 2-hour reapply reminder.
  const onToggle = async (category: ProductCategory) => {
    const wasDone = done.has(category);
    toggleStep(key, category);
    const nowDone = new Set(done);
    wasDone ? nowDone.delete(category) : nowDone.add(category);
    if (!finished && routine.length > 0 && routine.every(s => nowDone.has(s.category))) {
      completeRoutine(key, routine.map(s => s.category));
    }
    if (category === 'spf' && !wasDone && protectToday) {
      const at = new Date(Date.now() + 2 * 60 * 60 * 1000);
      setSpfReapplyAt(at.toISOString());
      setReminderSet(await scheduleSpfReapply(at));
    }
  };

  const ambientSteps: AmbientStep[] = routine.map(s => ({
    label:       STEP_LABEL[s.category],
    productName: s.name,
    duration:    Math.max(s.mins * 20, 15),
  }));

  // One top finding from the shelf's ingredient check (general notes stay on the Shelf).
  const topFinding = checkShelf(shelf, skinFeel).find(f => !f.quiet);

  // A trial that has run its course and is waiting for a verdict.
  const dueTrial = trials.find(t => trialDue(t, now) && shelf.some(p => p.id === t.productId));

  // Last month's recap, offered during the first week of a new month.
  const prevMonth = lastMonthKey(now);
  const prevRecap = prevMonth ? buildRecap(prevMonth, { completions, scans, shelf, trials }, now) : null;

  const days   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const dateStr = `${days[now.getDay()]} · ${months[now.getMonth()]} ${now.getDate()}`;
  const firstName = user?.name?.split(' ')[0]?.toLowerCase();
  const insight = getDailyInsight(lastScores, primaryConcern);
  const lastScan = [...scans].reverse().find(e => e.scores);
  const reapply = spfReapplyAt && new Date(spfReapplyAt) > now ? new Date(spfReapplyAt) : null;

  return (
    <View style={styles.root}>
      <Background />

      {showAmbient && (
        <AmbientModeOverlay
          steps={ambientSteps}
          onComplete={() => {
            completeRoutine(key, routine.map(s => s.category));
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
          {streak > 0 && (
            <View style={styles.streak}>
              <Svg width={14} height={14} viewBox="0 0 24 24">
                <Path d="M12 3c0 4-4 5-4 9a4 4 0 0 0 8 0c0-2-1-3-2-4 0 2-1 3-2 3 0-3 0-5 0-8z"
                  fill="none" stroke={C.warn} strokeWidth={1.6}
                  strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[T.num, { fontSize: 13, fontWeight: '600', color: C.warn }]}>{streak}</Text>
            </View>
          )}
        </View>

        {/* Date + greeting */}
        <View style={{ marginBottom: 14 }}>
          <Text style={[T.kicker, { marginBottom: 5 }]}>{dateStr}</Text>
          <Text style={[T.h1, { fontSize: 30 }]}>
            {greeting}
            {firstName && (
              <>,{' '}<Text style={{ fontStyle: 'italic', color: C.accentInk }}>{firstName}</Text></>
            )}
          </Text>
        </View>

        {/* DAILY BRIEF — real UV for where you are, plus one science-backed tip */}
        <FlutedGlass padding={14} style={{ marginBottom: 16 }}>
          <Text style={[T.kicker, { color: C.accent, marginBottom: 8 }]}>✦ DAILY BRIEF</Text>
          {uvReading ? (
            <View style={styles.uvRow}>
              <Sun size={18} strokeWidth={1.3} color={protectToday ? C.warn : C.sage} />
              <Text style={[T.bodySm, { color: C.ink2, flex: 1, lineHeight: 17 }]}>
                <Text style={{ fontWeight: '600' }}>UV {uvReading.now} now</Text>
                {' · '}peaks at {uvReading.maxToday} ({uvBand(uvReading.maxToday).label.toLowerCase()})
                {uvReading.peakHour !== null ? ` around ${uvReading.peakHour}:00` : ''}.{' '}
                {protectToday ? 'Wear SPF if you\'re out today.' : 'Low UV today.'}
              </Text>
            </View>
          ) : uv.status === 'denied' ? (
            <TouchableOpacity style={styles.uvRow} onPress={() => loadUV(true)} activeOpacity={0.7}>
              <Sun size={18} strokeWidth={1.3} color={C.ink3} />
              <Text style={[T.bodySm, { color: C.accentInk, flex: 1 }]}>Show today's UV index for where you are →</Text>
            </TouchableOpacity>
          ) : uv.status === 'error' ? (
            <TouchableOpacity style={styles.uvRow} onPress={() => loadUV(false)} activeOpacity={0.7}>
              <Sun size={18} strokeWidth={1.3} color={C.ink3} />
              <Text style={[T.bodySm, { color: C.ink3, flex: 1 }]}>Couldn't load today's UV. Tap to retry.</Text>
            </TouchableOpacity>
          ) : null}
          {reapply && (
            <Text style={[T.bodySm, { color: C.ink2, marginTop: 8, lineHeight: 17 }]}>
              Reapply SPF around <Text style={{ fontWeight: '600' }}>{hhmm(reapply)}</Text> if you're outdoors
              {reminderSet ? '. We\'ll remind you.' : '.'}
            </Text>
          )}
          <Text style={[T.bodySm, { color: C.ink2, lineHeight: 18, marginTop: 8 }]}>{insight}</Text>
          {lastScan ? (
            <TouchableOpacity onPress={() => onNavigate('progress')} activeOpacity={0.7}>
              <Text style={[T.bodySm, { color: C.ink3, marginTop: 8 }]}>
                Appearance {lastScan.scores!.overall} on your last scan ({shortDate(lastScan.date)}). See progress →
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => onNavigate('progress')} activeOpacity={0.7}>
              <Text style={[T.bodySm, { color: C.accentInk, marginTop: 8 }]}>Take your first progress photo →</Text>
            </TouchableOpacity>
          )}
          <Text style={[T.bodySm, { color: C.ink4, fontSize: 9, marginTop: 8 }]}>
            {insight.endsWith('*') ? '* Hughes et al., Annals of Internal Medicine, 2013. ' : ''}
            UV from Open-Meteo. Not medical advice.
          </Text>
        </FlutedGlass>

        {/* Monthly recap ready */}
        {prevMonth && prevRecap && !recapIsEmpty(prevRecap) && (
          <TouchableOpacity onPress={() => setRecapMonth(prevMonth)} activeOpacity={0.85}>
            <FlutedGlass padding={12} style={{ marginBottom: 14 }}>
              <View style={styles.uvRow}>
                <CalendarDays size={18} strokeWidth={1.3} color={C.accentInk} />
                <Text style={[T.bodySm, { color: C.ink2, flex: 1 }]}>
                  Your <Text style={{ fontWeight: '600' }}>{monthLabel(prevMonth).split(' ')[0]}</Text> recap is ready:{' '}
                  {prevRecap.routines} routines, {prevRecap.scans} scans →
                </Text>
              </View>
            </FlutedGlass>
          </TouchableOpacity>
        )}

        {/* "Is it working?" check-in once a trial has had a fair run */}
        {verdictShown ? (
          <FlutedGlass padding={12} style={[styles.trialCard, { marginBottom: 14 }]}>
            <Text style={[T.kicker, { color: C.accentInk, marginBottom: 4 }]}>{verdictShown.name.toUpperCase()}</Text>
            <Text style={[T.bodySm, { color: C.ink2, lineHeight: 17 }]}>{VERDICT_ADVICE[verdictShown.verdict]}</Text>
            <TouchableOpacity onPress={() => setVerdictShown(null)} style={{ marginTop: 8 }}>
              <Text style={[T.kicker, { color: C.ink3 }]}>DISMISS</Text>
            </TouchableOpacity>
          </FlutedGlass>
        ) : dueTrial && (
          <FlutedGlass padding={12} style={[styles.trialCard, { marginBottom: 14 }]}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Hourglass size={16} strokeWidth={1.3} color={C.accentInk} />
              <View style={{ flex: 1 }}>
                <Text style={[T.kicker, { color: C.accentInk, marginBottom: 4 }]}>IS IT WORKING?</Text>
                <Text style={[T.bodySm, { color: C.ink2, lineHeight: 17 }]}>
                  You've used <Text style={{ fontWeight: '600' }}>{dueTrial.productName}</Text> for {dueTrial.weeks} weeks,
                  long enough for {dueTrial.active} to show results. Compare your photos, then decide.
                </Text>
                <TouchableOpacity onPress={() => onNavigate('progress')}>
                  <Text style={[T.bodySm, { color: C.accentInk, marginTop: 6 }]}>Compare photos →</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.verdictRow}>
              {([['better', 'Better'], ['same', 'No change'], ['worse', 'Worse']] as const).map(([v, label]) => (
                <TouchableOpacity
                  key={v}
                  style={styles.verdictBtn}
                  onPress={() => {
                    setTrialVerdict(dueTrial.productId, v);
                    setVerdictShown({ name: dueTrial.productName, verdict: v });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[T.button, { fontSize: 12, color: C.ink }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </FlutedGlass>
        )}

        {/* Top ingredient clash, from the same checker the Shelf uses */}
        {topFinding && (
          <TouchableOpacity onPress={() => onNavigate('shelf')} activeOpacity={0.85}>
            <FlutedGlass padding={12} style={[styles.harmonizer, { marginBottom: 16 }]}>
              <Text style={[T.kicker, { color: C.warn, marginBottom: 4 }]}>✦ INGREDIENT CHECK</Text>
              <Text style={[T.bodySm, { color: C.ink2, lineHeight: 17 }]}>
                <Text style={{ fontWeight: '600' }}>{topFinding.title}.</Text> {topFinding.body}
              </Text>
            </FlutedGlass>
          </TouchableOpacity>
        )}

        {/* Routine */}
        <View style={styles.sectionHeader}>
          <Text style={[T.kicker, { flex: 1 }]}>{isPM ? 'THIS EVENING' : 'THIS MORNING'} · FROM YOUR SHELF</Text>
          <Text style={[T.num, { fontSize: 10, color: allDone ? C.sage : C.ink3 }]}>
            {allDone ? 'done ✓' : `${routine.filter(s => done.has(s.category)).length}/${routine.length} steps`}
          </Text>
        </View>

        {routine.length > 0 ? (
          <View style={styles.routineToolbar}>
            <TouchableOpacity style={styles.ambientBtn} onPress={() => setShowAmbient(true)} activeOpacity={0.8}>
              <Wind size={14} strokeWidth={1.2} color={C.accentInk} />
              <Text style={[T.button, { color: C.accentInk, fontSize: 11 }]}>Guide me</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => onNavigate('shelf')} activeOpacity={0.85}>
            <FlutedGlass padding={14} style={{ marginBottom: 10 }}>
              <Text style={[T.bodySm, { color: C.ink3, lineHeight: 17 }]}>
                Add the products you use on the Shelf tab, and your routine builds itself from them. →
              </Text>
            </FlutedGlass>
          </TouchableOpacity>
        )}

        {routine.map((step, i) => {
          const tag = carriedCats.has(step.category)
            ? 'carried from AM'
            : step.freq
              ? step.freq
            : concernCats.has(step.category) && primaryConcern
              ? `for your ${CONCERN_NAME[primaryConcern] ?? primaryConcern}`
              : undefined;
          return (
            <RoutineRow
              key={`${step.name}-${i}`}
              idx={i + 1}
              stepName={STEP_LABEL[step.category]}
              productName={step.name}
              why={WHY[step.category]}
              tag={tag}
              done={done.has(step.category)}
              onToggle={() => onToggle(step.category)}
            />
          );
        })}

        {/* Evening compensator note — what was folded in or held back */}
        {isPM && compensations.length > 0 && (
          <FlutedGlass padding={12} style={styles.compensator}>
            <Text style={[T.kicker, { color: C.accent, marginBottom: 6 }]}>✦ MISSED THIS MORNING</Text>
            {carried.length > 0 && (
              <Text style={[T.bodySm, { color: C.ink2, lineHeight: 17 }]}>
                Folded in {carried.map(c => c.step).join(', ')}: safe to do tonight.
              </Text>
            )}
            {dropped.map(d => (
              <Text key={d.step} style={[T.bodySm, { color: C.ink3, lineHeight: 17, marginTop: carried.length ? 6 : 0 }]}>
                <Text style={{ fontWeight: '600', color: C.ink2 }}>{d.step} held back</Text>: {d.reason}
              </Text>
            ))}
          </FlutedGlass>
        )}

        {/* Gaps — neutral searches by product type */}
        {gaps.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 18 }]}>
              <Text style={T.kicker}>GAPS IN YOUR ROUTINE</Text>
              <Text style={[T.num, { fontSize: 10, color: C.warn }]}>{gaps.length} missing</Text>
            </View>
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
                    onPress={() => Linking.openURL(
                      `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(BROWSE_QUERY[g.key])}`,
                    )}
                  >
                    <Text style={[T.button, { fontSize: 11 }]}>Browse →</Text>
                  </TouchableOpacity>
                </View>
              </FlutedGlass>
            ))}
          </>
        )}
      </ScrollView>

      <MonthlyRecap
        visible={recapMonth !== null}
        initialMonth={recapMonth ?? undefined}
        onClose={() => setRecapMonth(null)}
      />
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
  uvRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  routineToolbar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  ambientBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: R.md,
    backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accent + '55',
  },
  trialCard: { borderColor: C.accent + '66', backgroundColor: C.accentSoft },
  verdictRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  verdictBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: R.md, borderWidth: 1, borderColor: C.line2, backgroundColor: C.surface,
  },
  harmonizer: { borderColor: 'rgba(193,140,60,0.40)', backgroundColor: '#FEF6EC' },
  compensator: { marginTop: 4, marginBottom: 4, borderColor: C.accent + '44', backgroundColor: C.accentSoft },
  gapDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.warn, flexShrink: 0 },
  browseBtn: {
    borderWidth: 1, borderColor: C.accent + '80',
    borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: C.accentSoft,
  },
});
