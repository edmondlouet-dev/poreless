/**
 * Business pitch / value-prop onboarding.
 * Shown once on first install. A swipeable multi-page intro:
 *   1 · Welcome           2 · Standout features
 *   3 · The science (with vs without)   4 · Begin + legal
 * Never shown again after account creation.
 */
import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import {
  Sparkles, ScanFace, FlaskConical, Hourglass, Sun, CalendarDays,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FaceLogo } from '../components/FaceLogo';
import { FlutedGlass } from '../components/FlutedGlass';
import { C, R, T, S } from '../tokens';

const ICON_SW = 1.2;

const FEATURES = [
  {
    Icon: FlaskConical,
    title: 'A routine built from your shelf',
    body: 'Add what you own by search or a label photo. Poreless puts it in the right order, morning and evening, and flags ingredients that clash.',
  },
  {
    Icon: Hourglass,
    title: '"Is it working?" timer',
    body: 'Most actives need 6–12 weeks. Poreless tells you how long each one usually takes, and asks for a verdict only when it\'s had a fair run.',
  },
  {
    Icon: ScanFace,
    title: 'Progress photos that line up',
    body: 'A faint outline of your last photo helps you match the angle each time. Compare before and after, and get an AI estimate of how your skin looks.',
  },
  {
    Icon: Sun,
    title: 'Real UV, real reminders',
    body: 'Today\'s UV index for where you are, and a nudge to reapply SPF when it matters.',
  },
  {
    Icon: CalendarDays,
    title: 'Monthly recap',
    body: 'Routines done, how consistent you were, and your first and last photo of the month side by side.',
  },
];

// Module-scope so it isn't recreated each render (which would remount every
// page and restart the chart animation whenever the active page changes).
const PageScroll: React.FC<{ width: number; paddingTop: number; children: React.ReactNode }> = ({
  width, paddingTop, children,
}) => (
  <ScrollView
    style={{ width }}
    contentContainerStyle={[styles.pageContent, { paddingTop }]}
    showsVerticalScrollIndicator={false}
  >
    {children}
  </ScrollView>
);

interface Props { onContinue: () => void }

export const Pitch: React.FC<Props> = ({ onContinue }) => {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const NUM_PAGES = 4;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / W));
  };

  const next = () => {
    if (page >= NUM_PAGES - 1) { onContinue(); return; }
    scrollRef.current?.scrollTo({ x: (page + 1) * W, animated: true });
    setPage(page + 1);
  };

  const pt = insets.top + 28;

  return (
    <View style={styles.root}>
      <Background />
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          scrollEventThrottle={16}
        >
          {/* ── Page 1 · Welcome ───────────────────────────────────────── */}
          <PageScroll width={W} paddingTop={pt}>
            <View style={styles.hero}>
              <FaceLogo size={64} animated color={C.ink} />
              <Text style={styles.wordmark}>poreless.</Text>
              <Text style={[T.h2, { textAlign: 'center', marginTop: 6, fontSize: 22, color: C.ink }]}>
                Hey there.
              </Text>
              <Text style={[T.bodySm, { color: C.ink3, textAlign: 'center', marginTop: 10, lineHeight: 20, fontSize: 15, fontFamily: 'CormorantGaramond_400Italic' }]}>
                Skincare that's honest{'\n'}about what works.
              </Text>
            </View>

            <FlutedGlass padding={16} style={{ marginTop: 8 }}>
              <Text style={[T.kicker, { color: C.accent, marginBottom: 8 }]}>WHY PORELESS</Text>
              <Text style={[T.body, { color: C.ink2, lineHeight: 21 }]}>
                Most skincare apps sell you products. Poreless works with what you
                already own, checks it against published dermatology guidance, and
                helps you see whether it's actually working.
              </Text>
            </FlutedGlass>

            <View style={styles.swipeHint}>
              <Text style={[T.kicker, { color: C.ink3 }]}>SWIPE TO EXPLORE →</Text>
            </View>
          </PageScroll>

          {/* ── Page 2 · Standout features ─────────────────────────────── */}
          <PageScroll width={W} paddingTop={pt}>
            <Text style={[T.kicker, { color: C.accent, marginBottom: 6 }]}>WHAT'S INSIDE</Text>
            <Text style={[T.h1, { fontSize: 30, marginBottom: 16 }]}>
              everything,{' '}
              <Text style={{ fontStyle: 'italic', color: C.accentInk }}>in one place</Text>
            </Text>
            <View style={{ gap: 10 }}>
              {FEATURES.map((f, i) => (
                <FlutedGlass key={i} padding={14}>
                  <View style={styles.featureRow}>
                    <View style={styles.featureIconWrap}>
                      <f.Icon size={24} strokeWidth={ICON_SW} color={C.accentInk} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[T.body, { fontWeight: '600', fontSize: 14, color: C.ink }]}>{f.title}</Text>
                      <Text style={[T.bodySm, { color: C.ink3, marginTop: 4, lineHeight: 17 }]}>{f.body}</Text>
                    </View>
                  </View>
                </FlutedGlass>
              ))}
            </View>
          </PageScroll>

          {/* ── Page 3 · The science ───────────────────────────────────── */}
          <PageScroll width={W} paddingTop={pt}>
            <Text style={[T.kicker, { color: C.accent, marginBottom: 6 }]}>THE SCIENCE</Text>
            <Text style={[T.h1, { fontSize: 30, marginBottom: 10 }]}>
              consistency,{' '}
              <Text style={{ fontStyle: 'italic', color: C.accentInk }}>over hype</Text>
            </Text>
            <Text style={[T.bodySm, { color: C.ink3, marginBottom: 16, lineHeight: 18 }]}>
              Skin responds to using the right few products consistently, not to buying more.
            </Text>

            <View style={{ gap: 10 }}>
              {[
                { n: '01', t: 'Daily SPF first', b: 'In a 4.5-year trial, people who used sunscreen daily showed about 24% less skin ageing than those who used it at their own discretion.*' },
                { n: '02', t: 'Give it time', b: 'Retinoids and vitamin C usually need 8–12 weeks, salicylic acid 6–8. Switching sooner means never finding out what works.' },
                { n: '03', t: 'Fewer clashes', b: 'Some actives irritate when stacked, like a retinoid and an acid on the same night. Poreless flags them so you can space them out.' },
              ].map(s => (
                <View key={s.n} style={styles.sciRow}>
                  <Text style={[T.num, { fontSize: 12, color: C.accent, width: 24 }]}>{s.n}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontWeight: '600', fontSize: 13, color: C.ink }]}>{s.t}</Text>
                    <Text style={[T.bodySm, { color: C.ink3, marginTop: 2, lineHeight: 17 }]}>{s.b}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={[T.bodySm, { color: C.ink4, fontSize: 9, marginTop: 14, lineHeight: 14 }]}>
              * Hughes et al., Annals of Internal Medicine, 2013. Individual results vary.
            </Text>
          </PageScroll>

          {/* ── Page 4 · Begin ─────────────────────────────────────────── */}
          <PageScroll width={W} paddingTop={pt}>
            <View style={styles.hero}>
              <FaceLogo size={56} color={C.ink} />
              <Text style={[T.h1, { fontSize: 32, textAlign: 'center', marginTop: 16 }]}>
                ready when{'\n'}you are
              </Text>
              <Text style={[T.bodySm, { color: C.ink3, textAlign: 'center', marginTop: 10, lineHeight: 18 }]}>
                Free to start. Your shelf, routine, scans, progress photos and monthly
                recap are all included. No card required.
              </Text>
            </View>

            <FlutedGlass padding={14} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Sparkles size={24} strokeWidth={ICON_SW} color={C.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.body, { fontWeight: '600', color: C.ink }]}>True results. No filters.</Text>
                  <Text style={[T.bodySm, { color: C.ink3, marginTop: 3, lineHeight: 17 }]}>
                    Scores are AI estimates of how your skin looks in each photo. Light, camera and
                    makeup affect them, so Poreless tracks the trend, not one number.
                  </Text>
                </View>
              </View>
            </FlutedGlass>

            <Text style={styles.disclaimer}>
              Poreless is a wellness and skincare-tracking tool. It does not constitute medical
              advice and is not a substitute for professional dermatological assessment.
              AI skin scores are estimates based on image analysis — individual results vary.
              Consult a qualified dermatologist for clinical concerns, diagnosed conditions,
              or prescription treatment.{'\n\n'}
              Product efficacy claims are based on published literature and may not apply to
              all skin types. Poreless does not endorse any specific product brand.
            </Text>
          </PageScroll>
        </ScrollView>

        {/* Bottom controls: dots + button */}
        <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.dotRow}>
            {Array.from({ length: NUM_PAGES }).map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
          <TouchableOpacity style={styles.cta} onPress={next} activeOpacity={0.85}>
            <Text style={[T.button, { color: C.bg, fontSize: 15 }]}>
              {page >= NUM_PAGES - 1 ? 'Begin →' : 'Continue →'}
            </Text>
          </TouchableOpacity>
          {page < NUM_PAGES - 1 && (
            <TouchableOpacity onPress={onContinue} activeOpacity={0.7} style={styles.skip}>
              <Text style={[T.kicker, { color: C.ink3 }]}>SKIP</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  pageContent: { paddingHorizontal: S.gutter, paddingBottom: 180 },
  hero: { alignItems: 'center', marginBottom: 24 },
  wordmark: {
    fontFamily: 'CormorantGaramond_400Italic',
    fontSize: 52, letterSpacing: -1, color: C.ink, marginTop: 12,
  },
  swipeHint: { alignItems: 'center', marginTop: 28 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  featureIconWrap: {
    width: 40, height: 40, borderRadius: R.md,
    backgroundColor: C.accentSoft,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sciRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: S.gutter, paddingTop: 12,
    backgroundColor: 'transparent',
  },
  dotRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.line2 },
  dotActive: { backgroundColor: C.accent, width: 20 },
  cta: {
    backgroundColor: C.ink, borderRadius: R.md,
    paddingVertical: 16, alignItems: 'center',
  },
  skip: { alignItems: 'center', paddingVertical: 12 },
  disclaimer: {
    fontFamily: 'Inter_400Regular', fontSize: 10, color: C.ink4,
    textAlign: 'center', lineHeight: 15, marginBottom: 8,
  },
});
