import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

/**
 * Vòng đếm giờ quanh một ô tròn (không cần SVG): hai nửa vòng xoay theo tỉ lệ còn lại.
 * `value` 0..1 = phần còn lại, tô theo chiều kim đồng hồ từ đỉnh.
 */
export default function TimerRing({ value, size, width = 4, color, track = 'rgba(0,0,0,0.12)', children }: { value: number; size: number; width?: number; color: string; track?: string; children?: ReactNode }) {
  const v = Math.max(0, Math.min(1, value));
  const half = size / 2;
  const ring = { width: size, height: size, borderRadius: half, borderWidth: width };
  // Nửa phải: 0..0,5; nửa trái: 0,5..1.
  const rightDeg = Math.min(v, 0.5) * 360 - 180;
  const leftDeg = Math.max(0, v - 0.5) * 360 - 180;
  return (
    <View style={{ width: size, height: size }}>
      <View style={[StyleSheet.absoluteFill, ring, { borderColor: track }]} />
      {/* Nửa phải */}
      <View style={[styles.clip, { left: half, width: half, height: size }]}>
        <View style={[ring, { borderColor: color, position: 'absolute', left: -half, borderLeftColor: 'transparent', borderBottomColor: 'transparent', transform: [{ rotate: `${45 + rightDeg}deg` }] }]} />
      </View>
      {/* Nửa trái */}
      <View style={[styles.clip, { left: 0, width: half, height: size }]}>
        <View style={[ring, { borderColor: color, position: 'absolute', left: 0, borderRightColor: 'transparent', borderTopColor: 'transparent', transform: [{ rotate: `${45 + leftDeg}deg` }] }]} />
      </View>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { position: 'absolute', top: 0, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
