import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors } from '../ui';

type Tone = 'primary' | 'plain' | 'good' | 'danger';

/**
 * Ô hình to cho bé bấm: emoji lớn, nhãn 1–2 chữ, huy hiệu số ở góc.
 * `missing`: các hình nhỏ của thứ còn thiếu (thay cho câu "Thiếu: ...").
 * `name`: tên đầy đủ cho trình đọc màn hình.
 */
export default function IconTile({
  icon,
  label,
  name,
  badge,
  sub,
  onPress,
  disabled,
  tone = 'plain',
  size = 'md',
  missing,
  selected,
  style,
}: {
  icon: string;
  label?: string;
  name?: string;
  badge?: string | number;
  sub?: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  missing?: string[];
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const dim = size === 'lg' ? 92 : size === 'sm' ? 60 : 76;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={name ?? label ?? icon}
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }}
      style={({ pressed }) => [
        styles.tile,
        { minWidth: dim, minHeight: dim },
        toneStyle[tone],
        selected && styles.selected,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.icon, { fontSize: size === 'lg' ? 40 : size === 'sm' ? 24 : 32 }]}>{icon}</Text>
      {label ? (
        <Text style={[styles.label, tone === 'primary' || tone === 'good' || tone === 'danger' ? styles.labelLight : null]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      {sub ? (
        <Text style={[styles.sub, tone !== 'plain' && styles.labelLight]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
      {missing && missing.length > 0 && (
        <View style={styles.missing}>
          {missing.map((m, i) => (
            <Text key={i} style={styles.missingIcon}>
              {m}
            </Text>
          ))}
        </View>
      )}
      {badge !== undefined && badge !== '' && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const toneStyle: Record<Tone, ViewStyle> = {
  primary: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  plain: { backgroundColor: '#fff', borderColor: colors.border },
  good: { backgroundColor: colors.good, borderColor: '#1B5E20' },
  danger: { backgroundColor: colors.bad, borderColor: '#8E0000' },
};

const styles = StyleSheet.create({
  tile: {
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  selected: { borderColor: colors.accent, borderWidth: 3, borderBottomWidth: 5 },
  disabled: { opacity: 0.4 },
  pressed: { transform: [{ scale: 0.95 }] },
  icon: { lineHeight: undefined },
  label: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 2 },
  labelLight: { color: '#fff' },
  sub: { fontSize: 11, fontWeight: '700', color: colors.muted },
  missing: { flexDirection: 'row', gap: 1, marginTop: 2, backgroundColor: '#FFEBEE', borderRadius: 8, paddingHorizontal: 4 },
  missingIcon: { fontSize: 13 },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
});
