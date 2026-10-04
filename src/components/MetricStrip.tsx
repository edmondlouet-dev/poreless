import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { C, R, T } from '../tokens';
import { FlutedGlass } from './FlutedGlass';

interface Metric {
  key: string;
  value: string;
  label: string;
  dot: 'good' | 'warn';
}

interface Props {
  metrics: Metric[];
  active: string;
  onPick: (key: string) => void;
}

export const MetricStrip: React.FC<Props> = ({ metrics, active, onPick }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ gap: 6, paddingRight: 4 }}
  >
    {metrics.map(m => {
      const isActive = m.key === active;
      const isWarn   = m.dot === 'warn';
      return (
        <TouchableOpacity
          key={m.key}
          onPress={() => onPick(m.key)}
          activeOpacity={0.8}
          style={[
            styles.card,
            isActive && { backgroundColor: C.accentSoft, borderColor: C.accent },
          ]}
        >
          {/* Blur + flute */}
          {!isActive && <BlurView style={StyleSheet.absoluteFill} intensity={30} tint="light" />}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isActive ? C.accentSoft : C.glassTint }]} pointerEvents="none" />

          <Text style={[T.num, { fontSize: 18, fontWeight: '600', color: isActive ? C.accentInk : C.ink }]}>
            {m.value}
          </Text>
          <Text style={[styles.label, { color: isActive ? C.accentInk : C.ink3 }]}>{m.label}</Text>
          <View style={[styles.dot, {
            backgroundColor: isActive ? C.accent : isWarn ? C.warn : C.sage,
          }]} />
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  card: {
    minWidth: 70,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.glassBorder,
    alignItems: 'center',
    gap: 3,
    overflow: 'hidden',
  },
  label: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
