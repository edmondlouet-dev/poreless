// A small line chart of one score across saved scans. Points are real readings
// only; with fewer than two there is no line to draw.
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { C, T } from '../tokens';

interface Props {
  points: { date: string; value: number }[];
  width: number;
  height?: number;
}

export const TrendChart: React.FC<Props> = ({ points, width, height = 140 }) => {
  if (points.length < 2) {
    return (
      <Text style={[T.bodySm, { color: C.ink3, lineHeight: 17 }]}>
        {points.length === 0
          ? 'No scored scans yet. Your trend line starts after two scans.'
          : 'One scan so far. Take another in similar light to start a trend line.'}
      </Text>
    );
  }
  const padL = 26, padR = 8, padT = 8, padB = 18;
  const values = points.map(p => p.value);
  const lo = Math.max(0, Math.floor((Math.min(...values) - 5) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...values) + 5) / 10) * 10);
  const x = (i: number) => padL + (i / (points.length - 1)) * (width - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / Math.max(1, hi - lo)) * (height - padT - padB);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const first = points[0]!, last = points[points.length - 1]!;

  return (
    <View>
      <Svg width={width} height={height}>
        {[lo, Math.round((lo + hi) / 2), hi].map(g => (
          <React.Fragment key={g}>
            <Line x1={padL} x2={width - padR} y1={y(g)} y2={y(g)} stroke={C.line} strokeWidth={1} />
            <SvgText x={padL - 5} y={y(g) + 3} fontSize={8} fill={C.ink4} textAnchor="end">{g}</SvgText>
          </React.Fragment>
        ))}
        <Path d={d} stroke={C.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <Circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 3.5 : 2.2} fill={C.accent} />
        ))}
        <SvgText x={padL} y={height - 4} fontSize={8} fill={C.ink4}>{first.date}</SvgText>
        <SvgText x={width - padR} y={height - 4} fontSize={8} fill={C.ink4} textAnchor="end">{last.date}</SvgText>
      </Svg>
    </View>
  );
};
