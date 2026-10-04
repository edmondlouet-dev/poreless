import { StyleSheet } from 'react-native';

// ── Color tokens ──────────────────────────────────────────────────────────────
export const C = {
  // Surfaces
  bg:           '#FBFAF7',
  surface:      '#FFFFFF',
  surface2:     '#F3F1EC',
  surface3:     '#E7E4DC',
  surfaceHover: '#FDFCF9',

  // Ink
  ink:  '#1A1814',
  ink2: '#4A463E',
  ink3: '#8C8779',
  ink4: '#BDB9AB',

  // Lines
  line:  '#EBE7DD',
  line2: '#D8D3C5',
  line3: '#C2BCAB',

  // Accent — terracotta orange
  accent:     '#C2772D',
  accentSoft: '#F9F0E5',
  accentInk:  '#8E5526',

  // Secondary — olive
  sage:     '#8E8B5C',
  sageSoft: '#F1F0E2',

  // Semantic
  warn:   '#C79144',
  danger: '#B23F2C',

  // Glass
  glassTint:       'rgba(255,255,253,0.55)',
  glassTintStrong: 'rgba(255,255,253,0.75)',
  glassBorder:     'rgba(255,255,255,0.70)',
} as const;

// Lookmax mode overrides
export const CLookmax = {
  bg:       '#F0EDE5',
  surface:  '#FAF8F3',
  surface2: '#E8E4D8',
  surface3: '#DDD8C8',
  line:     '#D8D3C5',
  line2:    '#C2BCAB',
  line3:    '#A8A290',
  glassTint:       'rgba(255,255,253,0.40)',
  glassTintStrong: 'rgba(255,255,253,0.60)',
} as const;

// ── Spacing ───────────────────────────────────────────────────────────────────
export const S = {
  gutter: 18,
  card:   14,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  xxl: 18,
  xxxl: 22,
} as const;

// ── Radius ────────────────────────────────────────────────────────────────────
export const R = {
  sm:   4,
  md:   6,
  lg:   10,
  xl:   14,
  pill: 999,
} as const;

// ── Font families ─────────────────────────────────────────────────────────────
// Loaded via useFonts in App.tsx; these names must match loadAsync keys
export const F = {
  display:    'CormorantGaramond-Regular',
  displayItalic: 'CormorantGaramond-Italic',
  body:       'Inter_400Regular',
  bodySemi:   'Inter_600SemiBold',
  mono:       'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemi:   'JetBrainsMono_600SemiBold',
} as const;

// ── Common text styles ────────────────────────────────────────────────────────
export const T = StyleSheet.create({
  h1: {
    fontFamily: F.display,
    fontSize: 38,
    fontWeight: '400',
    lineHeight: 40,
    letterSpacing: -0.76,
    color: C.ink,
  },
  h2: {
    fontFamily: F.display,
    fontSize: 24,
    fontWeight: '400',
    lineHeight: 28,
    letterSpacing: -0.24,
    color: C.ink,
  },
  body: {
    fontFamily: F.body,
    fontSize: 14,
    lineHeight: 21,
    color: C.ink2,
  },
  bodySm: {
    fontFamily: F.body,
    fontSize: 12,
    lineHeight: 18,
    color: C.ink2,
  },
  button: {
    fontFamily: F.bodySemi,
    fontSize: 13,
    lineHeight: 13,
    color: C.ink,
  },
  kicker: {
    fontFamily: F.monoMedium,
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: C.ink3,
  },
  pill: {
    fontFamily: F.monoMedium,
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: 0.22,
    color: C.ink2,
  },
  tabLabel: {
    fontFamily: F.monoMedium,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  num: {
    fontFamily: F.monoSemi,
    fontVariant: ['tabular-nums'],
    color: C.ink,
  },
});
