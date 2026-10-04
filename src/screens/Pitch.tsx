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
  Sparkles, ScanBarcode, Wind, ScanFace, Globe, FlaskConical,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FaceLogo } from '../components/FaceLogo';
import { FlutedGlass } from '../components/FlutedGlass';
import { ScienceChart } from '../components/ScienceChart';
import { C, R, T, S } from '../tokens';

const ICON_SW = 1.2;

const FEATURES = [
  {
    Icon: ScanFace,
    title: 'AI face scan · 28 biomarkers',
    body: 'A MediaPipe face-mesh model reads hydration, texture, pores, redness and structural ratios from one front-camera frame — in under 3 seconds.',
  },
  {
    Icon: ScanBarcode,
    title: 'AI label recognizer · free',
    body: 'Photograph any product label and AI reads the brand, name and full ingredient list — with a barrier-aware warning when a formula clashes with your last scan.',
  },
  {
    Icon: Wind,
    title: 'Ambient Mode · hands-free',
    body: 'A calm, timed walkthrough guides each step of your routine so you never rush — with a Live Activity on your lock screen.',
  },
  {
    Icon: ScanFace,
    title: 'AR Sculpting guides',
    body: 'Live arrows over your camera show exactly how to drain, sculpt and lift — drawn from your own structural scan.',
  },
  {
    Icon: Globe,
    title: '7 heritage rituals',
    body: 'Japanese, Korean, Ayurvedic, French and more. AI picks the tradition that matches your biology and reshapes tomorrow\'s routine.',
  },
  {
    Icon: FlaskConical,
    title: 'Conflict Harmonizer',
    body: 'Your shelf is checked for clashing actives — retinol over a fatigued barrier, vitamin C timing — so nothing undercuts anything else.',
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
                Ready to awaken your skin's{'\n'}architectural potential?
              </Text>
            </View>

            <FlutedGlass padding={16} style={{ marginTop: 8 }}>
              <Text style={[T.kicker, { color: C.accent, marginBottom: 8 }]}>WHY PORELESS</Text>
              <Text style={[T.body, { color: C.ink2, lineHeight: 21 }]}>
                Most skincare apps sell you products. Poreless reads your actual skin,
                works with what you already own, and tracks whether it's genuinely
                improving — measured, not guessed.
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
              <Text style={{ fontStyle: 'italic', color: C.accentInk }}>measured</Text>
            </Text>
            <Text style={[T.bodySm, { color: C.ink3, marginBottom: 16, lineHeight: 18 }]}>
              Skin responds to adherence, correct sequencing and a protected barrier —
              not to buying more. Here's a typical 12-week skin-score trajectory.
            </Text>

            <FlutedGlass padding={14} style={{ marginBottom: 16 }}>
              <ScienceChart width={W - S.gutter * 2 - 28} height={190} />
            </FlutedGlass>

            <View style={{ gap: 10 }}>
              {[
                { n: '01', t: 'Right order, every time', b: 'Actives are layered thin-to-thick so each one penetrates before the next seals it in — the single biggest free lever on results.' },
                { n: '02', t: 'Barrier-first', b: 'Conflicts (e.g. retinol on a fatigued barrier) are flagged before they set you back, so progress compounds instead of resetting.' },
                { n: '03', t: 'Tracked, not guessed', b: 'Every scan logs 8 scores. Seeing the line move is what keeps the routine consistent — and consistency is what moves the line.' },
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
              * Illustrative trajectory based on adherence literature. Individual results vary.
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
                Free to start — the scanner, Ambient Mode, AR guides and Harmonizer
                are all included. No card required.
              </Text>
            </View>

            <FlutedGlass padding={14} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Sparkles size={24} strokeWidth={ICON_SW} color={C.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.body, { fontWeight: '600', color: C.ink }]}>True results. No filters.</Text>
                  <Text style={[T.bodySm, { color: C.ink3, marginTop: 3, lineHeight: 17 }]}>
                    Scores come from computer-vision models trained on dermatology datasets.
                    What you see is what your skin actually looks like.
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
