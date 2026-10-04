import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Dimensions, LayoutAnimation, Platform, UIManager, Modal,
} from 'react-native';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FaceLogo } from '../components/FaceLogo';
import { FlutedGlass } from '../components/FlutedGlass';
import { useStore } from '../store';
import { C, R, T, S } from '../tokens';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: W } = Dimensions.get('window');
const MAX_BAR_H = 80;

// ── Per-metric deep dive: which region, what it means, what to do ──────────────
type Zone = 'cheeks' | 'tzone' | 'undereye' | 'full' | 'jaw';
interface ScoreDetail { zone: Zone; region: string; meaning: string; tip: string; }

const SCORE_DETAIL: Record<string, ScoreDetail> = {
  Hydration: {
    zone: 'cheeks',
    region: 'Cheeks & midface',
    meaning: 'Measures surface moisture and how plump the stratum corneum reads. The cheeks lose water fastest, so they set this score.',
    tip: 'Apply hyaluronic acid to damp skin within 60s of cleansing, then seal with moisturiser to lock it in.',
  },
  Texture: {
    zone: 'full',
    region: 'Forehead & cheeks',
    meaning: 'Reads micro-roughness and evenness across the face — the smoothness of light reflecting off the surface.',
    tip: 'A gentle chemical exfoliant (PHA/lactic) 2× weekly smooths texture without disrupting the barrier.',
  },
  Pores: {
    zone: 'tzone',
    region: 'Nose & inner cheeks (T-zone)',
    meaning: 'Estimates visible pore size and congestion. Pores read largest where sebaceous glands cluster — around the nose.',
    tip: 'Niacinamide and BHA keep pores clear; avoid heavy occlusives over the T-zone.',
  },
  Oil: {
    zone: 'tzone',
    region: 'Forehead, nose & chin',
    meaning: 'Tracks sebum across the T-zone. A lower score means more shine and a higher risk of congestion.',
    tip: 'Niacinamide regulates sebum by up to ~52% with consistent AM use. Don\'t over-strip — it rebounds oilier.',
  },
  Calm: {
    zone: 'cheeks',
    region: 'Cheeks & around the nose',
    meaning: 'Inverse of redness — diffuse flushing and reactivity concentrate on the cheeks and nasal folds.',
    tip: 'Fragrance-free, barrier-first formulas (ceramides, centella) keep this high. Patch-test new actives.',
  },
};

// Compact face diagram with the relevant zone highlighted.
const FaceZone: React.FC<{ zone: Zone }> = ({ zone }) => {
  const hl = C.accent;
  return (
    <Svg width={56} height={68} viewBox="0 0 60 72">
      {/* face outline */}
      <Ellipse cx={30} cy={34} rx={20} ry={26} fill="none" stroke={C.ink4} strokeWidth={1.1} />
      {/* zones */}
      {zone === 'cheeks' && (
        <>
          <Ellipse cx={19} cy={40} rx={6} ry={8} fill={hl} opacity={0.22} />
          <Ellipse cx={41} cy={40} rx={6} ry={8} fill={hl} opacity={0.22} />
        </>
      )}
      {zone === 'tzone' && (
        <Path d="M 22 16 L 38 16 L 35 30 L 33 46 L 27 46 L 25 30 Z" fill={hl} opacity={0.22} />
      )}
      {zone === 'undereye' && (
        <>
          <Path d="M 13 30 Q 19 36 25 30" fill="none" stroke={hl} strokeWidth={2.4} opacity={0.5} strokeLinecap="round" />
          <Path d="M 35 30 Q 41 36 47 30" fill="none" stroke={hl} strokeWidth={2.4} opacity={0.5} strokeLinecap="round" />
        </>
      )}
      {zone === 'jaw' && (
        <Path d="M 12 44 Q 30 64 48 44" fill="none" stroke={hl} strokeWidth={3} opacity={0.45} strokeLinecap="round" />
      )}
      {zone === 'full' && (
        <Ellipse cx={30} cy={34} rx={16} ry={22} fill={hl} opacity={0.14} />
      )}
    </Svg>
  );
};

const DAYS_DATA = [
  { day: 'S', score: 71, isToday: false },
  { day: 'M', score: 74, isToday: false },
  { day: 'T', score: 72, isToday: false },
  { day: 'W', score: 75, isToday: false },
  { day: 'T', score: 76, isToday: false },
  { day: 'F', score: 77, isToday: false },
  { day: 'S', score: 78, isToday: true  },
];

const MiniAnimBar: React.FC<{ score: number; isToday: boolean; day: string; delay: number }> = ({
  score, isToday, day, delay,
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(anim, { toValue: 1, duration: 500, useNativeDriver: false }).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);
  const h = anim.interpolate({ inputRange: [0,1], outputRange: [0, (score/100)*MAX_BAR_H] });
  return (
    <View style={styles.barCol}>
      <View style={[styles.barTrack, { height: MAX_BAR_H }]}>
        <Animated.View style={[styles.bar, { backgroundColor: isToday ? C.accent : C.ink, height: h }]} />
      </View>
      <Text style={[T.kicker, { color: C.ink3, marginTop: 3, letterSpacing: 0, fontSize: 9 }]}>{day}</Text>
    </View>
  );
};

const ChevronRight = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24">
    <Path d="M9 6l6 6-6 6" stroke={C.ink3} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const MENU_ITEMS = [
  { label: 'My products',    icon: '◈', screen: 'products' },
  { label: 'Settings',       icon: '◐', screen: 'settings' },
  { label: 'Skin profile',   icon: '◉', screen: null },
  { label: 'Privacy',        icon: '◌', screen: null },
  { label: 'About Poreless', icon: '◯', screen: null },
];

interface Props {
  onProducts?: () => void;
  onSettings?: () => void;
}

type InfoModal = 'skin' | 'privacy' | 'about' | null;

const SKINTYPE_LABEL: Record<string, string> = {
  oily: 'Oily', dry: 'Dry', combo: 'Combination', normal: 'Normal', sensitive: 'Sensitive',
};
const CONCERN_LABEL: Record<string, string> = {
  acne: 'Acne & breakouts', dryness: 'Dryness', darkspots: 'Dark spots',
  texture: 'Texture & pores', redness: 'Redness & sensitivity', aging: 'Fine lines & aging',
};

const InfoRow: React.FC<{ label: string; value: string; last?: boolean }> = ({ label, value, last }) => (
  <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 9, gap: 16 },
    !last && { borderBottomWidth: 1, borderBottomColor: C.line }]}>
    <Text style={[T.bodySm, { color: C.ink3 }]}>{label}</Text>
    <Text style={[T.bodySm, { color: C.ink, fontWeight: '600', flex: 1, textAlign: 'right' }]}>{value}</Text>
  </View>
);

export const You: React.FC<Props> = ({ onProducts, onSettings }) => {
  const insets = useSafeAreaInsets();
  const { user, streak, lastScores, logout, questionnaireAnswers, faceMetrics } = useStore();
  const [openScore, setOpenScore] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<InfoModal>(null);

  const displayName = user?.name ?? 'Alex Chen';
  const isPremium   = user?.premium ?? false;

  const toggleScore = (label: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(
      220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity,
    ));
    setOpenScore(prev => (prev === label ? null : label));
  };

  return (
    <View style={styles.root}>
      <Background />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar — face logo, not scan portrait */}
        <View style={styles.profileTop}>
          <View style={styles.avatarWrap}>
            <FaceLogo size={52} color={C.ink2} strokeWidth={1.2} />
          </View>
          {isPremium && (
            <View style={styles.premiumBadge}>
              <Text style={[T.pill, { color: C.accent }]}>✦ LIFETIME PREMIUM</Text>
            </View>
          )}
          <Text style={[T.h2, { marginTop: 10 }]}>{displayName}</Text>
          <Text style={[T.kicker, { color: C.ink3, marginTop: 5, textAlign: 'center' }]}>
            MEMBER · {streak + 73} DAYS
          </Text>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            { value: String(streak), label: 'Day streak' },
            { value: '87',           label: 'Routines done' },
            { value: '23',           label: 'Scans taken' },
          ].map(stat => (
            <FlutedGlass key={stat.label} padding={12} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[T.num, { fontSize: 22, fontWeight: '600', textAlign: 'center' }]}>
                {stat.value}
              </Text>
              <Text style={[T.kicker, { color: C.ink3, textAlign: 'center', marginTop: 3, letterSpacing: 0.4 }]}>
                {stat.label}
              </Text>
            </FlutedGlass>
          ))}
        </View>

        {/* Trend section (moved here from TREND tab) */}
        <Text style={[T.kicker, { marginBottom: 8 }]}>TREND · 7 DAYS</Text>
        <FlutedGlass padding={14} style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
            <Text style={[T.num, { fontSize: 36, fontWeight: '700' }]}>
              {lastScores?.overall ?? 78}
            </Text>
            <View style={{ backgroundColor: C.sageSoft, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={[T.pill, { color: C.sage }]}>+3 this week</Text>
            </View>
          </View>
          <View style={styles.chartRow}>
            {DAYS_DATA.map((d, i) => (
              <MiniAnimBar key={i} score={d.score} isToday={d.isToday} day={d.day} delay={i * 60} />
            ))}
          </View>
        </FlutedGlass>

        {/* Metric scores — tap a row to expand the deep dive */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={[T.kicker, { flex: 1 }]}>LATEST SCORES</Text>
          <Text style={[T.kicker, { color: C.ink4, fontSize: 8 }]}>TAP FOR DETAIL</Text>
        </View>
        <View style={{ gap: 6, marginBottom: 18 }}>
          {[
            { l: 'Hydration', v: lastScores?.hydration ?? 82 },
            { l: 'Texture',   v: lastScores?.texture   ?? 74 },
            { l: 'Pores',     v: lastScores?.pores      ?? 69 },
            { l: 'Oil',       v: lastScores?.oil        ?? 55 },
            { l: 'Calm',      v: lastScores?.redness    ?? 88 },
          ].map(m => {
            const isOpen = openScore === m.l;
            const detail = SCORE_DETAIL[m.l];
            return (
              <FlutedGlass key={m.l} padding={10} style={isOpen ? { borderColor: C.accent } : undefined}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => toggleScore(m.l)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[T.kicker, { flex: 1 }]}>{m.l}</Text>
                    <View style={styles.miniBarRow}>
                      {[0.6, 0.65, 0.68, 0.7, 0.72, 0.74, m.v/100].map((p, i) => (
                        <View key={i} style={[styles.microBar, {
                          height: Math.round(14 * p),
                          backgroundColor: i === 6 ? C.accent : C.surface3,
                        }]} />
                      ))}
                    </View>
                    <Text style={[T.num, { fontSize: 18, fontWeight: '600', marginLeft: 12, width: 34, textAlign: 'right' }]}>
                      {m.v}
                    </Text>
                    <View style={[styles.scoreChevron, isOpen && { transform: [{ rotate: '90deg' }] }]}>
                      <ChevronRight />
                    </View>
                  </View>
                </TouchableOpacity>

                {isOpen && detail && (
                  <View style={styles.scoreDetail}>
                    <View style={styles.detailDivider} />
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={styles.faceZoneWrap}>
                        <FaceZone zone={detail.zone} />
                        <Text style={[T.kicker, { color: C.accent, fontSize: 8, marginTop: 4, textAlign: 'center' }]}>
                          {detail.region.toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[T.kicker, { color: C.ink3, marginBottom: 4 }]}>WHAT THIS MEASURES</Text>
                        <Text style={[T.bodySm, { color: C.ink2, lineHeight: 17 }]}>{detail.meaning}</Text>
                      </View>
                    </View>
                    <View style={styles.tipBox}>
                      <Text style={[T.kicker, { color: C.accent, marginBottom: 3 }]}>✦ HOW TO IMPROVE</Text>
                      <Text style={[T.bodySm, { color: C.ink2, lineHeight: 17 }]}>{detail.tip}</Text>
                    </View>
                  </View>
                )}
              </FlutedGlass>
            );
          })}
        </View>

        {/* Menu list */}
        <Text style={[T.kicker, { marginBottom: 8 }]}>ACCOUNT</Text>
        <View style={styles.menuList}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuRow, i < MENU_ITEMS.length-1 && styles.menuRowBorder]}
              onPress={() => {
                if (item.screen === 'products') onProducts?.();
                else if (item.screen === 'settings') onSettings?.();
                else if (item.label === 'Skin profile')   setInfoModal('skin');
                else if (item.label === 'Privacy')        setInfoModal('privacy');
                else if (item.label === 'About Poreless') setInfoModal('about');
              }}
              activeOpacity={0.6}
            >
              <Text style={[T.body, { color: C.ink3, marginRight: 10 }]}>{item.icon}</Text>
              <Text style={[T.body, { flex: 1, fontWeight: '500', color: C.ink }]}>{item.label}</Text>
              <ChevronRight />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.signOut} onPress={logout} activeOpacity={0.7}>
          <Text style={[T.button, { color: C.ink3 }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Skin profile / Privacy / About — info sheets */}
      <Modal
        visible={infoModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setInfoModal(null)}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={[T.h2, { fontSize: 18 }]}>
              {infoModal === 'skin' ? 'Skin profile' : infoModal === 'privacy' ? 'Privacy' : 'About Poreless'}
            </Text>
            <TouchableOpacity onPress={() => setInfoModal(null)} activeOpacity={0.7}>
              <Text style={[T.body, { color: C.ink3, fontSize: 18 }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: S.gutter, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

            {infoModal === 'skin' && (
              <>
                <Text style={[T.kicker, { marginBottom: 8 }]}>FROM YOUR ONBOARDING</Text>
                <FlutedGlass padding={14} style={{ marginBottom: 12 }}>
                  <InfoRow label="Skin type" value={(questionnaireAnswers.skintype.map(s => SKINTYPE_LABEL[s] ?? s).join(', ')) || 'Not set'} />
                  <InfoRow label="Top concerns" value={(questionnaireAnswers.concern.map(c => CONCERN_LABEL[c] ?? c).join(', ')) || 'Not set'} />
                  <InfoRow label="Goals" value={questionnaireAnswers.goals.length ? `${questionnaireAnswers.goals.length} selected` : 'Not set'} />
                  <InfoRow label="Age range" value={questionnaireAnswers.age[0] ?? 'Not set'} last />
                </FlutedGlass>
                <Text style={[T.kicker, { marginBottom: 8 }]}>LATEST STRUCTURAL READ</Text>
                <FlutedGlass padding={14}>
                  <InfoRow label="Canthal tilt" value={`${faceMetrics.canthalTilt}°`} />
                  <InfoRow label="Midface ratio" value={faceMetrics.midfaceRatio.toFixed(2)} />
                  <InfoRow label="Fluid retention" value={faceMetrics.fluidRetention} />
                  <InfoRow label="Barrier" value={faceMetrics.barrierStatus} last />
                </FlutedGlass>
                <Text style={[T.bodySm, { color: C.ink4, marginTop: 14, lineHeight: 17 }]}>
                  Your profile shapes the routine, gaps, and daily brief. Re-run a scan any time to update it.
                </Text>
              </>
            )}

            {infoModal === 'privacy' && (
              <>
                {[
                  ['On-device first', 'Camera frames for skin and structural analysis are processed for scoring and are not stored or uploaded unless you explicitly save them.'],
                  ['Your data', 'Your shelf, scores, and profile live on this device. Sign-in details are used only to authenticate you.'],
                  ['AI processing', 'When AI features are enabled, only the minimum needed (a frame or label text) is sent to the model to return your result.'],
                  ['No selling', 'We never sell your data or skin metrics to third parties. Ever.'],
                  ['Your control', 'You can remove any product, clear your shelf, or sign out at any time.'],
                ].map(([h, b]) => (
                  <FlutedGlass key={h} padding={14} style={{ marginBottom: 10 }}>
                    <Text style={[T.body, { fontWeight: '600', marginBottom: 4 }]}>{h}</Text>
                    <Text style={[T.bodySm, { color: C.ink3, lineHeight: 17 }]}>{b}</Text>
                  </FlutedGlass>
                ))}
              </>
            )}

            {infoModal === 'about' && (
              <>
                <View style={{ alignItems: 'center', marginVertical: 16 }}>
                  <FaceLogo size={56} color={C.ink2} strokeWidth={1.2} />
                  <Text style={[T.h2, { marginTop: 10 }]}>Poreless</Text>
                  <Text style={[T.kicker, { color: C.ink3, marginTop: 4 }]}>VERSION 1.0.0</Text>
                </View>
                <FlutedGlass padding={14} style={{ marginBottom: 10 }}>
                  <Text style={[T.bodySm, { color: C.ink2, lineHeight: 18 }]}>
                    Poreless blends editorial skincare with measurable analysis — surface skin scoring,
                    facial proportions, ingredient conflict checks, and rituals drawn from traditions worldwide.
                  </Text>
                </FlutedGlass>
                <FlutedGlass padding={14}>
                  <Text style={[T.bodySm, { color: C.ink3, lineHeight: 17 }]}>
                    Powered by peer-reviewed research. Not medical advice — always consult a dermatologist
                    for clinical concerns.
                  </Text>
                </FlutedGlass>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: S.gutter },
  profileTop: { alignItems: 'center', marginBottom: 20 },
  avatarWrap: {
    width: 88, height: 88,
    borderRadius: 44,
    backgroundColor: C.surface2,
    borderWidth: 1.5,
    borderColor: C.glassBorder,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  premiumBadge: {
    marginTop: 8,
    backgroundColor: C.accentSoft,
    borderRadius: R.pill,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: C.accent + '44',
  },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  barCol: { alignItems: 'center', flex: 1 },
  barTrack: { width: 6, backgroundColor: C.surface3, borderRadius: 3, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: 6, borderRadius: 3 },
  miniBarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 18 },
  microBar: { width: 4, borderRadius: 2 },
  scoreChevron: { marginLeft: 8, width: 14, alignItems: 'center' },
  scoreDetail: { marginTop: 10 },
  detailDivider: { height: 1, backgroundColor: C.line, marginBottom: 10 },
  faceZoneWrap: {
    width: 72, alignItems: 'center', justifyContent: 'flex-start',
    paddingTop: 2,
  },
  tipBox: {
    marginTop: 10, padding: 10,
    backgroundColor: C.accentSoft, borderRadius: R.md,
  },
  menuList: {
    backgroundColor: C.surface,
    borderRadius: R.lg,
    borderWidth: 1, borderColor: C.line,
    marginBottom: 16, overflow: 'hidden',
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  signOut: { alignItems: 'center', paddingVertical: 16 },
  sheet: { flex: 1, backgroundColor: C.bg, paddingTop: 16 },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: S.gutter, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
});
