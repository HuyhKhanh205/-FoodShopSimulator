import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from './ui';

/** Nhãn nhỏ nổi trên cảnh (không tạo thành khối che màn hình) — dùng ở quán, chợ. */
export function HudChip({ children, tone = 'plain', label }: { children: React.ReactNode; tone?: 'plain' | 'warn' | 'bad' | 'good'; label?: string }) {
  return (
    <View style={[hud.chip, tone === 'warn' && hud.chipWarn, tone === 'bad' && hud.chipBad, tone === 'good' && hud.chipGood]} accessibilityLabel={label}>
      {children}
    </View>
  );
}

/** Nút tròn nhỏ trên HUD (⏸ ❗ 📒…); `dot` = chấm đỏ báo có việc. */
export function RoundButton({ label, name, onPress, active, dot }: { label: string; name: string; onPress: () => void; active?: boolean; dot?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [hud.round, active && hud.roundActive, pressed && { transform: [{ scale: 0.92 }] }]}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <Text style={hud.roundText}>{label}</Text>
      {dot && <View style={hud.dot} />}
    </Pressable>
  );
}

export const hud = StyleSheet.create({
  chip: {
    backgroundColor: 'rgba(255,246,233,0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(62,47,42,0.15)',
  },
  chipWarn: { backgroundColor: 'rgba(255,243,224,0.95)', borderColor: colors.accent },
  chipBad: { backgroundColor: 'rgba(255,235,238,0.95)', borderColor: colors.bad },
  chipGood: { backgroundColor: 'rgba(232,245,233,0.95)', borderColor: colors.good },
  chipText: { fontSize: 13, fontWeight: '900', color: colors.brown, fontVariant: ['tabular-nums'] },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,246,233,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.chunkyShadow,
    borderBottomWidth: 3,
  },
  roundActive: { backgroundColor: colors.primary },
  roundText: { fontSize: 17, fontWeight: '900', color: colors.brown },
  dot: { position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.bad, borderWidth: 2, borderColor: '#fff' },
});
