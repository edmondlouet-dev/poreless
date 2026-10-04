/**
 * FlutedGlass — the signature card surface of Poreless, styled after Apple's
 * Liquid Glass. (The name is kept so every screen keeps working; `LiquidGlass`
 * is exported as an alias.)
 *
 * Two render paths:
 *
 *  A. iOS 26+ — the real thing. `GlassView` from expo-glass-effect wraps
 *     UIGlassEffect, so the system does the lensing, specular light and
 *     touch response (`isInteractive`). We add nothing on top.
 *
 *  B. Everywhere else (older iOS, Android, web) — a hand-built approximation:
 *     1. Heavy backdrop blur so the drifting orange behind reads as soft colour
 *     2. A thin, warm-white tint (much clearer than the old frosted look)
 *     3. A top-down sheen: glass is lit from above, so the top half glows
 *     4. A specular rim: the edge catches light bright at the top-left and
 *        bottom-right corners and fades along the sides
 *     5. A soft, wide drop shadow so the card floats
 *     Touch: the card gives slightly under the finger (scale 0.985) and a soft
 *     light bloom follows the finger, both springing back on release.
 */

import React, { useRef, useState, useCallback, useId, ReactNode } from 'react';
import {
  View,
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  StyleProp,
  ViewStyle,
  LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';
import { R } from '../tokens';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Set true on screens where interaction would be confusing (modals etc) */
  noTouch?: boolean;
  /** 'lookmax' swaps to warmer translucency */
  mode?: 'normal' | 'lookmax';
  /** Additional inner padding */
  padding?: number;
}

// Checked once. The API check guards against early iOS 26 betas that crash
// (expo/expo#40911); the try/catch covers clients without the native module.
const NATIVE_GLASS = (() => {
  if (Platform.OS !== 'ios') return false;
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
})();

const GLOW = 140; // diameter of the touch bloom

export const FlutedGlass: React.FC<Props> = ({
  children,
  style,
  radius = R.glass,
  noTouch = false,
  mode = 'normal',
  padding = 14,
}) => {
  if (NATIVE_GLASS) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="light"
        isInteractive={!noTouch}
        tintColor={mode === 'lookmax' ? 'rgba(255,250,240,0.25)' : undefined}
        style={[styles.nativeWrapper, { borderRadius: radius }, style]}
      >
        <View style={{ padding }}>{children}</View>
      </GlassView>
    );
  }

  return (
    <FallbackGlass style={style} radius={radius} noTouch={noTouch} mode={mode} padding={padding}>
      {children}
    </FallbackGlass>
  );
};

export const LiquidGlass = FlutedGlass;

const FallbackGlass: React.FC<Required<Omit<Props, 'style' | 'children'>> & Pick<Props, 'style' | 'children'>> = ({
  children,
  style,
  radius,
  noTouch,
  mode,
  padding,
}) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  // SVG ids must be unique per card (web shares one document) and colon-free.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  const press = useRef(new Animated.Value(0)).current;  // 0 = rest, 1 = pressed
  const glowX = useRef(new Animated.Value(0)).current;
  const glowY = useRef(new Animated.Value(0)).current;

  const springTo = (toValue: number) =>
    Animated.spring(press, { toValue, damping: 18, stiffness: 220, mass: 0.6, useNativeDriver: true }).start();

  const panResponder = useRef(
    PanResponder.create({
      // Claim the touch only on start (buttons inside still win, being deeper),
      // never mid-move, so scrolling over a card is never hijacked.
      onStartShouldSetPanResponder: () => !noTouch,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderTerminationRequest: () => true,

      onPanResponderGrant: (evt) => {
        glowX.setValue(evt.nativeEvent.locationX);
        glowY.setValue(evt.nativeEvent.locationY);
        springTo(1);
      },
      onPanResponderMove: (evt) => {
        glowX.setValue(evt.nativeEvent.locationX);
        glowY.setValue(evt.nativeEvent.locationY);
      },
      onPanResponderRelease: () => springTo(0),
      onPanResponderTerminate: () => springTo(0),
    })
  ).current;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(s => (s.width === width && s.height === height ? s : { width, height }));
  }, []);

  // Android has no real backdrop blur here, so it needs more tint to stay legible.
  const tint = Platform.OS === 'android'
    ? (mode === 'lookmax' ? 'rgba(255,251,245,0.62)' : 'rgba(255,253,250,0.58)')
    : (mode === 'lookmax' ? 'rgba(255,250,242,0.20)' : 'rgba(255,253,250,0.12)');

  const { width, height } = size;
  const inner = Math.max(radius - 1, 0); // radius inside the 1px border

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { borderRadius: radius },
        style,
        { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) }] },
      ]}
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: inner, overflow: 'hidden' }]} pointerEvents="none">
        {/* 1 ── Backdrop blur */}
        <BlurView style={StyleSheet.absoluteFill} intensity={45} tint="default" />

        {/* 2 ── Clear warm tint */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />

        {/* 3 + 4 ── Sheen and specular rim */}
        {width > 0 && (
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={`sheen${uid}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.34" />
                <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.06" />
                <Stop offset="0.8" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.10" />
              </LinearGradient>
              <LinearGradient id={`rim${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
                <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity="0.35" />
                <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0.12" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.75" />
              </LinearGradient>
            </Defs>
            <Rect width={width} height={height} fill={`url(#sheen${uid})`} />
            {/* inner glow just inside the edge: the "thickness" of the glass */}
            <Rect
              x={2} y={2} width={Math.max(width - 4, 0)} height={Math.max(height - 4, 0)}
              rx={Math.max(inner - 2, 0)}
              fill="none" stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={3}
            />
            <Rect
              x={0.5} y={0.5} width={Math.max(width - 1, 0)} height={Math.max(height - 1, 0)}
              rx={Math.max(inner - 0.5, 0)}
              fill="none" stroke={`url(#rim${uid})`} strokeWidth={1.2}
            />
          </Svg>
        )}

        {/* Touch bloom: a soft light that follows the finger */}
        <Animated.View
          style={[
            styles.glow,
            {
              opacity: press,
              transform: [
                { translateX: Animated.add(glowX, -GLOW / 2) },
                { translateY: Animated.add(glowY, -GLOW / 2) },
              ],
            },
          ]}
        >
          <Svg width={GLOW} height={GLOW}>
            <Defs>
              <RadialGradient id={`glow${uid}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
                <Stop offset="0.5" stopColor="#FFF4E8" stopOpacity="0.18" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill={`url(#glow${uid})`} />
          </Svg>
        </Animated.View>
      </View>

      {/* Content */}
      <View style={{ padding }}>{children}</View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  nativeWrapper: {
    overflow: 'hidden',
  },
  wrapper: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    // Wide, soft, warm shadow so the glass floats above the orange.
    // Android elevation draws a hard grey outline through translucent views, so it's off.
    shadowColor: '#7A3E12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 0,
  },
  glow: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: GLOW,
    height: GLOW,
  },
});
