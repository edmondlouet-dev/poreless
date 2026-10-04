import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Sparkles, Flame, Check } from 'lucide-react-native';
import { C, R, T, S } from '../tokens';

interface Props {
  currentStep: string;
  progress: number;    // 0–1
  streak: number;
  ritualName?: string;
  onAdvance?: () => void;   // tap → check off the next step in the routine below
  allDone?: boolean;
}

// ── Shared layout used on all platforms ──────────────────────────────────────

const WidgetCard: React.FC<Props> = ({ currentStep, progress, streak, ritualName, onAdvance, allDone }) => {
  const pct = Math.round(progress * 100);

  const Body = (
    <View style={styles.card}>
      {/* Left: step info */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <Sparkles size={12} strokeWidth={1.2} color={C.accent} />
          <Text style={[T.kicker, { color: C.accent, fontSize: 9 }]}>
            {ritualName ? `${ritualName.toUpperCase()} · LIVE` : 'PORELESS · LIVE'}
          </Text>
        </View>
        <Text style={[T.body, { fontWeight: '600', fontSize: 13, color: C.ink }]} numberOfLines={1}>
          {allDone ? 'All steps complete ✓' : currentStep}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
        </View>
        <Text style={[T.kicker, { color: C.ink3, marginTop: 5, fontSize: 9 }]}>
          {allDone ? 'ROUTINE COMPLETE' : onAdvance ? `${pct}% · TAP TO CHECK OFF NEXT` : `${pct}% complete`}
        </Text>
      </View>

      {/* Right: tap-to-complete affordance OR streak */}
      {onAdvance && !allDone ? (
        <View style={styles.checkCircle}>
          <Check size={18} strokeWidth={2} color={C.accentInk} />
        </View>
      ) : (
        <View style={styles.streakCol}>
          <Flame size={18} strokeWidth={1.2} color={C.warn} />
          <Text style={[T.num, { fontSize: 18, fontWeight: '700', color: C.warn }]}>{streak}</Text>
          <Text style={[T.kicker, { color: C.ink4, fontSize: 8, letterSpacing: 0.4 }]}>STREAK</Text>
        </View>
      )}
    </View>
  );

  if (onAdvance && !allDone) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onAdvance}>
        {Body}
      </TouchableOpacity>
    );
  }
  return Body;
};

// ── iOS Live Activity wrapper (physical device only) ─────────────────────────
// For full native Live Activity support you need a Swift ActivityKit extension.
// This component renders the equivalent UI as an in-app widget; the platform
// check prevents any crash on web / simulator / Android.

export const LiveActivityWidget: React.FC<Props> = (props) => {
  const isIOSDevice =
    Platform.OS === 'ios' &&
    !(Platform as any).isPad &&
    !__DEV__;   // swap to `Platform.isTV === false` if you need it in dev

  if (isIOSDevice) {
    // On a real iPhone, show the "Live Activity" card + hint that lock-screen
    // activity is enabled (native ActivityKit extension wires separately).
    return (
      <View>
        <View style={styles.iosLabel}>
          <View style={styles.iosLiveDot} />
          <Text style={[T.kicker, { color: C.accent, fontSize: 9 }]}>LOCK SCREEN · LIVE ACTIVITY</Text>
        </View>
        <WidgetCard {...props} />
      </View>
    );
  }

  // Web / simulator / Android — standard dashboard card
  return (
    <View>
      <Text style={[T.kicker, { marginBottom: 6, color: C.ink3 }]}>NOW ACTIVE</Text>
      <WidgetCard {...props} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.surface,
    borderRadius: R.lg,
    borderWidth: 1, borderColor: C.line,
    padding: 14,
    marginBottom: 16,
  },
  progressTrack: {
    height: 3, backgroundColor: C.line,
    borderRadius: 2, overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: { height: 3, backgroundColor: C.accent, borderRadius: 2 },
  streakCol: {
    alignItems: 'center', gap: 3, flexShrink: 0,
    minWidth: 40,
  },
  checkCircle: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accent + '66',
    flexShrink: 0,
  },
  iosLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: 5,
  },
  iosLiveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent,
  },
});
