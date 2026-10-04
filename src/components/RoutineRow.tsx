import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { FlutedGlass } from './FlutedGlass';
import { C, R, T } from '../tokens';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface Props {
  idx: number;
  stepName: string;
  productName: string;
  time?: string;
  defaultDone?: boolean;
  why?: string;
  tag?: string;                 // e.g. "FOR YOUR ACNE" or "CARRIED FROM AM"
  // Controlled mode: when `done` is supplied the parent owns completion state
  // (so tapping the Live Activity can check this row off, and vice-versa).
  done?: boolean;
  onToggle?: (next: boolean) => void;
}

export const RoutineRow: React.FC<Props> = ({
  idx, stepName, productName, time, defaultDone = false, why, tag,
  done: controlledDone, onToggle,
}) => {
  const isControlled = controlledDone !== undefined;
  const [internalDone, setInternalDone] = useState(defaultDone);
  const done = isControlled ? controlledDone! : internalDone;
  const [open, setOpen] = useState(false);
  // Fade content when done (no strikethrough — just dimmer + heavier glass)
  const contentOpacity = useRef(new Animated.Value(done ? 0.55 : 1)).current;

  // Keep the fade in sync when completion is driven from outside (Live Activity).
  useEffect(() => {
    Animated.timing(contentOpacity, {
      toValue: done ? 0.55 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [done]);

  const toggle = () => {
    // Haptics aren't available on every surface (web / some sandboxes); never
    // let a buzz crash the row.
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !done;
    if (isControlled) onToggle?.(next);
    else setInternalDone(next);
  };

  return (
    <View style={{ marginBottom: 6 }}>
      <FlutedGlass
        padding={12}
        style={done ? styles.done : styles.normal}
      >
        <View style={styles.row}>
          {/* Checkbox */}
          <TouchableOpacity onPress={toggle} style={[styles.check, done && styles.checkDone]}>
            {done && (
              <Svg width={11} height={11} viewBox="0 0 24 24">
                <Path
                  d="M5 13l4 4L19 7"
                  stroke={C.bg}
                  strokeWidth={2.6}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </TouchableOpacity>

          {/* Content fades when done — no strikethrough */}
          <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
            <View style={styles.titleRow}>
              <Text style={[T.body, styles.title]} numberOfLines={1}>
                <Text style={[T.num, { fontSize: 11, color: C.ink3 }]}>
                  {String(idx).padStart(2, '0')}{' '}
                </Text>
                {stepName}
              </Text>
              {time && (
                <Text style={[T.num, { fontSize: 10, color: C.ink3 }]}>{time}</Text>
              )}
            </View>
            <Text style={[T.bodySm, { color: C.ink3, marginTop: 1 }]}>{productName}</Text>

            {tag && (
              <View style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            )}

            {why && (
              <TouchableOpacity
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setOpen(o => !o);
                }}
                style={styles.whyBtn}
              >
                <Text style={styles.whyLabel}>✦ WHY {open ? '↑' : '↓'}</Text>
              </TouchableOpacity>
            )}

            {open && why && (
              <View style={styles.whyBox}>
                <Text style={[T.bodySm, { color: C.ink2, lineHeight: 17 }]}>{why}</Text>
              </View>
            )}
          </Animated.View>
        </View>
      </FlutedGlass>
    </View>
  );
};

const styles = StyleSheet.create({
  normal: { borderColor: C.line },
  done: {
    // Slightly more opaque glass + border gone to read as "settled/done"
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,253,0.72)',
  },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  check: {
    width: 16, height: 16,
    borderRadius: 3,
    borderWidth: 1.4,
    borderColor: C.line3,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkDone: { backgroundColor: C.accent, borderColor: C.accent },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    color: C.ink,
  },
  whyBtn: { marginTop: 6 },
  whyLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10.5,
    color: C.accent,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  whyBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: C.surface2,
    borderRadius: R.md,
  },
  tagChip: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: R.pill,
    backgroundColor: C.accentSoft,
    borderWidth: 1,
    borderColor: C.accent + '44',
  },
  tagText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 8.5,
    letterSpacing: 0.5,
    color: C.accentInk,
    textTransform: 'uppercase',
  },
});
