import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors } from '../ui';
import { tutorialUi } from './tutorialUi';

/**
 * Nhãn gợi ý nhỏ "👉 việc tiếp theo" (từ `dayFlow` / `screenNext`): chỉ NÓI việc cần làm — người chơi tự làm.
 * Chạm vào thì viền vàng chỗ cần bấm (`target`), không tự làm thay. Đứng yên lâu thì nhún nhẹ để nhắc.
 */
export default function NextButton({
  label,
  target,
  onPress,
  disabled = false,
  style,
}: {
  label: string;
  /** Chỗ viền vàng khi chạm nhãn. */
  target?: string | null;
  /** Thay cho viền vàng (vd chuyển màn). */
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
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
          Animated.delay(1500),
        ])
      );
      loop.start();
    }, 8000);
    return () => {
      clearTimeout(id);
      loop?.stop();
    };
  }, [label, disabled, pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const press = () => {
    if (onPress) onPress();
    else if (target) tutorialUi.glow(target);
  };
  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }] }, style]}>
      <Pressable
        onPress={press}
        style={({ pressed }) => [styles.pill, disabled && styles.off, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel={`Việc tiếp theo: ${label}`}
      >
        <Text style={[styles.text, disabled && { color: colors.brown }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {disabled ? '' : '👉 '}
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', maxWidth: '100%' },
  pill: {
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: '#43A047',
    borderWidth: 2,
    borderColor: '#1B5E20',
    borderBottomWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  off: { backgroundColor: 'rgba(255,246,233,0.95)', borderColor: colors.chunkyShadow },
  text: { fontSize: 15, fontWeight: '900', color: '#fff' },
});
