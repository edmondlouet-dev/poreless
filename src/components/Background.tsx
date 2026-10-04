/**
 * Background: warm paper base + 4 drifting orange blobs that drift towards
 * each other and overlap, creating a shifting amber/orange mesh.
 * Only orange shades — no teal or purple.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Ellipse, Rect, Pattern } from 'react-native-svg';
import { C } from '../tokens';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

function useDriftingBlob(
  initial: number,
  waypoints: number[],
  durations: number[],
  dimension: number,
  toPixel: (v: number) => number,
) {
  const anim = useRef(new Animated.Value(toPixel(initial))).current;
  useEffect(() => {
    const sequence = waypoints.map((wp, i) =>
      Animated.timing(anim, {
        toValue: toPixel(wp),
        duration: durations[i] ?? 12000,
        useNativeDriver: false,
      })
    );
    Animated.loop(Animated.sequence(sequence)).start();
  }, [dimension]);
  return anim;
}

interface Props { mode?: 'normal' | 'lookmax' }

export const Background: React.FC<Props> = ({ mode = 'normal' }) => {
  const { width, height } = useWindowDimensions();
  const bgColor = mode === 'lookmax' ? '#F0EDE5' : C.bg;
  const toX = (v: number) => v * width;
  const toY = (v: number) => v * height;

  // ── Blob 1: rich orange — upper-left, drifts toward centre ────────────────
  const b1x = useDriftingBlob(0.15, [0.35, 0.08, 0.45, 0.15], [13000, 17000, 15000, 13000], width, toX);
  const b1y = useDriftingBlob(0.08, [0.22, 0.38, 0.12, 0.08], [13000, 17000, 15000, 13000], height, toY);

  // ── Blob 2: burnt orange — lower-right, drifts toward centre ──────────────
  const b2x = useDriftingBlob(0.90, [0.55, 0.82, 0.60, 0.90], [16000, 12000, 18000, 16000], width, toX);
  const b2y = useDriftingBlob(0.88, [0.55, 0.74, 0.92, 0.88], [16000, 12000, 18000, 16000], height, toY);

  // ── Blob 3: golden amber — centre, drifts wide ────────────────────────────
  const b3x = useDriftingBlob(0.55, [0.20, 0.75, 0.40, 0.55], [20000, 16000, 22000, 20000], width, toX);
  const b3y = useDriftingBlob(0.45, [0.30, 0.65, 0.20, 0.45], [20000, 16000, 22000, 20000], height, toY);

  // ── Blob 4: deep amber — lower-left, drifts toward upper-right ───────────
  const b4x = useDriftingBlob(0.10, [0.40, 0.60, 0.25, 0.10], [18000, 14000, 20000, 18000], width, toX);
  const b4y = useDriftingBlob(0.75, [0.45, 0.85, 0.60, 0.75], [18000, 14000, 20000, 18000], height, toY);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Rich orange */}
          <RadialGradient id="b1" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#E8622A" stopOpacity="0.50" />
            <Stop offset="55%"  stopColor="#F08040" stopOpacity="0.20" />
            <Stop offset="100%" stopColor="#F5A070" stopOpacity="0" />
          </RadialGradient>
          {/* Burnt orange */}
          <RadialGradient id="b2" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#C4421A" stopOpacity="0.40" />
            <Stop offset="60%"  stopColor="#D46030" stopOpacity="0.14" />
            <Stop offset="100%" stopColor="#E88050" stopOpacity="0" />
          </RadialGradient>
          {/* Golden amber */}
          <RadialGradient id="b3" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#F7A830" stopOpacity="0.38" />
            <Stop offset="60%"  stopColor="#F5C060" stopOpacity="0.14" />
            <Stop offset="100%" stopColor="#F7D898" stopOpacity="0" />
          </RadialGradient>
          {/* Deep amber */}
          <RadialGradient id="b4" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#D9721E" stopOpacity="0.30" />
            <Stop offset="100%" stopColor="#E89848" stopOpacity="0" />
          </RadialGradient>
          {/* Flute overlay */}
          <Pattern id="bgFlute" x="0" y="0" width="6" height="2" patternUnits="userSpaceOnUse">
            <Rect x="1"   y="0" width="0.5" height="2" fill="rgba(255,255,255,0.55)" />
            <Rect x="3.2" y="0" width="1"   height="2" fill="rgba(180,120,60,0.06)" />
          </Pattern>
        </Defs>

        <AnimatedEllipse cx={b1x as any} cy={b1y as any}
          rx={width * 0.50} ry={height * 0.30} fill="url(#b1)" />
        <AnimatedEllipse cx={b2x as any} cy={b2y as any}
          rx={width * 0.42} ry={height * 0.26} fill="url(#b2)" />
        <AnimatedEllipse cx={b3x as any} cy={b3y as any}
          rx={width * 0.34} ry={height * 0.22} fill="url(#b3)" />
        <AnimatedEllipse cx={b4x as any} cy={b4y as any}
          rx={width * 0.28} ry={height * 0.20} fill="url(#b4)" />

        <Rect width={width} height={height} fill="url(#bgFlute)" opacity={0.60} />
      </Svg>
    </View>
  );
};
