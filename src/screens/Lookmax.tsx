import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions,
} from 'react-native';
import Svg, { Ellipse, Path, Line, Circle, G, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { MetricStrip } from '../components/MetricStrip';
import { FlutedGlass } from '../components/FlutedGlass';
import { C, R, T, S } from '../tokens';

const { width: W } = Dimensions.get('window');
const DIAGRAM_SIZE = Math.min(W - S.gutter * 2, 280);

const LM_METRICS = [
  { key: 'overall', value: '7.4', label: 'Overall', dot: 'good' as const },
  { key: 'jaw',     value: '6.8', label: 'Jaw',     dot: 'good' as const },
  { key: 'canthal', value: '8.1', label: 'Canthal', dot: 'good' as const },
  { key: 'midface', value: '7.2', label: 'Midface', dot: 'good' as const },
  { key: 'skin',    value: '7.8', label: 'Skin',    dot: 'good' as const },
];

// Line-art face diagram (SVG)
const FaceDiagram: React.FC<{ size: number }> = ({ size }) => {
  const cx = size / 2;
  const s = { fill: 'none', stroke: C.ink3, strokeWidth: 0.9, strokeLinecap: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 200 230">
      {/* Oval face */}
      <Ellipse cx={100} cy={115} rx={58} ry={78} {...s} />
      {/* Hairline */}
      <Path d="M 55 65 Q 100 40 145 65" {...s} />
      {/* Brow ridge */}
      <Path d="M 68 88 Q 80 83 93 88" {...s} />
      <Path d="M 107 88 Q 120 83 132 88" {...s} />
      {/* Eyes */}
      <Ellipse cx={82} cy={100} rx={14} ry={7} {...s} />
      <Ellipse cx={118} cy={100} rx={14} ry={7} {...s} />
      {/* Pupils */}
      <Circle cx={82} cy={100} r={3} fill={C.ink4} />
      <Circle cx={118} cy={100} r={3} fill={C.ink4} />
      {/* Nose */}
      <Path d="M 96 100 L 92 128 Q 100 132 108 128 L 104 100" {...s} />
      {/* Nostrils */}
      <Path d="M 88 128 Q 92 134 100 132 Q 108 134 112 128" {...s} />
      {/* Lips */}
      <Path d="M 85 152 Q 100 148 115 152" {...s} />
      <Path d="M 85 152 Q 100 162 115 152" {...s} />
      <Path d="M 85 152 Q 100 157 115 152" {...s} strokeDasharray="2 2" />
      {/* Chin */}
      <Path d="M 80 175 Q 100 188 120 175" {...s} />
      {/* Landmark dots */}
      {[
        [100, 37],   // hairline center
        [82, 100],   // left eye
        [118, 100],  // right eye
        [100, 132],  // nose base
        [100, 157],  // lips center
        [100, 188],  // chin
      ].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={2} fill={C.accentSoft} stroke={C.accent} strokeWidth={0.8} />
      ))}
      {/* Canthal tilt line */}
      <Line x1={68} y1={96} x2={132} y2={104} stroke={C.accent} strokeOpacity={0.4} strokeWidth={0.7} strokeDasharray="3 3" />
      {/* Midface ratio line */}
      <Line x1={100} y1={65} x2={100} y2={185} stroke={C.ink4} strokeOpacity={0.5} strokeWidth={0.5} strokeDasharray="2 4" />
    </Svg>
  );
};

export const Lookmax: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState('overall');

  return (
    <View style={styles.root}>
      <Background mode="lookmax" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 8, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.badgeRow}>
              <Text style={[T.kicker, { color: C.accent }]}>✦ LOOKMAXING MODE</Text>
            </View>
            <Text style={[T.h1, { fontSize: 34, marginTop: 4 }]}>
              facial{' '}
              <Text style={{ fontStyle: 'italic', color: C.accentInk }}>structure</Text>
            </Text>
            <Text style={[T.bodySm, { color: C.ink3, marginTop: 4 }]}>
              beyond skin · ratios · angles · improvements
            </Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 18, color: C.ink3 }}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Score strip */}
        <View style={{ marginBottom: 16 }}>
          <MetricStrip metrics={LM_METRICS} active={active} onPick={setActive} />
        </View>

        {/* Face diagram */}
        <FlutedGlass padding={16} mode="lookmax" style={{ marginBottom: 14 }}>
          <View style={styles.diagramWrap}>
            <FaceDiagram size={DIAGRAM_SIZE} />
          </View>
        </FlutedGlass>

        {/* Footer metric row */}
        <View style={styles.footer}>
          <Text style={[T.kicker, { color: C.ink3 }]}>METRICS — OVERALL</Text>
          <Text style={[T.kicker, { color: C.ink3 }]}>SCAN · 18H AGO</Text>
        </View>

        {/* Insights */}
        <Text style={[T.kicker, { marginBottom: 8, marginTop: 8 }]}>INSIGHTS</Text>
        {[
          {
            title: 'Canthal Tilt: +2.3°',
            body: 'Positive canthal tilt correlates with perceived attractiveness. Yours is mild positive — in the ideal range.',
            tag: 'Good',
            tagVariant: 'sage',
          },
          {
            title: 'Jaw Width: Moderate',
            body: 'A broader jaw-to-cheekbone ratio can be enhanced through facial exercises and lower body-fat levels.',
            tag: 'Moderate',
            tagVariant: 'warn',
          },
          {
            title: 'Midface Ratio: 1:1.1',
            body: 'Midface length is well-proportioned. Mewing and proper tongue posture help maintain this long-term.',
            tag: 'Good',
            tagVariant: 'sage',
          },
        ].map((ins, i) => (
          <FlutedGlass key={i} padding={12} mode="lookmax" style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={[T.body, { fontWeight: '600', fontSize: 13, flex: 1 }]}>{ins.title}</Text>
              <View style={[
                styles.insightTag,
                { backgroundColor: ins.tagVariant === 'sage' ? C.sageSoft : '#FEF3E2' },
              ]}>
                <Text style={[T.pill, { color: ins.tagVariant === 'sage' ? C.sage : C.warn }]}>
                  {ins.tag}
                </Text>
              </View>
            </View>
            <Text style={[T.bodySm, { color: C.ink3, marginTop: 6, lineHeight: 17 }]}>{ins.body}</Text>
          </FlutedGlass>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: S.gutter },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settingsBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  diagramWrap: {
    alignItems: 'center',
    backgroundColor: '#FAF8F3',
    borderRadius: R.md,
    paddingVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  insightTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: R.pill,
    marginLeft: 8,
  },
});
