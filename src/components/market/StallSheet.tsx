import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { INGREDIENTS } from '../../game/data';
import { returnableQty, unbuy } from '../../game/engine';
import type { GameMutation } from '../../game/GameContext';
import { usableQty } from '../../game/helpers';
import { VENDOR_MAP, fmt, friendLevel, haggle, vendorPrice, vendorState } from '../../game/market';
import type { Basket, VendorId } from '../../game/market';
import { unlockedIngredients } from '../../game/progression';
import type { GameState, IngredientId } from '../../game/types';
import { GROUP, colors } from '../ui';

/** Dãy số ngẫu nhiên cố định: dùng chung cho bản thử (để hiện câu người bán ngay) và bản thật. */
const seqRng = (seq: number[]) => {
  let i = 0;
  return () => seq[i++ % seq.length];
};

/**
 * Bảng sạp (thiết kế 1e): người bán chào, độ thân thiết ♥, từng món có giá (giá gốc gạch ngang + các khoản bớt
 * bằng số tiền), chọn − số lượng + vào giỏ, nút 🤝 Trả giá (2 lượt / ngày).
 */
export default function StallSheet({
  game,
  vendor,
  basket,
  setBasket,
  act,
  onClose,
}: {
  game: GameState;
  vendor: VendorId | null;
  basket: Basket;
  setBasket: (b: Basket) => void;
  act: (fn: GameMutation) => void;
  onClose: () => void;
}) {
  const [say, setSay] = useState<string | null>(null);
  if (!vendor) return null;
  const v = VENDOR_MAP[vendor];
  const g = GROUP[v.group];
  const st = vendorState(JSON.parse(JSON.stringify(game)), vendor);
  const lv = friendLevel(st.friendship);
  const items = v.items.filter((i) => unlockedIngredients(game).includes(i));
  const setQty = (id: IngredientId, q: number) => setBasket({ ...basket, [id]: Math.max(0, q) });

  const doHaggle = () => {
    const seq = [Math.random(), Math.random(), Math.random()];
    const trial = JSON.parse(JSON.stringify(game)) as GameState;
    const res = haggle(trial, vendor, seqRng(seq));
    if (!res) return;
    setSay(res.say);
    act((s) => void haggle(s, vendor, seqRng(seq)));
  };

  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { borderColor: g.fg }]} onPress={() => {}}>
          <View style={[styles.head, { backgroundColor: g.bg }]}>
            <Text style={styles.emoji}>{v.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{v.stall}</Text>
              <Text style={[styles.sub, { color: g.fg }]}>
                {v.name} · {'♥'.repeat(lv)}
                {'♡'.repeat(5 - lv)} thân thiết cấp {lv}
              </Text>
            </View>
          </View>
          <Text style={styles.say}>
            💬 {say ?? `${v.name}: "Ghé coi hàng nè con! ${lv >= 2 ? 'Khách quen chú bớt sẵn cho nghen.' : 'Mua nhiều cô bớt cho.'}"`}
          </Text>
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8 }}>
            {items.map((id) => {
              const ing = INGREDIENTS[id];
              const pr = vendorPrice(game, id);
              const q = basket[id] ?? 0;
              const unavailable = game.mods.unavailable.includes(id);
              const back = returnableQty(game, id);
              const up = game.prices[id] - ing.basePrice;
              return (
                <View key={id} style={styles.row} accessibilityLabel={`${ing.name} ${fmt(pr.final)}`}>
                  <Text style={styles.itemEmoji}>{ing.emoji}</Text>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {ing.name}
                      {ing.needsPrep ? ' 🔪' : ''} <Text style={styles.stock}>📦 {usableQty(game, id)}</Text>
                    </Text>
                    <Text style={styles.price}>
                      {pr.offs.length > 0 && <Text style={styles.strike}>{fmt(pr.base)} </Text>}
                      <Text style={{ color: pr.offs.length ? colors.good : colors.brown }}>{unavailable ? '🚫 hết hàng' : fmt(pr.final)}</Text>
                      <Text style={[styles.trend, { color: up > 0 ? colors.bad : colors.good }]}>{up >= 100 ? ` ▲${fmt(up)}` : up <= -100 ? ` ▼${fmt(-up)}` : ''}</Text>
                    </Text>
                    {pr.offs.map((o) => (
                      <Text key={o.label} style={styles.off}>
                        · {o.label}: bớt {fmt(o.amount)}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.qty}>
                    <Pressable
                      onPress={() => (q > 0 ? setQty(id, q - 1) : act((s) => void unbuy(s, id, 1)))}
                      disabled={q === 0 && back === 0}
                      style={[styles.qBtn, q === 0 && back === 0 && { opacity: 0.3 }]}
                      accessibilityRole="button"
                      accessibilityLabel={q > 0 ? `Bớt 1 ${ing.name} khỏi giỏ` : `Trả lại 1 ${ing.name}`}
                    >
                      <Text style={styles.qText}>−</Text>
                    </Pressable>
                    <Text style={styles.qNum}>{q}</Text>
                    <Pressable onPress={() => setQty(id, q + 1)} disabled={unavailable} style={[styles.qBtn, unavailable && { opacity: 0.3 }]} accessibilityRole="button" accessibilityLabel={`Thêm 1 ${ing.name} vào giỏ`}>
                      <Text style={styles.qText}>+</Text>
                    </Pressable>
                    <Pressable onPress={() => setQty(id, q + 5)} disabled={unavailable} style={[styles.qBtn, styles.q5, unavailable && { opacity: 0.3 }]} accessibilityRole="button" accessibilityLabel={`Thêm 5 ${ing.name} vào giỏ`}>
                      <Text style={[styles.qText, { color: '#fff', fontSize: 14 }]}>+5</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.foot}>
            <Pressable onPress={doHaggle} disabled={st.haggles <= 0} style={[styles.haggle, st.haggles <= 0 && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Trả giá">
              <Text style={styles.haggleText}>🤝 Trả giá · còn {st.haggles} lượt</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.done} accessibilityRole="button" accessibilityLabel="Xong sạp này">
              <Text style={styles.doneText}>✓ Xong</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 2, padding: 12, gap: 8, maxHeight: '88%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 8 },
  emoji: { fontSize: 36 },
  title: { fontSize: 18, fontWeight: '900', color: colors.brown },
  sub: { fontSize: 13, fontWeight: '800' },
  say: { fontSize: 14, fontWeight: '700', color: colors.brown, backgroundColor: '#fff', borderRadius: 12, padding: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, padding: 8, borderWidth: 1, borderColor: '#EADBC6' },
  itemEmoji: { fontSize: 30 },
  itemName: { fontSize: 15, fontWeight: '900', color: colors.brown },
  stock: { fontSize: 12, fontWeight: '700', color: colors.muted },
  price: { fontSize: 14, fontWeight: '900' },
  strike: { textDecorationLine: 'line-through', color: colors.muted, fontWeight: '700' },
  trend: { fontSize: 11, fontWeight: '800' },
  off: { fontSize: 11, fontWeight: '800', color: colors.good },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#FFF3E0', borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  q5: { backgroundColor: colors.primary, borderColor: colors.primaryDark, width: 38 },
  qText: { fontSize: 18, fontWeight: '900', color: colors.primaryDark },
  qNum: { minWidth: 22, textAlign: 'center', fontSize: 16, fontWeight: '900', color: colors.brown },
  foot: { flexDirection: 'row', gap: 8 },
  haggle: { flex: 1, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 12, alignItems: 'center', borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 4 },
  haggleText: { fontSize: 15, fontWeight: '900', color: colors.brown },
  done: { backgroundColor: colors.brown, borderRadius: 16, paddingHorizontal: 20, justifyContent: 'center' },
  doneText: { color: colors.cream, fontWeight: '900', fontSize: 16 },
});
