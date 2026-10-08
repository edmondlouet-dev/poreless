// Latest scores with a tap-to-expand explanation: which part of the face each
// score looks at, what it can and can't tell you, and what helps.
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import Svg, { Path, Ellipse } from 'react-native-svg';
import { FlutedGlass } from './FlutedGlass';
import type { SkinScores } from '../store';
import { C, R, T } from '../tokens';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Per-metric deep dive: which region, what it means, what to do ──────────────
type Zone = 'cheeks' | 'tzone' | 'undereye' | 'full' | 'jaw';
interface ScoreDetail { zone: Zone; region: string; meaning: string; tip: string; }

const SCORE_DETAIL: Record<string, ScoreDetail> = {
  Hydration: {
    zone: 'cheeks',
    region: 'Cheeks & midface',
    meaning: 'How dry or flaky skin looks in the photo. A camera can\'t measure skin water content, so treat this as a rough visual cue.',
    tip: 'Apply hyaluronic acid to damp skin within 60s of cleansing, then seal with moisturiser to lock it in.',
  },
  Texture: {
    zone: 'full',
    region: 'Forehead & cheeks',
    meaning: 'How smooth the surface looks in the photo. Lighting angle changes it a lot, so compare scans taken in similar light.',
    tip: 'A gentle chemical exfoliant (PHA/lactic) 2× weekly smooths texture without disrupting the barrier.',
  },
  Pores: {
    zone: 'tzone',
    region: 'Nose & inner cheeks (T-zone)',
    meaning: 'How visible pores look, usually most around the nose where oil glands cluster. Pore size is largely genetic.',
    tip: 'Niacinamide and BHA keep pores clear; avoid heavy occlusives over the T-zone.',
  },
  Oil: {
    zone: 'tzone',
    region: 'Forehead, nose & chin',
    meaning: 'How shiny the T-zone looks in the photo. A lower score means more visible shine.',
    tip: 'Niacinamide may help with oiliness over several weeks. Use a gentle cleanser rather than stripping the skin.',
  },
  Calm: {
    zone: 'cheeks',
    region: 'Cheeks & around the nose',
    meaning: 'How little redness shows in the photo. Exercise, heat and cold all flush skin for a while, and redness is harder to read on deeper skin tones.',
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

const ChevronRight = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24">
    <Path d="M9 6l6 6-6 6" stroke={C.ink3} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

interface Props {
  lastScores: SkinScores | null;
  prevScores: SkinScores | null;
}

export const ScoreDetails: React.FC<Props> = ({ lastScores, prevScores }) => {
  const [openScore, setOpenScore] = useState<string | null>(null);
  const toggleScore = (label: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(
      220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity,
    ));
    setOpenScore(prev => (prev === label ? null : label));
  };

  if (!lastScores) return null;
  return (
    <>
    {/* Metric scores — tap a row to expand the deep dive */}
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <Text style={[T.kicker, { flex: 1 }]}>LATEST SCORES</Text>
      <Text style={[T.kicker, { color: C.ink4, fontSize: 8 }]}>TAP FOR DETAIL</Text>
    </View>
    <View style={{ gap: 6, marginBottom: 18 }}>
      {(lastScores ? [
        { l: 'Hydration', v: lastScores.hydration, p: prevScores?.hydration },
        { l: 'Texture',   v: lastScores.texture,   p: prevScores?.texture },
        { l: 'Pores',     v: lastScores.pores,     p: prevScores?.pores },
        { l: 'Oil',       v: lastScores.oil,       p: prevScores?.oil },
        { l: 'Calm',      v: lastScores.redness,   p: prevScores?.redness },
      ] : []).map(m => {
        const isOpen = openScore === m.l;
        const detail = SCORE_DETAIL[m.l];
        return (
          <FlutedGlass key={m.l} padding={10} style={isOpen ? { borderColor: C.accent } : undefined}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => toggleScore(m.l)}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[T.kicker, { flex: 1 }]}>{m.l}</Text>
                <View style={styles.miniBarRow}>
                  {/* Previous scan (grey) and latest (accent): real readings only */}
                  {(m.p !== undefined ? [m.p, m.v] : [m.v]).map((v, i, all) => (
                    <View key={i} style={[styles.microBar, {
                      height: Math.round(14 * v / 100),
                      backgroundColor: i === all.length - 1 ? C.accent : C.surface3,
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
                    <Text style={[T.kicker, { color: C.ink3, marginBottom: 4 }]}>WHAT THIS SHOWS</Text>
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
    </>
  );
};

const styles = StyleSheet.create({
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
});
