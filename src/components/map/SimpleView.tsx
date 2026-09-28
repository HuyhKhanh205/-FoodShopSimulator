import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PLAYER_PREP_MS, RECIPES, burnGrace } from '../../game/data';
import { handledCustomers } from '../../game/helpers';
import type { MapLayout, MapStation } from '../../game/layout';
import type { Customer, GameState } from '../../game/types';
import OrderRail from '../fp/OrderRail';
import TimerRing from '../kid/TimerRing';
import TutorialGlow from '../kid/TutorialGlow';
import { GROUP, colors, patienceColor } from '../ui';
import type { GroupKey } from '../ui';

/**
 * Chế độ Đơn giản: mặt bằng 2D cố định — khu BẾP và PHÒNG ĂN, mỗi trạm là một ô màu nhóm kèm trạng thái.
 * Chạm trạm là làm luôn (không phải dẫn nhân vật đi): bếp / thớt / quầy pha mở màn nấu, quầy ra món tự cầm món,
 * bàn thì đưa món, rác bỏ món hỏng, lau thì lau quán.
 */
export default function SimpleView({
  game,
  layout,
  targets,
  onStation,
  topInset,
  bottomInset,
}: {
  game: GameState;
  layout: MapLayout;
  targets: string[];
  onStation: (st: MapStation) => void;
  topInset: number;
  bottomInset: number;
}) {
  const run = game.run!;
  const active = layout.stations.filter((s) => s.active);
  const order: MapStation['kind'][] = ['stove', 'counter', 'board', 'fridge', 'pass', 'mop', 'trash'];
  const kitchen = active.filter((s) => order.includes(s.kind)).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.x - b.x);
  const tables = active.filter((s) => s.kind === 'table');
  const door = active.find((s) => s.kind === 'door');
  const handled = handledCustomers(run);
  const carried = new Set(run.carrying.map((id) => run.pass.find((d) => d.id === id)?.recipeId).filter(Boolean));
  const wants = (c?: Customer) => Boolean(c && c.items.some((i) => !i.served && carried.has(i.recipeId)));
  const waiting = run.customers.filter((c) => c.tableIndex === undefined);
  // Bàn đang chờ đúng món đang cầm → nút lớn "Ra món".
  const serveTarget = tables.find((t) => wants(run.customers.find((c) => c.tableIndex === t.tableIndex))) ?? (waiting.some(wants) ? door : undefined);

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.rail}>
        <OrderRail game={game} />
      </View>
      {/* Đang cầm đúng món bàn nào chờ → nút lớn ngay dưới phiếu đơn (không bị Chú Tư che). */}
      {serveTarget && (
        <Pressable onPress={() => onStation(serveTarget)} style={styles.serve} accessibilityRole="button" accessibilityLabel={serveTarget.kind === 'door' ? 'Ra món cho khách ở cửa' : `Ra món bàn ${serveTarget.tableIndex! + 1}`}>
          <Text style={styles.serveText}>🍽️ Ra món {serveTarget.kind === 'door' ? 'ở cửa' : `bàn ${serveTarget.tableIndex! + 1}`}</Text>
        </Pressable>
      )}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 12 }]}>
        <Text style={styles.zone}>🍳 BẾP</Text>
        <View style={styles.grid}>
          {kitchen.map((st) => (
            <TutorialGlow key={st.id} on={st.kind === 'board' && targets.includes('shop.board')} radius={18}>
              <KitchenTile st={st} game={game} onPress={() => onStation(st)} />
            </TutorialGlow>
          ))}
        </View>
        <Text style={styles.zone}>🪑 PHÒNG ĂN</Text>
        <View style={styles.grid}>
          {tables.map((st) => {
            const c = run.customers.find((x) => x.tableIndex === st.tableIndex);
            return (
              <TutorialGlow key={st.id} on={targets.includes('shop.table') && Boolean(c?.items.some((i) => !i.served))} radius={18}>
                <TableTile index={st.tableIndex! + 1} customer={c} handled={Boolean(c && handled.has(c.id))} wanted={wants(c)} onPress={() => onStation(st)} />
              </TutorialGlow>
            );
          })}
          {door && (
            <Pressable onPress={() => onStation(door)} style={[styles.tile, tileColor('neutral'), waiting.some(wants) && styles.wanted]} accessibilityRole="button" accessibilityLabel={`Cửa: ${waiting.length} khách chờ`}>
              <Text style={styles.icon}>🚪</Text>
              <Text style={styles.name}>Cửa</Text>
              <Text style={styles.status}>{waiting.length ? `${waiting.length} chờ · ${waiting.flatMap((c) => c.items.filter((i) => !i.served).map((i) => RECIPES[i.recipeId].emoji)).join('')}` : 'trống'}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const tileColor = (g: GroupKey) => ({ backgroundColor: GROUP[g].bg, borderColor: GROUP[g].fg });

const KITCHEN: Record<string, { icon: string; name: string; group: GroupKey }> = {
  stove: { icon: '🔥', name: 'Bếp', group: 'meat' },
  counter: { icon: '🧋', name: 'Quầy pha', group: 'egg' },
  board: { icon: '🔪', name: 'Thớt', group: 'veg' },
  fridge: { icon: '🧊', name: 'Kho', group: 'fish' },
  pass: { icon: '🛎️', name: 'Quầy ra món', group: 'egg' },
  mop: { icon: '🧽', name: 'Rửa · lau', group: 'fish' },
  trash: { icon: '🗑️', name: 'Rác', group: 'neutral' },
};

function KitchenTile({ st, game, onPress }: { st: MapStation; game: GameState; onPress: () => void }) {
  const run = game.run!;
  const look = KITCHEN[st.kind];
  let icon = look.icon;
  let name = look.name;
  let status = 'trống';
  let bar: { value: number; color: string } | null = null;
  let warn = false;
  if (st.slotId) {
    name = `${look.name} ${Number(st.slotId.replace(/\D/g, '')) + 1}`;
    const job = run.slots.find((s) => s.id === st.slotId)?.job;
    if (job) {
      const r = RECIPES[job.recipeId];
      const done = job.progress >= job.cookTime;
      const burnRatio = (job.progress - job.cookTime) / burnGrace(job.cookTime);
      warn = done && r.burns && burnRatio > 0.5;
      icon = r.emoji;
      status = `${job.by !== 'player' ? '👤 ' : ''}${!done ? `${Math.round((job.progress / job.cookTime) * 100)}%` : warn ? '⚠️ sắp cháy!' : '✅ chín · chạm lấy'}`;
      bar = { value: done && r.burns ? 1 - burnRatio : job.progress / job.cookTime, color: !done ? colors.accent : warn ? colors.bad : colors.good };
    }
    if (st.kind === 'stove' && (run.elapsed < run.powerOutUntil || run.elapsed < run.gasOutUntil)) status = '🔌 mất lửa';
  } else if (st.kind === 'board') {
    const prepped = Object.values(run.prepped).reduce((n, v) => n + (v ?? 0), 0);
    status = run.playerPrep ? '🔪 đang thái' : prepped ? `${prepped} phần đã thái` : 'trống';
    if (run.playerPrep) bar = { value: 1 - (run.playerPrep.endsAt - run.elapsed) / PLAYER_PREP_MS, color: colors.info };
  } else if (st.kind === 'fridge') {
    status = `📦 ${game.stock.filter((b) => b.expiresOnDay >= game.day).reduce((n, b) => n + b.qty, 0)}`;
  } else if (st.kind === 'pass') {
    const dishes = run.pass.filter((d) => !run.carrying.includes(d.id));
    status = dishes.length ? dishes.map((d) => (d.quality === 'burnt' ? '🔥' : RECIPES[d.recipeId].emoji)).join('') : 'trống';
  } else if (st.kind === 'mop') {
    status = run.elapsed >= run.cleanReadyAt ? `${Math.round(game.cleanliness)}% · chạm lau` : `${Math.round(game.cleanliness)}% · ⏳`;
  } else if (st.kind === 'trash') {
    status = 'bỏ món hỏng';
  }
  return (
    <Pressable onPress={onPress} style={[styles.tile, tileColor(look.group), warn && styles.warn]} accessibilityRole="button" accessibilityLabel={`${name}: ${status}`}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.status, { color: GROUP[look.group].fg }]} numberOfLines={1}>
        {status}
      </Text>
      {bar && (
        <View style={styles.track}>
          <View style={{ width: `${Math.max(0, Math.min(1, bar.value)) * 100}%`, height: '100%', backgroundColor: bar.color }} />
        </View>
      )}
    </Pressable>
  );
}

function TableTile({ index, customer, handled, wanted, onPress }: { index: number; customer?: Customer; handled: boolean; wanted: boolean; onPress: () => void }) {
  const open = customer?.items.filter((i) => !i.served) ?? [];
  const ratio = customer ? Math.max(0, customer.patience / customer.maxPatience) : 0;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, styles.table, wanted && styles.wanted]}
      accessibilityRole="button"
      accessibilityLabel={customer ? `Bàn ${index} ${customer.name}: ${open.map((i) => RECIPES[i.recipeId].name).join(', ') || 'đang ăn'}` : `Bàn ${index} trống`}
    >
      <Text style={styles.name}>Bàn {index}</Text>
      {customer ? (
        <>
          <TimerRing value={ratio} size={46} width={5} color={handled ? colors.info : patienceColor(ratio)}>
            <Text style={{ fontSize: 22 }}>{open[0] ? RECIPES[open[0].recipeId].emoji : customer.emoji}</Text>
          </TimerRing>
          <Text style={styles.status} numberOfLines={1}>
            {customer.emoji} {open.slice(1).map((i) => RECIPES[i.recipeId].emoji).join('')}
            {open.some((i) => i.noGarnish) ? '🚫🧅' : ''}
            {handled ? ' ⏳' : ''}
            {customer.question ? ' ❓' : ''}
          </Text>
        </>
      ) : (
        <Text style={[styles.status, { opacity: 0.6 }]}>trống</Text>
      )}
      {wanted && <Text style={styles.point}>👇 chạm đưa món</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  rail: { paddingHorizontal: 8 },
  content: { padding: 10, gap: 8 },
  zone: { fontSize: 14, fontWeight: '900', color: colors.brown, letterSpacing: 1, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: 104,
    minHeight: 92,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 5,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  table: { backgroundColor: '#FFFFFF', borderColor: '#D7C4AE' },
  warn: { borderColor: colors.bad, backgroundColor: '#FFEBEE' },
  wanted: { borderColor: colors.good, backgroundColor: '#E8F5E9', borderWidth: 3 },
  icon: { fontSize: 28 },
  name: { fontSize: 14, fontWeight: '900', color: colors.brown },
  status: { fontSize: 12, fontWeight: '800', color: colors.muted },
  track: { alignSelf: 'stretch', height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.1)', overflow: 'hidden' },
  point: { fontSize: 11, fontWeight: '900', color: colors.good },
  serve: {
    marginHorizontal: 10,
    marginTop: 6,
    alignItems: 'center',
    backgroundColor: colors.good,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderBottomWidth: 5,
    borderColor: '#1B5E20',
  },
  serveText: { color: '#fff', fontSize: 18, fontWeight: '900' },
});
