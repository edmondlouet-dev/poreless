/**
 * FlutedGlass — the signature card surface of Poreless.
 *
 * Visual recipe:
 *  1. Semi-transparent white base
 *  2. Blur backdrop (expo-blur BlurView)
 *  3. SVG vertical-ridge ("flute") overlay at 85% opacity in overlay blend
 *  4. 1px white border + inset top highlight
 *  5. Soft drop shadow
 *
 * Touch animation (subtle, non-distracting):
 *  - On tap/drag: the flute pattern shifts horizontally by up to ±4px,
 *    simulating light refracting differently as you slide your finger.
 *  - A soft radial glow appears at the touch point and fades on release.
 *  Both effects spring back when the finger lifts.
 */

import React, { useRef, useState, useCallback, ReactNode } from 'react';
import {
  View,
  Animated,
  PanResponder,
  StyleSheet,
  StyleProp,
  ViewStyle,
  LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { C, R } from '../tokens';

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

export const FlutedGlass: React.FC<Props> = ({
  children,
  style,
  radius = R.lg,
  noTouch = false,
  mode = 'normal',
  padding = 14,
}) => {
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });

  // ── Touch animation values ──────────────────────────────────────────────────
  const fluteShift = useRef(new Animated.Value(0)).current;   // translateX of flute overlay
  const glowOpacity = useRef(new Animated.Value(0)).current;  // radial highlight opacity
  const glowX = useRef(new Animated.Value(0)).current;        // glow center X
  const glowY = useRef(new Animated.Value(0)).current;        // glow center Y

  const springConfig = { useNativeDriver: true };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !noTouch,
      onMoveShouldSetPanResponder:  () => !noTouch,

      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        glowX.setValue(locationX);
        glowY.setValue(locationY);
        // Shift flute by fraction of touch position across the card
        const targetShift = ((locationX / (cardSize.width || 200)) - 0.5) * 6;
        Animated.parallel([
          Animated.spring(glowOpacity, { toValue: 1, ...springConfig }),
          Animated.spring(fluteShift, { toValue: targetShift, ...springConfig }),
        ]).start();
      },

      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        glowX.setValue(locationX);
        glowY.setValue(locationY);
        // Live-update flute shift: drag left→right shifts texture left→right by ±3px
        const targetShift = ((locationX / (cardSize.width || 200)) - 0.5) * 6;
        fluteShift.setValue(targetShift);
      },

      onPanResponderRelease: () => {
        Animated.parallel([
          Animated.spring(glowOpacity, {
            toValue: 0,
            damping: 20,
            ...springConfig,
          }),
          Animated.spring(fluteShift, {
            toValue: 0,
            damping: 20,
            ...springConfig,
          }),
        ]).start();
      },

      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(glowOpacity, { toValue: 0, ...springConfig }),
          Animated.spring(fluteShift, { toValue: 0, ...springConfig }),
        ]).start();
      },
    })
  ).current;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCardSize({ width, height });
  }, []);

  const tint = mode === 'lookmax' ? 'rgba(255,252,248,0.40)' : C.glassTint;
  const { width, height } = cardSize;

  return (
    <View
      style={[styles.wrapper, { borderRadius: radius }, style]}
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      {/* 1 ── Blur base */}
      <BlurView
        style={StyleSheet.absoluteFill}
        intensity={40}
        tint="light"
      />

      {/* 2 ── White tint overlay */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tint },
        ]}
        pointerEvents="none"
      />

      {/* 3 ── Fluted texture (SVG repeating vertical ridges) */}
      {width > 0 && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.fluteContainer,
            { transform: [{ translateX: fluteShift }] },
          ]}
          pointerEvents="none"
        >
          <Svg
            // Extra width so the shift never reveals a gap
            width={width + 16}
            height={height}
            style={{ position: 'absolute', left: -8, top: 0 }}
          >
            <Defs>
              <Pattern
                id="flute"
                x="0"
                y="0"
                width="6"
                height="2"
                patternUnits="userSpaceOnUse"
              >
                {/* white highlight ridge */}
                <Rect x="1" y="0" width="0.5" height="2" fill="rgba(255,255,255,0.45)" />
                {/* warm shadow vale */}
                <Rect x="3" y="0" width="1" height="2" fill="rgba(160,140,110,0.06)" />
              </Pattern>
            </Defs>
            <Rect
              width={width + 16}
              height={height}
              fill="url(#flute)"
              opacity={0.85}
            />
          </Svg>
        </Animated.View>
      )}

      {/* 4 ── Touch glow — soft radial highlight at finger position */}
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
            transform: [
              { translateX: Animated.add(glowX, new Animated.Value(-40)) },
              { translateY: Animated.add(glowY, new Animated.Value(-40)) },
            ],
          },
        ]}
        pointerEvents="none"
      />

      {/* 5 ── Top-edge inner highlight (1px white line) */}
      <View style={styles.topHighlight} pointerEvents="none" />

      {/* 6 ── Content */}
      <View style={[styles.content, { padding }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.glassBorder,
    shadowColor: 'rgba(50,30,10,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  fluteContainer: {
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.18)',
    // Soft edge via no border, just opacity falloff from the shape
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.90)',
    zIndex: 2,
  },
  content: {
    position: 'relative',
    zIndex: 3,
  },
});
