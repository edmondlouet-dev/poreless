import React, { useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FlutedGlass } from '../components/FlutedGlass';
import { C, R, T, S } from '../tokens';

const { width: W } = Dimensions.get('window');

// Simulated 7-day data
const DAYS = [
  { day: 'S', score: 71, isToday: false },
  { day: 'M', score: 74, isToday: false },
  { day: 'T', score: 72, isToday: false },
  { day: 'W', score: 75, isToday: false },
  { day: 'T', score: 76, isToday: false },
  { day: 'F', score: 77, isToday: false },
  { day: 'S', score: 78, isToday: true },
];

const METRICS = [
  { label: 'Hydration', value: '82', delta: '+5', bars: [0.55, 0.62, 0.70, 0.68, 0.75, 0.78, 0.82] },
  { label: 'Texture',   value: '74', delta: '+2', bars: [0.65, 0.68, 0.70, 0.72, 0.73, 0.74, 0.74] },
  { label: 'Pores',     value: '69', delta: '-1', bars: [0.72, 0.70, 0.69, 0.71, 0.68, 0.70, 0.69] },
  { label: 'Oil',       value: '55', delta: '+3', bars: [0.48, 0.50, 0.50, 0.52, 0.53, 0.54, 0.55] },
  { label: 'Calm',      value: '88', delta: '+1', bars: [0.83, 0.85, 0.86, 0.87, 0.87, 0.88, 0.88] },
];

const MAX_BAR_H = 120;

const AnimatedBar: React.FC<{
  score: number;
  isToday: boolean;
  day: string;
  delay: number;
}> = ({ score, isToday, day, delay }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const targetH = (score / 100) * MAX_BAR_H;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.barCol}>
      <View style={[styles.barTrack, { height: MAX_BAR_H }]}>
        <Animated.View
          style={[
            styles.bar,
            {
              backgroundColor: isToday ? C.accent : C.ink,
              height: anim.interpolate({ inputRange: [0, 1], outputRange: [0, targetH] }),
            },
          ]}
        />
      </View>
      <Text style={[T.kicker, { color: C.ink3, marginTop: 4, letterSpacing: 0 }]}>{day}</Text>
    </View>
  );
};

const MiniBar: React.FC<{ values: number[] }> = ({ values }) => (
  <View style={styles.miniBars}>
    {values.map((v, i) => (
      <View key={i} style={[styles.miniBar, { height: 14 * v, backgroundColor: i === 6 ? C.accent : C.surface3 }]} />
    ))}
  </View>
);

export const Trend: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Background />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: 16 }}>
          <Text style={T.kicker}>PROGRESS</Text>
          <Text style={[T.h1, { fontSize: 34, marginTop: 4 }]}>trend</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <Text style={[T.num, { fontSize: 48, fontWeight: '700', color: C.ink }]}>78</Text>
            <View style={[styles.deltaPill, { backgroundColor: C.sageSoft }]}>
              <Text style={[T.pill, { color: C.sage }]}>+3 vs last week</Text>
            </View>
          </View>
          <Text style={[T.kicker, { color: C.ink3, marginTop: 2 }]}>APR 21 – APR 27</Text>
        </View>

        {/* Bar chart */}
        <FlutedGlass padding={16} style={{ marginBottom: 14 }}>
          <Text style={[T.kicker, { marginBottom: 14 }]}>OVERALL SCORE · 7 DAYS</Text>
          <View style={styles.chartRow}>
            {DAYS.map((d, i) => (
              <AnimatedBar key={i} score={d.score} isToday={d.isToday} day={d.day} delay={i * 60} />
            ))}
          </View>
        </FlutedGlass>

        {/* Metric rows */}
        <Text style={[T.kicker, { marginBottom: 8 }]}>BY METRIC</Text>
        {METRICS.map(m => {
          const isPositive = m.delta.startsWith('+');
          return (
            <FlutedGlass key={m.label} padding={12} style={{ marginBottom: 8 }}>
              <View style={styles.metricRow}>
                <View style={{ flex: 1 }}>
                  <Text style={T.kicker}>{m.label}</Text>
                  <View style={styles.metricBottom}>
                    <Text style={[T.num, { fontSize: 22, fontWeight: '600' }]}>{m.value}</Text>
                    <View style={[
                      styles.deltaPill,
                      { backgroundColor: isPositive ? C.sageSoft : '#FEF3E2' },
                    ]}>
                      <Text style={[T.pill, { color: isPositive ? C.sage : C.warn }]}>{m.delta}</Text>
                    </View>
                  </View>
                </View>
                <MiniBar values={m.bars} />
              </View>
            </FlutedGlass>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: S.gutter },
  deltaPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: R.pill,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    width: 8,
    backgroundColor: C.surface3,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: 8,
    borderRadius: 4,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  miniBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 22,
  },
  miniBar: {
    width: 5,
    borderRadius: 2,
  },
});
