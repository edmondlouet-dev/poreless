import React, { useRef, useEffect } from 'react';
import { Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from '../tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
  animated?: boolean;
}

const PATH_DATA =
  'M 22 8 C 14 12, 10 22, 12 32 C 13 40, 18 46, 22 52 C 26 56, 32 57, 36 54 ' +
  'C 38 52, 38 49, 36 47 L 32 44 C 30 42, 30 38, 32 36 L 36 30 ' +
  'C 37 28, 36 26, 34 26 M 18 22 C 18 24, 20 24, 20 22 C 20 20, 18 20, 18 22 ' +
  'M 28 50 C 32 52, 38 51, 42 49 C 39 47, 33 47, 28 50';

const PATH_LENGTH = 800; // approximate

export const FaceLogo: React.FC<Props> = ({
  size = 36,
  color = C.ink,
  strokeWidth = 1.5,
  animated = false,
}) => {
  const dashOffset = useRef(new Animated.Value(animated ? PATH_LENGTH : 0)).current;

  useEffect(() => {
    if (!animated) return;
    Animated.timing(dashOffset, {
      toValue: 0,
      duration: 1600,
      useNativeDriver: false, // SVG props can't use native driver
    }).start();
  }, [animated, dashOffset]);

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <AnimatedPath
        d={PATH_DATA}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={PATH_LENGTH}
        strokeDashoffset={dashOffset}
      />
    </Svg>
  );
};
