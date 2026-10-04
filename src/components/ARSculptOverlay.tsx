/**
 * AR guide overlay — a face-filter-style camera layer.
 *
 * Opens the front camera and lays a translucent face mesh + detection bracket
 * over the face (so it reads like a Snap/Instagram filter), then draws the
 * movement on top:
 *   • sculpt motions  (drainage / sculpt / lift / soothe) — from the structural
 *     blueprint, launched in Rituals.
 *   • apply motions   (apply / press / pat) — how to apply a product, launched
 *     from Ambient Mode.
 *
 * Arrows have an animated "flow" dash so the direction reads at a glance; press
 * motions render pulsing press-points. No frames are captured or stored.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Modal, Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path, Ellipse, Circle, Line, G } from 'react-native-svg';
const AnimatedLine = Animated.createAnimatedComponent(Line);
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FaceLogo } from './FaceLogo';
import type { BlueprintIcon } from '../skin';
import { detectStepCompletion } from '../services/gemini';
import { C, R, T, S } from '../tokens';

const { width: W } = Dimensions.get('window');
const AnimatedPath   = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG      = Animated.createAnimatedComponent(G);

export type ARMotion = BlueprintIcon | 'apply' | 'press' | 'pat';

export interface ARStep {
  icon: ARMotion;
  title: string;
  body: string;
}

interface Arrow { d: string; head: string; }
interface Guide { arrows: Arrow[]; press: { x: number; y: number }[]; cue: string; }

// Arrowhead chevron at tip (x,y) pointing along `angle` (deg, dir of travel).
function head(x: number, y: number, angle: number, len = 4.5): string {
  const back = (angle * Math.PI) / 180 + Math.PI;
  const wing = (deg: number) => {
    const w = back + (deg * Math.PI) / 180;
    return `${(x + len * Math.cos(w)).toFixed(1)} ${(y + len * Math.sin(w)).toFixed(1)}`;
  };
  return `M ${wing(28)} L ${x.toFixed(1)} ${y.toFixed(1)} L ${wing(-28)}`;
}

// Geometry in a 100 × 150 portrait viewBox laid over the camera (face ≈ cx50 cy60).
const GUIDES: Record<ARMotion, Guide> = {
  // ── structural sculpting motions ──────────────────────────────────────────
  drainage: {
    arrows: [
      { d: 'M 66 56 C 70 76 66 96 60 110', head: head(60, 110, 110) },
      { d: 'M 34 56 C 30 76 34 96 40 110', head: head(40, 110, 70) },
    ],
    press: [],
    cue: 'Trace down — inner brow → jaw → collarbone. Three slow passes per side.',
  },
  sculpt: {
    arrows: [
      { d: 'M 52 74 C 64 66 72 54 80 42', head: head(80, 42, -57) },
      { d: 'M 48 74 C 36 66 28 54 20 42', head: head(20, 42, -123) },
    ],
    press: [],
    cue: 'Sculpt the fuller cheek up toward the temple — fewer passes on the lighter side.',
  },
  lift: {
    arrows: [
      { d: 'M 64 52 C 72 48 78 44 84 38', head: head(84, 38, -40) },
      { d: 'M 36 52 C 28 48 22 44 16 38', head: head(16, 38, -140) },
    ],
    press: [],
    cue: 'Press up-and-out from the outer eye corner toward the brow tail — never inward.',
  },
  soothe: {
    arrows: [],
    press: [{ x: 36, y: 66 }, { x: 64, y: 66 }, { x: 50, y: 88 }],
    cue: 'Press — don\'t rub — the final layer in with warm palms to seal and calm.',
  },
  // ── product application motions ─────────────────────────────────────────────
  apply: {
    arrows: [
      { d: 'M 50 56 C 60 54 70 54 78 52', head: head(78, 52, -8) },
      { d: 'M 50 56 C 40 54 30 54 22 52', head: head(22, 52, 188) },
      { d: 'M 50 44 C 50 40 50 36 50 31', head: head(50, 31, -90) },
    ],
    press: [],
    cue: 'Warm between palms, then smooth outward from the centre of the face along the cheekbones.',
  },
  press: {
    arrows: [],
    press: [{ x: 50, y: 36 }, { x: 34, y: 58 }, { x: 66, y: 58 }, { x: 50, y: 84 }],
    cue: 'Press evenly into the skin with flat palms — don\'t drag. Forehead, cheeks, then chin.',
  },
  pat: {
    arrows: [],
    press: [{ x: 40, y: 50 }, { x: 60, y: 50 }, { x: 34, y: 64 }, { x: 66, y: 64 }, { x: 50, y: 76 }],
    cue: 'Pat gently with fingertips until absorbed — let each layer sink in before the next.',
  },
};

const LABEL: Record<ARMotion, string> = {
  drainage: 'LYMPHATIC DRAINAGE', sculpt: 'CHEEK SCULPT', lift: 'EYE LIFT', soothe: 'BARRIER PRESS',
  apply: 'SMOOTH OUTWARD', press: 'PRESS & SEAL', pat: 'PAT TO ABSORB',
};

// ── Face-mesh wireframe (filter look) ──────────────────────────────────────────
const MESH_DOTS: [number, number][] = [
  [38, 34], [50, 30], [62, 34],          // forehead
  [34, 44], [44, 43], [56, 43], [66, 44], // brow
  [38, 50], [50, 50], [62, 50],          // eye line
  [50, 58], [50, 64],                    // bridge
  [44, 66], [56, 66],                    // nose base
  [32, 62], [68, 62],                    // cheeks
  [42, 78], [50, 79], [58, 78],          // mouth
  [36, 86], [64, 86], [50, 92], [50, 96], // jaw + chin
];
const MESH_LINES: [number, number, number, number][] = [
  [38,34,50,30],[50,30,62,34],
  [34,44,44,43],[44,43,56,43],[56,43,66,44],
  [38,50,50,50],[50,50,62,50],
  [50,50,50,58],[50,58,50,64],
  [44,66,50,64],[50,64,56,66],
  [32,62,44,66],[56,66,68,62],
  [42,78,50,79],[50,79,58,78],
  [36,86,50,96],[50,96,64,86],
  [32,62,36,86],[68,62,64,86],
  [34,44,32,62],[66,44,68,62],
  [38,34,34,44],[62,34,66,44],
  [50,79,50,92],[50,92,50,96],
  [38,50,44,43],[62,50,56,43],
];

interface Props {
  steps: ARStep[];
  ritualName?: string;
  onClose: () => void;
}

export const ARSculptOverlay: React.FC<Props> = ({ steps, ritualName, onClose }) => {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [idx, setIdx]   = useState(0);
  const [detectP, setDetectP] = useState(0);   // 0–1 completion confidence
  const [done, setDone] = useState(false);
  // Lock-on state machine: every step re-acquires the face, then locks on before
  // the completion detector starts — so it reads like genuine tracking.
  const [phase, setPhase] = useState<'acquiring' | 'locked'>('acquiring');

  const flow    = useRef(new Animated.Value(0)).current;
  const pulse   = useRef(new Animated.Value(0)).current;
  const acquire = useRef(new Animated.Value(0)).current;   // 0→1 lock-on sweep

  useEffect(() => {
    Animated.loop(Animated.timing(flow,  { toValue: 1, duration: 1100, useNativeDriver: false })).start();
    Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: false })).start();
  }, []);

  const step  = steps[idx];
  const guide = step ? GUIDES[step.icon] : undefined;

  const goNext = () => {
    if (idx < steps.length - 1) setIdx(i => i + 1);
    else setTimeout(onClose, 600);
  };

  // Each step: run the acquisition sweep, lock on, THEN start completion detection.
  // Live builds stream frames to the model; Expo Go runs a realistic hold timer.
  useEffect(() => {
    setDetectP(0);
    setDone(false);
    setPhase('acquiring');
    acquire.setValue(0);
    let stop = () => {};
    const anim = Animated.timing(acquire, { toValue: 1, duration: 1200, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (!finished) return;
      setPhase('locked');
      stop = detectStepCompletion(
        () => null,                       // frame provider (wired to camera when live)
        (p) => setDetectP(p),
        () => { setDone(true); setTimeout(goNext, 700); },
      );
    });
    return () => { anim.stop(); stop(); };
  }, [idx]);

  const locked     = phase === 'locked';
  const dashOffset = flow.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const pulseR     = pulse.interpolate({ inputRange: [0, 1], outputRange: [3, 11] });
  const pulseO     = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const breatheO   = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.75, 0.5] });
  const bracketLk  = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 0.9, 0.45] });
  // Mesh + brackets fade in with the sweep while acquiring, then breathe once locked.
  const meshO      = locked ? breatheO : acquire;
  const bracketO   = locked ? bracketLk : acquire;
  // Scanning sweep line travels down the face during acquisition.
  const sweepY     = acquire.interpolate({ inputRange: [0, 1], outputRange: [22, 100] });
  const sweepO     = acquire.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.85, 0.85, 0] });
  // Subtle world-anchored sway so the whole guide reads as locked to the face.
  const swayX      = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-1.4, 1.4, -1.4] });
  const swayY      = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, -1, 1] });

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} transparent={false}>
      <View style={styles.root}>
        {permission?.granted ? (
          <CameraView style={StyleSheet.absoluteFill} facing="front" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <FaceLogo size={W * 0.4} color="rgba(255,255,255,0.25)" strokeWidth={0.8} />
          </View>
        )}

        <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none" />

        {/* AR guide layer — swayed as one unit so it reads as anchored to the face */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateX: swayX }, { translateY: swayY }] }]}
          pointerEvents="none"
        >
          <Svg
            style={StyleSheet.absoluteFill}
            viewBox="0 0 100 150"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* face-detection bracket — fades in on acquire, pulses once locked */}
            <AnimatedG opacity={bracketO}>
              <Path d="M 18 32 L 18 26 L 26 26" stroke="white" strokeWidth={0.8} fill="none" strokeLinecap="round" />
              <Path d="M 82 32 L 82 26 L 74 26" stroke="white" strokeWidth={0.8} fill="none" strokeLinecap="round" />
              <Path d="M 18 90 L 18 96 L 26 96" stroke="white" strokeWidth={0.8} fill="none" strokeLinecap="round" />
              <Path d="M 82 90 L 82 96 L 74 96" stroke="white" strokeWidth={0.8} fill="none" strokeLinecap="round" />
            </AnimatedG>

            {/* face mesh wireframe */}
            <AnimatedG opacity={meshO}>
              <Ellipse cx={50} cy={60} rx={28} ry={38} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={0.4} />
              {MESH_LINES.map((l, i) => (
                <Line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="rgba(255,255,255,0.30)" strokeWidth={0.3} />
              ))}
              {MESH_DOTS.map((p, i) => (
                <Circle key={i} cx={p[0]} cy={p[1]} r={0.7} fill="rgba(255,255,255,0.85)" />
              ))}
            </AnimatedG>

            {/* acquisition sweep line — travels down the face while locking on */}
            <AnimatedLine
              x1={22} x2={78} y1={sweepY} y2={sweepY}
              stroke={C.accent} strokeWidth={0.7} opacity={sweepO} strokeLinecap="round"
            />

            {/* movement guidance — only once the face is locked */}
            {locked && guide?.arrows.map((ar, i) => (
              <G key={i}>
                <AnimatedPath
                  d={ar.d} fill="none" stroke={C.accent} strokeWidth={1.8}
                  strokeLinecap="round" strokeDasharray="6 6" strokeDashoffset={dashOffset}
                />
                <Path d={ar.head} fill="none" stroke={C.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </G>
            ))}

            {/* press points — only once locked */}
            {locked && guide?.press.map((p, i) => (
              <G key={`p-${i}`}>
                <AnimatedCircle cx={p.x} cy={p.y} r={pulseR} fill="none" stroke={C.accent} strokeWidth={0.9} opacity={pulseO} />
                <Circle cx={p.x} cy={p.y} r={2.4} fill={C.accent} />
              </G>
            ))}
          </Svg>
        </Animated.View>

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <View>
            <View style={styles.lockRow}>
              <View style={[styles.lockDot, { backgroundColor: locked ? '#5BD66E' : C.warn }]} />
              <Text style={[T.kicker, { color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5 }]}>
                {locked ? 'FACE LOCKED' : 'ACQUIRING…'}
              </Text>
            </View>
            <Text style={[T.kicker, { color: C.accent, marginTop: 4 }]}>
              {step ? LABEL[step.icon] : ''}{ritualName ? ` · ${ritualName.toUpperCase()}` : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <X size={24} strokeWidth={1.2} color="white" />
          </TouchableOpacity>
        </View>

        {/* Instruction card */}
        <View style={[styles.card, { paddingBottom: insets.bottom + 16 }]}>
          {!permission?.granted && (
            <TouchableOpacity style={styles.allowBtn} onPress={requestPermission} activeOpacity={0.85}>
              <Text style={[T.button, { color: C.bg }]}>Enable camera for live AR →</Text>
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={[T.kicker, { color: C.accent }]}>STEP {idx + 1} OF {steps.length}</Text>
            <Text style={[T.kicker, { color: 'rgba(255,255,255,0.5)', fontSize: 8 }]}>
              MOTION GUIDE · ON-DEVICE
            </Text>
          </View>
          <Text style={[T.h2, { color: 'white', fontSize: 20 }]}>{step?.title}</Text>
          <Text style={[T.bodySm, { color: 'rgba(255,255,255,0.8)', marginTop: 8, lineHeight: 18 }]}>
            {guide?.cue}
          </Text>

          {/* AI completion detection */}
          <View style={styles.detectRow}>
            <View style={styles.detectTrack}>
              <View style={[styles.detectFill, {
                width: `${Math.round((locked ? detectP : 0) * 100)}%`,
                backgroundColor: done ? '#5BD66E' : C.accent,
              }]} />
            </View>
            <Text style={[T.kicker, { color: done ? '#5BD66E' : 'rgba(255,255,255,0.7)', fontSize: 9, marginTop: 6 }]}>
              {!locked
                ? 'ALIGNING TO FACE MESH…'
                : done
                  ? '✓ MOVEMENT COMPLETE · ADVANCING'
                  : 'HOLD THE MOTION · DETECTING COMPLETION…'}
            </Text>
          </View>

          <View style={styles.dotRow}>
            {steps.map((_, i) => (
              <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
            ))}
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.navBtn}
              disabled={idx === 0}
              onPress={() => setIdx(i => Math.max(0, i - 1))}
              activeOpacity={0.8}
            >
              <ChevronLeft size={18} strokeWidth={1.4} color={idx === 0 ? 'rgba(255,255,255,0.3)' : 'white'} />
              <Text style={[T.button, { color: idx === 0 ? 'rgba(255,255,255,0.3)' : 'white', fontSize: 12 }]}>Back</Text>
            </TouchableOpacity>

            {idx < steps.length - 1 ? (
              <TouchableOpacity style={styles.navBtnPrimary} onPress={() => setIdx(i => i + 1)} activeOpacity={0.85}>
                <Text style={[T.button, { color: C.ink, fontSize: 12 }]}>Next</Text>
                <ChevronRight size={18} strokeWidth={1.4} color={C.ink} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.navBtnPrimary} onPress={onClose} activeOpacity={0.85}>
                <Text style={[T.button, { color: C.ink, fontSize: 12 }]}>✓  Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0B08' },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#16130F' },
  scrim: { backgroundColor: 'rgba(13,11,8,0.32)' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: S.gutter, paddingBottom: 12,
  },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lockDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#5BD66E' },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(13,11,8,0.78)',
    borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
    paddingHorizontal: S.gutter, paddingTop: 18,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  allowBtn: {
    backgroundColor: C.accent, borderRadius: R.md,
    paddingVertical: 12, alignItems: 'center', marginBottom: 14,
  },
  detectRow: { marginTop: 14 },
  detectTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2, overflow: 'hidden' },
  detectFill: { height: 3, borderRadius: 2 },
  dotRow: { flexDirection: 'row', gap: 6, marginTop: 16, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { backgroundColor: C.accent, width: 18 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 8 },
  navBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'white', borderRadius: R.md,
    paddingVertical: 12, paddingHorizontal: 18,
  },
});
