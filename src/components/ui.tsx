import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';

export const colors = {
  bg: '#FFF8F0',
  card: '#FFFFFF',
  primary: '#E65100',
  primaryDark: '#BF360C',
  accent: '#FFB300',
  text: '#3E2723',
  muted: '#8D6E63',
  border: '#F0DCC8',
  good: '#2E7D32',
  bad: '#C62828',
  info: '#1565C0',
  goodBg: '#E8F5E9',
  badBg: '#FFEBEE',
  warnBg: '#FFF3E0',
  selected: '#FFE0B2',
  /** Lớp HUD theo thiết kế "Chợ Nổi Quán": nền kem, chữ nâu, nút chunky. */
  cream: '#FFF6E9',
  brown: '#3E2F2A',
  chunkyShadow: '#D9C3A5',
};

/** 4 màu nhóm (nền nhạt + viền đậm): hồng = thịt, xanh trời = cá / tôm, vàng bơ = trứng / tinh bột, bạc hà = rau. */
export const GROUP = {
  meat: { bg: '#FFE1E6', fg: '#C2185B' },
  fish: { bg: '#DDF0FF', fg: '#1565C0' },
  egg: { bg: '#FFF2C7', fg: '#B8860B' },
  veg: { bg: '#DDF5EA', fg: '#2E7D32' },
  neutral: { bg: '#F3ECE3', fg: '#6D5A4F' },
} as const;
export type GroupKey = keyof typeof GROUP;

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        variantStyle[variant],
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.btnPressed,
        style,
      ]}
    >
      <Text style={[styles.btnText, small && styles.btnTextSmall, variant === 'secondary' || variant === 'ghost' ? styles.btnTextDark : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const variantStyle: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.bad },
  ghost: { backgroundColor: 'transparent' },
};

export function ProgressBar({ value, color = colors.primary, height = 8, style }: { value: number; color?: string; height?: number; style?: StyleProp<ViewStyle> }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={[styles.barTrack, { height, borderRadius: height / 2 }, style]}>
      <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function Panel({ title, right, children, style }: { title?: string; right?: React.ReactNode; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.panel, style]}>
      {(title || right) && (
        <View style={styles.panelHeader}>
          {title ? <Text style={styles.panelTitle}>{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const full = Math.round(value * 2) / 2;
  let s = '';
  for (let i = 1; i <= 5; i += 1) s += full >= i ? '★' : full >= i - 0.5 ? '⯪' : '☆';
  return <Text style={{ color: colors.accent, fontSize: size }}>{s}</Text>;
}

export function patienceColor(ratio: number) {
  if (ratio > 0.6) return colors.good;
  if (ratio > 0.3) return colors.accent;
  return colors.bad;
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  btnDisabled: { opacity: 0.4 },
  btnPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnTextSmall: { fontSize: 13 },
  btnTextDark: { color: colors.text },
  barTrack: { backgroundColor: '#EFEBE9', overflow: 'hidden', width: '100%' },
  panel: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  panelTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
});
