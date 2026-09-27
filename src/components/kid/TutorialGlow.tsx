import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useGame } from '../../game/GameContext';
import { tutorialTargets } from '../../game/tutorial';

/** Chỗ này đang được bếp trưởng chỉ vào không (vd 'market.open', 'kitchen.prep:hanh'). */
export function useTutorialTarget(key: string): boolean {
  const { game } = useGame();
  return game ? tutorialTargets(game).includes(key) : false;
}

/** Tất cả chỗ đang được chỉ vào (gọi một lần rồi dùng `includes` trong vòng lặp). */
export function useTutorialTargets(): string[] {
  const { game } = useGame();
  return game ? tutorialTargets(game) : [];
}

/** Viền vàng nhấp nháy + ngón tay 👆 nhún nhảy quanh thứ cần bấm. */
export default function TutorialGlow({
  on,
  children,
  style,
  radius = 18,
}: {
  on: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 450, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [on, t]);
  return (
    <View style={style}>
      {children}
      {on && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { borderRadius: radius, opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.finger, { transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }]}
          >
            <Text style={styles.fingerText}>👆</Text>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', left: -5, right: -5, top: -5, bottom: -5, borderWidth: 4, borderColor: '#FFD600' },
  finger: { position: 'absolute', right: -6, bottom: -26 },
  fingerText: { fontSize: 28 },
});
