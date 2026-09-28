import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { dayFlow, stageSay } from '../../game/dayflow';
import type { FlowNext } from '../../game/dayflow';
import type { GameState } from '../../game/types';
import { colors } from '../ui';
import { speak } from './speech';
import { tutorialUi } from './tutorialUi';

const WATER = '#7CC6EE';
const WATER_DARK = '#2B7BB9';

/**
 * Đường sông (thiết kế 1b): 5 bến Chợ nổi → Sơ chế → Nấu ăn → Phục vụ → Tổng kết.
 * Bến xong có ✓, bến đang làm to hơn có ghe 🛶 nhấp nhô; nút "▶ Tiếp tục…" chỉ vào chỗ cần làm.
 * Chạm dải sông để thu gọn / mở rộng; chạm một bến để Chú Tư đọc gợi ý.
 */
export default function RiverPath({
  game,
  compact: startCompact = false,
  onGo,
  style,
}: {
  game: GameState;
  compact?: boolean;
  /** Việc thêm khi bấm "Tiếp tục" (vd đi tới thớt); luôn có viền vàng chỉ vào chỗ cần làm. */
  onGo?: (next: FlowNext) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [compact, setCompact] = useState(startCompact);
  const flow = dayFlow(game);
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);
  const boatY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  // Hướng dẫn ngày đầu đang dẫn thì không hiện nút riêng, kẻo trùng.
  const showGo = game.tutorial.done && Boolean(flow.next.target || flow.next.station);
  const go = () => {
    if (flow.next.target) tutorialUi.glow(flow.next.target);
    onGo?.(flow.next);
  };
  const cur = flow.stages.find((s) => s.status === 'current')!;
  const sayOf = (id: (typeof flow.stages)[number]['id']) => stageSay(game, id);

  const goBtn = showGo && (
    <Pressable onPress={go} style={({ pressed }) => [styles.go, pressed && { transform: [{ translateY: 2 }] }]} accessibilityRole="button" accessibilityLabel={`Tiếp tục: ${flow.next.label}`}>
      <Text style={styles.goText} numberOfLines={1}>
        ▶ {flow.next.label}
      </Text>
    </Pressable>
  );

  if (compact) {
    return (
      <View style={[styles.card, styles.row, style]}>
        <Pressable onPress={() => setCompact(false)} style={styles.compactLeft} accessibilityRole="button" accessibilityLabel={`Đường sông: đang ${cur.label}. Chạm để mở rộng`}>
          <View style={styles.dots}>
            {flow.stages.map((s) => (
              <View key={s.id} style={[styles.dot, s.status === 'done' && styles.dotDone, s.status === 'current' && styles.dotCur]} />
            ))}
          </View>
          <Animated.Text style={[styles.compactIcon, { transform: [{ translateY: boatY }] }]}>{cur.icon}</Animated.Text>
          <Text style={styles.compactLabel} numberOfLines={1}>
            {cur.label}
          </Text>
        </Pressable>
        {goBtn}
      </View>
    );
  }

  return (
    <View style={[styles.card, style]}>
      <View style={styles.river}>
        {/* Sơ chế → Nấu → Phục vụ lặp lại suốt giờ bán */}
        <Text style={styles.loop} pointerEvents="none">
          ↺
        </Text>
        <View style={styles.water} pointerEvents="none">
          <Text style={styles.waves} numberOfLines={1}>
            〰〰〰〰〰〰〰〰〰〰〰〰〰〰〰〰〰〰〰〰
          </Text>
        </View>
        {flow.stages.map((s) => {
          const current = s.status === 'current';
          return (
            <Pressable
              key={s.id}
              style={styles.stop}
              onPress={() => speak(sayOf(s.id))}
              accessibilityRole="button"
              accessibilityLabel={`${s.label}${current ? ', đang làm' : s.status === 'done' ? ', đã xong' : ''}`}
            >
              <View style={styles.boatSlot}>{current && <Animated.Text style={[styles.boat, { transform: [{ translateY: boatY }] }]}>🛶</Animated.Text>}</View>
              <View style={[styles.node, s.status === 'done' && styles.nodeDone, current && styles.nodeCur]}>
                <Text style={[styles.nodeIcon, current && { fontSize: 22 }]}>{s.icon}</Text>
                {s.status === 'done' && (
                  <View style={styles.check}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, current && styles.labelCur]} numberOfLines={1}>
                {s.label}
              </Text>
              {current && <Text style={styles.now}>ĐANG</Text>}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.row}>
        <Pressable onPress={() => setCompact(true)} style={styles.fold} accessibilityRole="button" accessibilityLabel="Thu gọn đường sông">
          <Text style={styles.foldText}>▲</Text>
        </Pressable>
        <Text style={styles.hint} numberOfLines={2}>
          {sayOf(cur.id)}
        </Text>
        {goBtn}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cream,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.chunkyShadow,
    borderBottomWidth: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  river: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: 74 },
  water: { position: 'absolute', left: 14, right: 14, top: 30, height: 14, borderRadius: 7, backgroundColor: WATER, overflow: 'hidden', justifyContent: 'center' },
  waves: { color: '#E3F4FD', fontSize: 10, lineHeight: 12, letterSpacing: -1 },
  loop: { position: 'absolute', left: '36%', width: '8%', top: 62, textAlign: 'center', fontSize: 12, fontWeight: '900', color: WATER_DARK },
  stop: { alignItems: 'center', width: '20%' },
  boatSlot: { height: 16, justifyContent: 'flex-end' },
  boat: { fontSize: 15 },
  node: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', borderWidth: 2, borderColor: WATER, alignItems: 'center', justifyContent: 'center', opacity: 0.75 },
  nodeDone: { opacity: 1, borderColor: colors.good },
  nodeCur: { width: 38, height: 38, borderRadius: 19, opacity: 1, borderColor: colors.primary, borderWidth: 3, marginTop: -4, backgroundColor: '#FFF3E0' },
  nodeIcon: { fontSize: 15 },
  check: { position: 'absolute', right: -6, top: -6, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.good, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  label: { marginTop: 2, fontSize: 11, fontWeight: '800', color: colors.muted },
  labelCur: { color: colors.brown, fontWeight: '900' },
  now: { fontSize: 9, fontWeight: '900', color: '#fff', backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 4, overflow: 'hidden' },
  fold: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.chunkyShadow, alignItems: 'center', justifyContent: 'center' },
  foldText: { fontSize: 11, color: colors.brown, fontWeight: '900' },
  hint: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.brown },
  go: { backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 4, borderColor: colors.primaryDark, maxWidth: 200 },
  goText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  compactLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34 },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D8E9F3', borderWidth: 1, borderColor: WATER },
  dotDone: { backgroundColor: colors.good, borderColor: colors.good },
  dotCur: { backgroundColor: colors.primary, borderColor: colors.primaryDark, width: 12, height: 12, borderRadius: 6 },
  compactIcon: { fontSize: 16 },
  compactLabel: { flexShrink: 1, fontSize: 14, fontWeight: '900', color: colors.brown },
});
