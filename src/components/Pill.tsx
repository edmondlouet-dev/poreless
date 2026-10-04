import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { C, R, T } from '../tokens';

type Variant = 'default' | 'accent' | 'sage' | 'on' | 'warn';

interface Props {
  label: string;
  variant?: Variant;
  style?: ViewStyle;
}

const variantStyles: Record<Variant, { bg: string; text: string; border: string }> = {
  default: { bg: C.surface2, text: C.ink2,      border: C.line },
  accent:  { bg: C.accentSoft, text: C.accentInk, border: 'transparent' },
  sage:    { bg: C.sageSoft, text: C.sage,        border: 'transparent' },
  on:      { bg: C.ink,     text: C.bg,           border: C.ink },
  warn:    { bg: '#FEF3E2', text: C.warn,          border: 'transparent' },
};

export const Pill: React.FC<Props> = ({ label, variant = 'default', style }) => {
  const v = variantStyles[variant];
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
        },
        style,
      ]}
    >
      <Text style={[T.pill, { color: v.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: R.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
