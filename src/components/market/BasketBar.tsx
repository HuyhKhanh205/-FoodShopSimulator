import { Pressable, StyleSheet, Text, View } from 'react-native';
import { INGREDIENTS } from '../../game/data';
import { VENDORS, basketTotal, fmt, friendLevel, stockCapacity, stockUnits, vendorState } from '../../game/market';
import type { Basket, VendorId } from '../../game/market';
import type { GameState, IngredientId } from '../../game/types';
import TutorialGlow from '../kid/TutorialGlow';
import { GROUP, colors } from '../ui';

/**
 * Thanh giỏ ở đáy màn chợ (thiết kế 1d): món trong giỏ, chỗ còn trong kho, nút 🧾 Mua theo menu và 💳 Trả tiền.
 */
export function BasketBar({
  game,
  basket,
  onMenu,
  onPay,
  onClear,
  error,
  targets,
}: {
  game: GameState;
  basket: Basket;
  /** Không truyền = ẩn nút 🧾 Theo menu (ngày đầu mua tay). */
  onMenu?: () => void;
  onPay: () => void;
  onClear: () => void;
  error: string | null;
  targets: string[];
}) {
  const { cost, units } = basketTotal(game, basket);
  const cap = stockCapacity(game);
  const used = stockUnits(game);
  const room = cap - used;
  const over = units > room;
  const lines = (Object.entries(basket) as [IngredientId, number][]).filter(([, q]) => q > 0);
  // Một hàng gọn: [🧺 hàng trong giỏ / 📦 kho] [✕] [🧾 Theo menu] [💳 Trả].
  return (
    <View style={styles.bar}>
      {error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          ⚠️ {error}
        </Text>
      )}
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.items} numberOfLines={1} accessibilityLabel={`Giỏ ${units} phần`}>
            🧺 {units ? lines.map(([id, q]) => `${INGREDIENTS[id].emoji}${q}`).join(' ') : 'Giỏ trống'}
          </Text>
          <Text style={[styles.room, over && { color: colors.bad }]} accessibilityLabel={`Kho ${used} trên ${cap} chỗ`}>
            📦 {used + units}/{cap}
          </Text>
        </View>
        {units > 0 && (
          <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Bỏ hết giỏ" style={styles.clear}>
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        )}
        {onMenu && (
          <TutorialGlow on={targets.includes('market.menu') && units === 0} radius={14}>
            <Pressable onPress={onMenu} style={styles.menu} accessibilityRole="button" accessibilityLabel="Mua theo menu">
              <Text style={styles.menuText}>🧾 Theo menu</Text>
            </Pressable>
          </TutorialGlow>
        )}
        <TutorialGlow on={targets.includes('market.pay') && units > 0} radius={14}>
          <Pressable
            onPress={onPay}
            disabled={units === 0}
            style={[styles.pay, (units === 0 || over || cost > game.money) && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel={`Trả tiền ${fmt(cost)}`}
          >
            <Text style={styles.payText} numberOfLines={1}>
              💳 {fmt(cost)}
            </Text>
          </Pressable>
        </TutorialGlow>
      </View>
    </View>
  );
}

/** Chế độ Đơn giản: 4 ô sạp lớn tô màu nhóm, chạm là mở sạp ngay. */
export function StallGrid({ game, onStall, deals }: { game: GameState; onStall: (id: VendorId) => void; deals: { id: IngredientId; off: number }[] }) {
  return (
    <View style={styles.grid}>
      {VENDORS.map((v) => {
        const g = GROUP[v.group];
        const deal = deals.find((d) => v.items.includes(d.id));
        const lv = friendLevel(vendorState(game, v.id).friendship);
        return (
          <Pressable key={v.id} onPress={() => onStall(v.id)} style={[styles.stall, { backgroundColor: g.bg, borderColor: g.fg }]} accessibilityRole="button" accessibilityLabel={`${v.stall} ${v.name}`}>
            <Text style={styles.stallEmoji}>{v.emoji}</Text>
            <Text style={styles.stallName}>{v.stall}</Text>
            <Text style={[styles.stallSub, { color: g.fg }]}>
              {v.name} · {'♥'.repeat(lv)}
            </Text>
            {deal && <Text style={styles.deal}>🏷️ {INGREDIENTS[deal.id].emoji} bớt {fmt(deal.off)}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.cream, borderTopWidth: 2, borderColor: colors.chunkyShadow, paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
  info: { flex: 1, minWidth: 0 },
  items: { fontSize: 14, fontWeight: '900', color: colors.brown },
  clear: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E0D0BC' },
  clearText: { fontWeight: '900', color: colors.muted },
  room: { fontSize: 11, fontWeight: '800', color: colors.muted },
  error: { color: colors.bad, fontWeight: '800', fontSize: 13 },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  menu: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 10, alignItems: 'center', borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 4 },
  menuText: { fontSize: 14, fontWeight: '900', color: colors.brown },
  pay: { backgroundColor: colors.good, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center', borderBottomWidth: 4, borderColor: '#1B5E20', minWidth: 84 },
  payText: { fontSize: 15, fontWeight: '900', color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 10, justifyContent: 'center' },
  stall: { width: '46%', minHeight: 120, borderRadius: 20, borderWidth: 2, borderBottomWidth: 5, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 2 },
  stallEmoji: { fontSize: 34 },
  stallName: { fontSize: 15, fontWeight: '900', color: colors.brown, textAlign: 'center' },
  stallSub: { fontSize: 12, fontWeight: '800' },
  deal: { fontSize: 12, fontWeight: '900', color: colors.good },
});
