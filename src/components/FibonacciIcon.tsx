/**
 * Fibonacci / golden-ratio spiral icon — matches the classic reference:
 * an outer golden rectangle subdivided into Fibonacci squares (1,1,2,3,5,8,13)
 * with one continuous quarter-arc per square forming the golden spiral.
 *
 * The arcs are built with a turtle that advances its centre each step, so the
 * spiral is provably continuous (consecutive arc endpoints coincide). Stroke is
 * given in *visual* pixels and converted to viewBox units so it stays even with
 * the rest of the 1.2-weight icon set regardless of `size`.
 */
import React from 'react';
import Svg, { Path, Rect, G } from 'react-native-svg';

const VB = 100;

interface RectBox { x: number; y: number; w: number; h: number; }

function buildGolden() {
  const radii = [1, 1, 2, 3, 5, 8, 13];
  let theta = Math.PI, cx = 0, cy = 0;
  const dir = (t: number): [number, number] => [Math.cos(t), Math.sin(t)];
  const arcs: { p0: [number, number]; p1: [number, number]; r: number }[] = [];
  const sq: { x0: number; y0: number; x1: number; y1: number }[] = [];

  for (let i = 0; i < radii.length; i++) {
    const r = radii[i];
    const start: [number, number] = [cx + r * Math.cos(theta), cy + r * Math.sin(theta)];
    const endTheta = theta + Math.PI / 2;
    const end: [number, number] = [cx + r * Math.cos(endTheta), cy + r * Math.sin(endTheta)];
    arcs.push({ p0: start, p1: end, r });

    const d1 = dir(theta), d2 = dir(endTheta);
    const xs = [cx, cx + r * d1[0], cx + r * d2[0], cx + r * d1[0] + r * d2[0]];
    const ys = [cy, cy + r * d1[1], cy + r * d2[1], cy + r * d1[1] + r * d2[1]];
    sq.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });

    if (i + 1 < radii.length) {
      const nr = radii[i + 1];
      cx = end[0] - nr * Math.cos(endTheta);
      cy = end[1] - nr * Math.sin(endTheta);
    }
    theta = endTheta;
  }

  const xs = sq.flatMap(s => [s.x0, s.x1]);
  const ys = sq.flatMap(s => [s.y0, s.y1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const bw = maxX - minX, bh = maxY - minY;

  const M = 6;
  const scale = (VB - 2 * M) / Math.max(bw, bh);
  const offX = M + (VB - 2 * M - bw * scale) / 2 - minX * scale;
  const offY = M + (VB - 2 * M - bh * scale) / 2 - minY * scale;
  const tx = (x: number) => offX + x * scale;
  const ty = (y: number) => offY + y * scale;

  let d = '';
  arcs.forEach((a, i) => {
    const s = [tx(a.p0[0]), ty(a.p0[1])];
    const e = [tx(a.p1[0]), ty(a.p1[1])];
    const rr = a.r * scale;
    if (i === 0) d += `M ${s[0].toFixed(2)} ${s[1].toFixed(2)} `;
    d += `A ${rr.toFixed(2)} ${rr.toFixed(2)} 0 0 1 ${e[0].toFixed(2)} ${e[1].toFixed(2)} `;
  });

  const rects: RectBox[] = sq.map(s => ({
    x: tx(s.x0), y: ty(s.y0), w: (s.x1 - s.x0) * scale, h: (s.y1 - s.y0) * scale,
  }));
  const outer: RectBox = { x: tx(minX), y: ty(minY), w: bw * scale, h: bh * scale };

  return { spiral: d.trim(), rects, outer };
}

const GOLDEN = buildGolden();

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;   // visual px
  showGrid?: boolean;     // outer rect + subdivision squares
}

export const FibonacciIcon: React.FC<Props> = ({
  size = 24, color = '#2A2522', strokeWidth = 1.2, showGrid = true,
}) => {
  const sw = (strokeWidth * VB) / size;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
      {showGrid && (
        <G>
          {/* outer golden rectangle */}
          <Rect
            x={GOLDEN.outer.x} y={GOLDEN.outer.y}
            width={GOLDEN.outer.w} height={GOLDEN.outer.h}
            fill="none" stroke={color} strokeWidth={sw * 0.85} opacity={0.55}
          />
          {/* subdivision squares */}
          {GOLDEN.rects.map((r, i) => (
            <Rect
              key={i}
              x={r.x} y={r.y} width={r.w} height={r.h}
              fill="none" stroke={color} strokeWidth={sw * 0.6} opacity={0.32}
            />
          ))}
        </G>
      )}
      <Path
        d={GOLDEN.spiral}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
