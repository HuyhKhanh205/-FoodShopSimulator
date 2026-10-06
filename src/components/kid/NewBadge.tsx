import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors } from '../ui';

/** Nhãn "MỚI" vàng nhấp nháy ở góc nút vừa mở (hết khi bé bấm thử nút). */
export default function NewBadge() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  return (
    <Animated.View pointerEvents="none" style={[styles.badge, { transform: [{ scale }] }]} accessibilityLabel="Mới">
      <Text style={styles.text}>MỚI</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: -8, left: -6, backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1.5, borderColor: '#fff', zIndex: 2 },
  text: { fontSize: 9, fontWeight: '900', color: colors.brown },
});
