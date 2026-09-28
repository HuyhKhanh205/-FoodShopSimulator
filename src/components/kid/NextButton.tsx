import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors } from '../ui';

/**
 * Nút "👉 Làm tiếp" thật to: 1 việc cần làm ngay (từ `dayFlow(game).next`), bấm là làm / đi tới chỗ đó.
 * Đứng yên lâu (không đổi việc) thì nút nhún nhẹ để nhắc.
 */
export default function NextButton({ label, onPress, disabled = false, style }: { label: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pulse.setValue(0);
    if (disabled) return;
    let loop: Animated.CompositeAnimation | null = null;
    const id = setTimeout(() => {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 450, useNativeDriver: true }),
          Animated.delay(900),
        ])
      );
      loop.start();
    }, 6000);
    return () => {
      clearTimeout(id);
      loop?.stop();
    };
  }, [label, disabled, pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [styles.btn, disabled && styles.off, pressed && { transform: [{ translateY: 3 }], borderBottomWidth: 2 }]}
        accessibilityRole="button"
        accessibilityLabel={`Làm tiếp: ${label}`}
        accessibilityState={{ disabled }}
      >
        {!disabled && <Text style={styles.hand}>👉</Text>}
        <Text style={[styles.text, disabled && { color: colors.brown }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  btn: {
    minHeight: 54,
    borderRadius: 20,
    backgroundColor: '#43A047',
    borderWidth: 2,
    borderColor: '#1B5E20',
    borderBottomWidth: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  off: { backgroundColor: 'rgba(255,246,233,0.95)', borderColor: colors.chunkyShadow },
  hand: { fontSize: 24 },
  text: { fontSize: 20, fontWeight: '900', color: '#fff', flexShrink: 1 },
});
