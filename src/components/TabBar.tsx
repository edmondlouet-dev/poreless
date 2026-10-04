/**
 * Liquid-glass bottom tab bar — Lucide editorial icon set:
 *
 * TODAY       — Sparkles
 * SCAN        — Maximize
 * PROPORTIONS — Activity
 * RITUALS     — Bookmark
 * YOU         — User
 *
 * Uniform ultra-thin profile: strokeWidth 1.2, size 24.
 * Active #2A2522 · inactive #A09B95.
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { Sparkles, Maximize, Bookmark, User } from 'lucide-react-native';
import { FibonacciIcon } from './FibonacciIcon';
import { C, T } from '../tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type TabKey = 'today' | 'scan' | 'proportions' | 'rituals' | 'you';

const NAV_ACTIVE   = '#2A2522';
const NAV_INACTIVE = '#A09B95';

interface Props {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  mode?: 'normal' | 'lookmax';
}

const ICONS = { today: Sparkles, scan: Maximize, rituals: Bookmark, you: User } as const;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'today',       label: 'TODAY' },
  { key: 'scan',        label: 'SCAN' },
  { key: 'proportions', label: 'PROPORTIONS' },
  { key: 'rituals',     label: 'RITUALS' },
  { key: 'you',         label: 'YOU' },
];

const TabIcon: React.FC<{ name: TabKey; active: boolean }> = ({ name, active }) => {
  const color = active ? NAV_ACTIVE : NAV_INACTIVE;
  if (name === 'proportions') {
    return <FibonacciIcon size={24} strokeWidth={1.2} color={color} showGrid />;
  }
  const Icon = ICONS[name as Exclude<TabKey, 'proportions'>];
  return <Icon size={24} strokeWidth={1.2} color={color} />;
};

const RING_SIZE = 34;
const H_PAD = 8;

export const TabBar: React.FC<Props> = ({ active, onChange, mode = 'normal' }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const tabW = (width - H_PAD * 2) / TABS.length;
  const activeIndex = Math.max(0, TABS.findIndex(t => t.key === active));

  // Single ring that slides to the active tab and wraps its icon.
  const ringX = useRef(new Animated.Value(0)).current;
  const ringFor = (i: number) => H_PAD + i * tabW + tabW / 2 - RING_SIZE / 2;
  useEffect(() => {
    Animated.spring(ringX, {
      toValue: ringFor(activeIndex),
      useNativeDriver: true,
      damping: 16, stiffness: 180, mass: 0.7,
    }).start();
  }, [activeIndex, tabW]);

  const shimmerX = useRef(new Animated.Value(-80)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, { toValue: width + 80, duration: 5000, useNativeDriver: true }),
        Animated.delay(6000),
        Animated.timing(shimmerX, { toValue: -80, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, [width]);

  const bgTint = mode === 'lookmax' ? 'rgba(250,248,243,0.45)' : 'rgba(255,255,253,0.42)';

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <BlurView style={StyleSheet.absoluteFill} intensity={85} tint="light" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: bgTint }]} pointerEvents="none" />

      {/* Dense flute SVG overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={width} height={70} style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern id="tabFlute" x="0" y="0" width="4" height="2" patternUnits="userSpaceOnUse">
              <Rect x="0.8" y="0" width="0.4" height="2" fill="rgba(255,255,255,0.55)" />
              <Rect x="2.2" y="0" width="0.6" height="2" fill="rgba(160,100,50,0.07)" />
            </Pattern>
          </Defs>
          <Rect width={width} height={70} fill="url(#tabFlute)" opacity={0.9} />
        </Svg>
      </View>

      {/* Light-sweep shimmer */}
      <Animated.View
        style={[styles.shimmer, { transform: [{ translateX: shimmerX }, { skewX: '-18deg' }] }]}
        pointerEvents="none"
      />

      {/* Top hairline */}
      <View style={styles.topBorder} pointerEvents="none" />

      {/* Sliding active ring — wraps the active icon and transitions between tabs */}
      <Animated.View
        style={[styles.glowRing, { transform: [{ translateX: ringX }] }]}
        pointerEvents="none"
      />

      {TABS.map(tab => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => onChange(tab.key)} activeOpacity={0.75}>
            <View style={styles.iconWrap}>
              <TabIcon name={tab.key} active={isActive} />
              <View style={styles.lensOverlay} pointerEvents="none" />
            </View>
            <Text style={[
              T.tabLabel, {
                fontSize: 9,
                color: isActive ? NAV_ACTIVE : NAV_INACTIVE,
                marginTop: 2,
                letterSpacing: tab.label.length > 6 ? 0.1 : 0.4,
              },
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 10,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 70,
  },
  topBorder: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.80)',
    zIndex: 2,
  },
  shimmer: {
    position: 'absolute', top: 0, bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
    zIndex: 1,
  },
  tab: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 1, zIndex: 3,
  },
  iconWrap: {
    position: 'relative', width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  lensOverlay: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.10)',
    top: 3, left: 3,
  },
  glowRing: {
    position: 'absolute', top: 7, left: 0,
    width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
    backgroundColor: 'rgba(194,119,45,0.14)',
    borderWidth: 1, borderColor: 'rgba(194,119,45,0.34)',
    zIndex: 2,
  },
});
