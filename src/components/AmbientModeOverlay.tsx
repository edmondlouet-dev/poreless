import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { X, ChevronRight, ScanFace } from 'lucide-react-native';
import { ARSculptOverlay, type ARMotion, type ARStep } from './ARSculptOverlay';
import { C, R, T, S } from '../tokens';

const STEP_DURATION = 30; // fallback seconds per step

export interface AmbientStep {
  label: string;
  productName: string;
  duration?: number;
  motion?: ARMotion;     // how to apply this step (for AR)
}

interface Props {
  steps: AmbientStep[];
  ritualKey?: string;
  onComplete: () => void;
  onDismiss: () => void;
}

export const AmbientModeOverlay: React.FC<Props> = ({
  steps, ritualKey, onComplete, onDismiss,
}) => {
  const [stepIdx, setStepIdx]         = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [progress, setProgress]       = useState(0);   // 0–1, drives the bar
  const [showAR, setShowAR]           = useState(false);
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const elapsedRef   = useRef(0);   // ms elapsed in the current step

  const totalSteps = steps.length;
  const current    = steps[stepIdx];
  const stepSecs   = current?.duration ?? STEP_DURATION;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // Reset the clock whenever the step changes.
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    setSecondsLeft(Math.ceil(stepSecs));
  }, [stepIdx]);

  // One pausable tick loop drives BOTH the bar (progress) and the countdown from
  // a single accumulator, so they can never drift apart. Pauses while the AR
  // guide is open and resumes from where it left off — no reset.
  useEffect(() => {
    if (!current || showAR) return;          // paused while AR is open
    let last = Date.now();
    const total = stepSecs * 1000;
    const id = setInterval(() => {
      const now = Date.now();
      elapsedRef.current += now - last;
      last = now;
      const p = Math.min(1, elapsedRef.current / total);
      setProgress(p);
      setSecondsLeft(Math.max(0, Math.ceil((total - elapsedRef.current) / 1000)));
      if (p >= 1) {
        clearInterval(id);
        advanceStep();
      }
    }, 50);
    return () => clearInterval(id);
  }, [stepIdx, showAR]);

  const advanceStep = () => {
    setStepIdx(i => {
      const next = i + 1;
      if (next >= totalSteps) {
        setTimeout(onComplete, 300);
        return i;
      }
      return next;
    });
  };

  const arSteps: ARStep[] = current
    ? [{ icon: current.motion ?? 'apply', title: `Apply · ${current.label}`, body: current.productName }]
    : [];

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      <BlurView style={StyleSheet.absoluteFill} intensity={96} tint="light" />
      <View style={[StyleSheet.absoluteFill, styles.warmTint]} />

      {/* Dismiss */}
      <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} activeOpacity={0.8}>
        <X size={24} strokeWidth={1.2} color={C.ink3} />
      </TouchableOpacity>

      {/* Step counter */}
      <Text style={[T.kicker, styles.stepCounter]}>
        AMBIENT MODE · STEP {stepIdx + 1} OF {totalSteps}
      </Text>

      {/* Large step display */}
      <View style={styles.centerBlock}>
        <Text style={[T.num, styles.countdown]}>{secondsLeft}</Text>
        <Text style={[T.kicker, { color: C.ink3, marginBottom: 12 }]}>SECONDS</Text>

        <Text style={[T.h1, styles.stepLabel]}>{current?.label}</Text>
        <Text style={[T.bodySm, styles.productName]}>{current?.productName}</Text>
      </View>

      {/* Progress track */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      {/* Step dots */}
      <View style={styles.dotRow}>
        {steps.map((_, i) => (
          <View key={i} style={[styles.dot, i <= stepIdx && styles.dotActive]} />
        ))}
      </View>

      {/* AR "how to apply" — opens the camera filter for this step */}
      <TouchableOpacity style={styles.arBtn} onPress={() => setShowAR(true)} activeOpacity={0.85}>
        <ScanFace size={18} strokeWidth={1.3} color={C.accentInk} />
        <Text style={[T.button, { color: C.accentInk, fontSize: 12 }]}>AR · how to apply</Text>
      </TouchableOpacity>

      {/* Skip ahead */}
      <TouchableOpacity style={styles.skipBtn} onPress={advanceStep} activeOpacity={0.7}>
        <Text style={[T.kicker, { color: C.ink3 }]}>SKIP STEP</Text>
        <ChevronRight size={16} strokeWidth={1.2} color={C.ink3} />
      </TouchableOpacity>

      {ritualKey && (
        <Text style={[T.kicker, styles.ritualLabel]}>
          ✦ {ritualKey.toUpperCase()} RITUAL
        </Text>
      )}

      {showAR && (
        <ARSculptOverlay
          steps={arSteps}
          ritualName={current?.label}
          onClose={() => setShowAR(false)}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'center',
  },
  warmTint: { backgroundColor: 'rgba(251,250,247,0.55)' },
  closeBtn: {
    position: 'absolute', top: 60, right: S.gutter,
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.surface2, borderRadius: 18,
  },
  stepCounter: {
    position: 'absolute', top: 66,
    alignSelf: 'center',
    color: C.ink3,
  },
  centerBlock: { alignItems: 'center', paddingHorizontal: S.gutter },
  countdown: {
    fontSize: 88, fontWeight: '700',
    color: C.accent, lineHeight: 88,
    marginBottom: 4,
  },
  stepLabel: {
    fontSize: 32, textAlign: 'center',
    marginBottom: 8, lineHeight: 38,
  },
  productName: {
    color: C.ink3, textAlign: 'center', fontSize: 13,
    fontStyle: 'italic',
  },
  progressTrack: {
    height: 2,
    backgroundColor: C.line,
    marginHorizontal: S.gutter + 16,
    marginTop: 40,
    borderRadius: 1, overflow: 'hidden',
  },
  progressFill: {
    height: 2, backgroundColor: C.accent, borderRadius: 1,
  },
  dotRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    marginTop: 14,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: C.line2,
  },
  dotActive: { backgroundColor: C.accent },
  arBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    alignSelf: 'center', marginTop: 26,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: R.pill,
    backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accent + '55',
  },
  skipBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    marginTop: 18,
  },
  ritualLabel: {
    color: C.accent, textAlign: 'center', marginTop: 16,
  },
});
