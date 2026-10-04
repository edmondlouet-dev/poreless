/**
 * Skeleton — a subtle, minimalist shimmering placeholder.
 *
 * Used while the Gemini "brain" is fetching (isAnalyzing). No harsh industrial
 * spinners: a soft sand block whose opacity breathes, so the premium layout
 * holds its shape and then fades the real copy in once state populates.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { C, R } from '../tokens';

interface Props {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
}

export const Skeleton: React.FC<Props> = ({
  width = '100%', height = 14, radius = R.sm, style,
}) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: C.surface3, opacity },
        style as any,
      ]}
    />
  );
};

/** A few stacked lines — handy for paragraph placeholders. */
export const SkeletonLines: React.FC<{ lines?: number; lastWidth?: `${number}%` }> = ({
  lines = 3, lastWidth = '60%',
}) => (
  <>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        width={i === lines - 1 ? lastWidth : '100%'}
        height={11}
        style={styles.line}
      />
    ))}
  </>
);

const styles = StyleSheet.create({
  line: { marginBottom: 7 },
});
