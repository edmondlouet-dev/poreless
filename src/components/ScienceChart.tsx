/**
 * "Without Poreless vs With Poreless" — animated 12-week skin-score chart.
 *
 * Two lines draw in on mount (stroke-dash reveal): a flat/declining baseline and
 * a rising adherence curve, with a soft area fill under the "with" line. Pure
 * SVG so it stays crisp at any size and needs no chart dependency.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Animated, Easing } from 'react-native';
import Svg, {
  Path, Line, Circle, Defs, LinearGradient, Stop, G, Text as SvgText,
} from 'react-native-svg';
import { C, T } from '../tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const WITHOUT = [68, 67, 69, 66, 67, 65, 66, 64, 65, 63, 64, 62, 63];
const WITH    = [68, 70, 71, 73, 75, 77, 79, 81, 82, 84, 85, 86, 87];

const Y_MIN = 55;
const Y_MAX = 92;

interface Props { width?: number; height?: number; }

export const ScienceChart: React.FC<Props> = ({ width = 320, height = 190 }) => {
  const padL = 26, padR = 12, padT = 14, padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const x = (i: number) => padL + (i / (WITH.length - 1)) * plotW;
  const y = (v: number) => padT + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * plotH;

  const toPath = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  const withPath    = toPath(WITH);
  const withoutPath = toPath(WITHOUT);
  const areaPath    = `${withPath} L ${x(WITH.length - 1).toFixed(1)} ${y(Y_MIN).toFixed(1)} L ${x(0).toFixed(1)} ${y(Y_MIN).toFixed(1)} Z`;

  const DASH = plotW * 1.8; // generous over-estimate of path length
  const drawWith    = useRef(new Animated.Value(DASH)).current;
  const drawWithout = useRef(new Animated.Value(DASH)).current;
  const fade        = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(260, [
      Animated.timing(drawWithout, { toValue: 0, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(drawWith,    { toValue: 0, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
    Animated.timing(fade, { toValue: 1, duration: 1400, delay: 600, useNativeDriver: false }).start();
  }, []);

  const gridVals = [60, 70, 80, 90];

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="withFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.accent} stopOpacity={0.20} />
            <Stop offset="1" stopColor={C.accent} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* gridlines + y labels */}
        {gridVals.map(g => (
          <G key={g}>
            <Line x1={padL} y1={y(g)} x2={width - padR} y2={y(g)} stroke={C.line} strokeWidth={0.5} />
            <SvgText x={padL - 6} y={y(g) + 3} fontSize={8} fill={C.ink4} textAnchor="end">{g}</SvgText>
          </G>
        ))}

        {/* x labels */}
        {[0, 4, 8, 12].map(wk => (
          <SvgText key={wk} x={x(wk)} y={height - 6} fontSize={8} fill={C.ink4} textAnchor="middle">
            {wk === 0 ? 'WK 0' : `WK ${wk}`}
          </SvgText>
        ))}

        {/* area under "with" */}
        <AnimatedPath d={areaPath} fill="url(#withFill)" opacity={fade} />

        {/* without line — dashed, muted */}
        <AnimatedPath
          d={withoutPath}
          fill="none"
          stroke={C.ink3}
          strokeWidth={2}
          strokeDasharray={`${DASH}`}
          strokeDashoffset={drawWithout}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* with line — accent */}
        <AnimatedPath
          d={withPath}
          fill="none"
          stroke={C.accent}
          strokeWidth={2.6}
          strokeDasharray={`${DASH}`}
          strokeDashoffset={drawWith}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* end dots */}
        <Circle cx={x(WITH.length - 1)} cy={y(WITH[WITH.length - 1])} r={3.4} fill={C.accent} />
        <Circle cx={x(WITHOUT.length - 1)} cy={y(WITHOUT[WITHOUT.length - 1])} r={3} fill={C.ink3} />
      </Svg>

      {/* legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: C.accent }]} />
          <Text style={[T.kicker, { color: C.ink2 }]}>WITH PORELESS · +19</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: C.ink3 }]} />
          <Text style={[T.kicker, { color: C.ink3 }]}>WITHOUT · −5</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 14, height: 3, borderRadius: 2 },
});
