import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RECIPES } from '../../game/data';
import type { GameState, RecipeId } from '../../game/types';
import { trendHeat } from '../../game/trend';
import { colors, patienceColor } from '../ui';

/**
 * Thanh phiếu order trong màn bếp: món khách đang chờ (bàn gấp nhất lên trước) và
 * tổng số món còn phải nấu (đã trừ món đang nấu, trên quầy ra món và trên tay).
 */
export default function OrderRail({ game }: { game: GameState }) {
  const run = game.run!;
  const customers = [...run.customers]
    .filter((c) => c.items.some((i) => !i.served))
    .sort((a, b) => a.patience / a.maxPatience - b.patience / b.maxPatience);

  // Cần nấu thêm = món khách chưa nhận − món đang nấu − món đã xong (quầy + tay).
  const need = new Map<RecipeId, number>();
  for (const c of customers) for (const i of c.items) if (!i.served) need.set(i.recipeId, (need.get(i.recipeId) ?? 0) + 1);
  for (const sl of run.slots) if (sl.job) need.set(sl.job.recipeId, (need.get(sl.job.recipeId) ?? 0) - 1);
  for (const d of run.pass) if (d.quality !== 'burnt') need.set(d.recipeId, (need.get(d.recipeId) ?? 0) - 1);
  const todo = [...need.entries()].filter(([, n]) => n > 0);

  if (customers.length === 0) {
    return (
      <View style={styles.empty} accessibilityLabel="Chưa có khách gọi món">
        <Text style={styles.emptyText}>🧾 —</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.rail}>
      <View style={[styles.ticket, styles.todo]} accessibilityLabel={`Cần nấu: ${todo.map(([id, n]) => `${RECIPES[id].name} ${n}`).join(', ') || 'đủ rồi'}`}>
        <Text style={styles.todoTitle}>🔥</Text>
        {todo.length ? (
          todo.map(([id, n]) => (
            <Text key={id} style={styles.todoItem}>
              {RECIPES[id].emoji}×{n}
            </Text>
          ))
        ) : (
          <Text style={styles.todoItem}>✅</Text>
        )}
      </View>
      {customers.map((c) => {
        const ratio = Math.max(0, c.patience / c.maxPatience);
        const where = c.tableIndex !== undefined ? `🪑${c.tableIndex + 1}` : c.kind === 'delivery' ? '🛵' : '🚪';
        const open = c.items.filter((i) => !i.served);
        return (
          <View
            key={c.id}
            style={[styles.ticket, ratio < 0.3 && styles.urgent]}
            accessibilityLabel={`${where.replace('🪑', 'Bàn ')} ${c.name}: ${open.map((i) => RECIPES[i.recipeId].name + (i.noGarnish ? ' không hành' : '')).join(', ')}`}
          >
            <Text style={styles.where}>
              {where} {c.emoji}
            </Text>
            <View style={styles.items}>
              {c.items.map((i, k) => (
                <Text key={k} style={[styles.item, i.served && styles.served]}>
                  {i.served ? '✅' : RECIPES[i.recipeId]?.emoji ?? '🍽️'}
                  {i.noGarnish && !i.served ? '🚫' : ''}
                  {!i.served && trendHeat(game, i.recipeId) > 0 ? '🔥' : ''}
                </Text>
              ))}
            </View>
            <View style={styles.track}>
              <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: patienceColor(ratio) }} />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { flexGrow: 0, marginTop: 6 },
  row: { gap: 6, paddingRight: 8 },
  ticket: {
    backgroundColor: '#FFFDF7',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderTopWidth: 4,
    borderTopColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 58,
    gap: 2,
  },
  urgent: { borderTopColor: colors.bad, borderColor: colors.bad },
  todo: { flexDirection: 'row', alignItems: 'center', gap: 4, borderTopColor: colors.primary, backgroundColor: '#FFF3E0' },
  todoTitle: { fontSize: 16 },
  todoItem: { fontSize: 16, fontWeight: '900', color: colors.primaryDark },
  where: { fontSize: 11, fontWeight: '900', color: colors.muted },
  items: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: 110 },
  item: { fontSize: 20 },
  served: { fontSize: 12, opacity: 0.6 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.12)', overflow: 'hidden' },
  empty: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  emptyText: { fontSize: 14, color: colors.muted, fontWeight: '800' },
});
