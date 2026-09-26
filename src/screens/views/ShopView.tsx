import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import CookSlotCard from '../../components/CookSlotCard';
import CustomerCard from '../../components/CustomerCard';
import Hud from '../../components/Hud';
import { Button, Panel, ProgressBar, colors } from '../../components/ui';
import { CLOSE_HOUR, DAY_MS, INGREDIENTS, OPEN_HOUR, PLAYER_PREP_MS, RECIPES, ROLE_EMOJI, ROLE_LABEL } from '../../game/data';
import {
  discardDish,
  isPeak,
  playerClean,
  playerCook,
  playerPrep,
  playerServe,
  playerTakeOut,
} from '../../game/engine';
import { useGame, useGameState } from '../../game/GameContext';
import { canMake, formatClock, missingFor, prepIngredients, usableQty } from '../../game/helpers';
import type { Dish, GameState, Staff } from '../../game/types';

type Tab = 'serve' | 'kitchen' | 'prep' | 'staff';

const TABS: { key: Tab; label: string }[] = [
  { key: 'serve', label: '🍽️ Phục vụ' },
  { key: 'kitchen', label: '🔥 Bếp' },
  { key: 'prep', label: '🔪 Sơ chế' },
  { key: 'staff', label: '📋 Nhật ký' },
];

function staffStatus(st: Staff, elapsed: number): string {
  if (st.absent) return 'Nghỉ hôm nay';
  if (elapsed < st.lateUntil) return '⏰ Chưa tới (đi trễ)';
  const t = st.task;
  if (!t) return 'Đang rảnh';
  switch (t.kind) {
    case 'prep':
      return `Sơ chế ${t.ingredientId ? INGREDIENTS[t.ingredientId].name : ''}`;
    case 'cook_start':
      return `Chuẩn bị nấu ${t.recipeId ? RECIPES[t.recipeId].name : ''}`;
    case 'serve':
      return 'Đang mang món ra';
    case 'clean':
      return 'Đang lau dọn';
    default:
      return '';
  }
}

export default function ShopView() {
  const game = useGameState();
  const { act, paused, setPaused } = useGame();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [tab, setTab] = useState<Tab>('serve');
  const [selectedDish, setSelectedDish] = useState<string | null>(null);
  const [noGarnish, setNoGarnish] = useState(false);
  const run = game.run!;
  const selected = run.pass.find((d) => d.id === selectedDish) ?? null;

  const onCustomerPress = (customerId: string) => {
    const c = run.customers.find((x) => x.id === customerId);
    if (!c) return;
    let dish: Dish | undefined = selected ?? undefined;
    if (!dish) {
      // Không chọn món: tự tìm món phù hợp trên quầy ra món.
      const open = c.items.filter((i) => !i.served);
      dish =
        run.pass.find((d) => d.quality !== 'burnt' && open.some((i) => i.recipeId === d.recipeId && i.noGarnish === d.noGarnish)) ??
        run.pass.find((d) => d.quality !== 'burnt' && open.some((i) => i.recipeId === d.recipeId && !i.noGarnish));
    }
    if (!dish) {
      act(() => 'Chưa có món nào của bàn này trên quầy — hãy nấu trước!');
      return;
    }
    const dishId = dish.id;
    act((s, rng) => playerServe(s, dishId, customerId, rng));
    setSelectedDish(null);
  };

  const hour = formatClock(run.elapsed, DAY_MS, OPEN_HOUR, CLOSE_HOUR);
  const peak = isPeak(run.elapsed);
  const powerOut = run.elapsed < run.powerOutUntil;
  const gasOut = run.elapsed < run.gasOutUntil;
  const cleanReady = run.elapsed >= run.cleanReadyAt;

  const topBar = (
    <View style={styles.topBar}>
      <View style={styles.flex}>
        <Text style={styles.clock}>
          🕐 {hour} {peak ? <Text style={styles.peak}>· Giờ cao điểm!</Text> : null}
          {powerOut ? <Text style={styles.warn}> · 🔌 Cúp điện</Text> : null}
          {gasOut ? <Text style={styles.warn}> · 🛢️ Hết gas</Text> : null}
        </Text>
        <ProgressBar value={run.elapsed / DAY_MS} height={5} color={colors.primary} />
      </View>
      <Button small variant="secondary" label={cleanReady ? '🧽 Lau dọn' : '🧽 ...'} disabled={!cleanReady} onPress={() => act((s) => playerClean(s))} />
      <Button small variant={paused ? 'primary' : 'secondary'} label={paused ? '▶️ Tiếp' : '⏸️ Dừng'} onPress={() => setPaused(!paused)} />
    </View>
  );

  const passPanel = (
    <Panel title={`🛎️ Quầy ra món (${run.pass.length})`} right={<Text style={styles.hint}>Chọn món → bấm vào khách</Text>}>
      {run.pass.length === 0 ? (
        <Text style={styles.muted}>Chưa có món nào xong.</Text>
      ) : (
        <View style={styles.wrap}>
          {run.pass.map((d) => {
            const r = RECIPES[d.recipeId];
            const isSel = d.id === selectedDish;
            return (
              <Pressable
                key={d.id}
                onPress={() => setSelectedDish(isSel ? null : d.id)}
                style={[styles.dish, isSel && styles.dishSel, d.quality === 'burnt' && styles.dishBurnt]}
              >
                <Text style={styles.dishText}>
                  {r.emoji} {r.name}
                </Text>
                <Text style={styles.dishMeta}>
                  {d.quality === 'raw' ? '⚠️ sống ' : d.quality === 'burnt' ? '🔥 cháy ' : ''}
                  {d.noGarnish ? '🚫hành ' : ''}
                  {d.by !== 'Bạn' ? `· ${d.by}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {selected && (
        <View style={[styles.inline, { marginTop: 8 }]}>
          <Button small variant="danger" label="🗑️ Bỏ món này" onPress={() => { act((s) => discardDish(s, selected.id)); setSelectedDish(null); }} />
          <Button small variant="ghost" label="Bỏ chọn" onPress={() => setSelectedDish(null)} />
        </View>
      )}
    </Panel>
  );

  const customersPanel = (
    <Panel title={`🧑‍🤝‍🧑 Khách (${run.customers.filter((c) => c.kind !== 'delivery').length}/${game.upgrades.seats} bàn)`}>
      {run.customers.length === 0 && <Text style={styles.muted}>Quán đang vắng...</Text>}
      <View style={wide ? undefined : styles.grid}>
        {run.customers.map((c) => (
          <View key={c.id} style={wide ? undefined : styles.gridItem}>
            <CustomerCard
              customer={c}
              highlight={Boolean(selected && c.items.some((i) => !i.served && i.recipeId === selected.recipeId))}
              onPress={() => onCustomerPress(c.id)}
            />
          </View>
        ))}
      </View>
    </Panel>
  );

  const kitchenPanel = (
    <Panel title="👨‍🍳 Bếp">
      <View style={styles.wrap}>
        {run.slots.map((slot, i) => (
          <CookSlotCard
            key={slot.id}
            slot={slot}
            index={run.slots.filter((x, j) => x.station === slot.station && j < i).length}
            blocked={slot.station === 'stove' && (powerOut || gasOut)}
            staff={game.staff}
            onTakeOut={() => act((s) => playerTakeOut(s, slot.id))}
          />
        ))}
      </View>
      <View style={styles.cookHeader}>
        <Text style={styles.subTitle}>Nấu món:</Text>
        <Pressable onPress={() => setNoGarnish(!noGarnish)} style={[styles.toggle, noGarnish && styles.toggleOn]}>
          <Text style={[styles.toggleText, noGarnish && { color: '#fff' }]}>🚫 Không hành {noGarnish ? 'BẬT' : 'tắt'}</Text>
        </Pressable>
      </View>
      <View style={styles.wrap}>
        {game.unlockedRecipes.map((id) => (
          <CookButton key={id} game={game} recipeId={id} noGarnish={noGarnish} onPress={() => act((s) => playerCook(s, id, noGarnish))} />
        ))}
      </View>
    </Panel>
  );

  const prepPanel = (
    <Panel title="🔪 Sơ chế" right={<Text style={styles.hint}>4 phần / lần</Text>}>
      {run.playerPrep && (
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.muted}>Đang sơ chế {INGREDIENTS[run.playerPrep.ingredientId].name}...</Text>
          <ProgressBar value={1 - (run.playerPrep.endsAt - run.elapsed) / PLAYER_PREP_MS} color={colors.info} />
        </View>
      )}
      {prepIngredients(game).map((id) => {
        const ing = INGREDIENTS[id];
        const raw = usableQty(game, id);
        const ready = run.prepped[id] ?? 0;
        return (
          <View key={id} style={styles.prepRow}>
            <Text style={styles.emoji}>{ing.emoji}</Text>
            <View style={styles.flex}>
              <Text style={styles.bold}>{ing.name}</Text>
              <Text style={styles.muted}>
                Sống: {raw} · <Text style={{ color: ready ? colors.good : colors.bad, fontWeight: '700' }}>Đã sơ chế: {ready}</Text>
              </Text>
            </View>
            <Button small label="Sơ chế" disabled={Boolean(run.playerPrep) || raw === 0} onPress={() => act((s) => playerPrep(s, id))} />
          </View>
        );
      })}
    </Panel>
  );

  const staffPanel = (
    <>
      {game.staff.length > 0 && (
        <Panel title="👥 Nhân viên">
          {game.staff.map((st) => (
            <Text key={st.id} style={styles.staffRow}>
              {ROLE_EMOJI[st.role]} <Text style={styles.bold}>{st.name}</Text> ({ROLE_LABEL[st.role]}): {staffStatus(st, run.elapsed)}
            </Text>
          ))}
        </Panel>
      )}
      <Panel title="📜 Nhật ký">
        {run.log.slice(0, 15).map((l) => (
          <Text key={l.id} style={[styles.logRow, l.tone === 'bad' && { color: colors.bad }, l.tone === 'good' && { color: colors.good }]}>
            {formatClock(l.t, DAY_MS, OPEN_HOUR, CLOSE_HOUR)} {l.text}
          </Text>
        ))}
      </Panel>
    </>
  );

  if (wide) {
    return (
      <View style={styles.flex}>
        <Hud game={game} />
        {topBar}
        <View style={styles.columns}>
          <ScrollView style={styles.col} contentContainerStyle={styles.colContent}>
            {passPanel}
            {customersPanel}
          </ScrollView>
          <ScrollView style={styles.col} contentContainerStyle={styles.colContent}>
            {kitchenPanel}
            {prepPanel}
          </ScrollView>
          <ScrollView style={styles.col} contentContainerStyle={styles.colContent}>
            {staffPanel}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Hud game={game} />
      {topBar}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.colContent}>
        {tab === 'serve' && (
          <>
            {passPanel}
            {customersPanel}
          </>
        )}
        {tab === 'kitchen' && (
          <>
            {kitchenPanel}
            {passPanel}
          </>
        )}
        {tab === 'prep' && prepPanel}
        {tab === 'staff' && staffPanel}
      </ScrollView>
    </View>
  );
}

function CookButton({ game, recipeId, noGarnish, onPress }: { game: GameState; recipeId: keyof typeof RECIPES; noGarnish: boolean; onPress: () => void }) {
  const r = RECIPES[recipeId];
  const garnishOff = noGarnish && Boolean(r.garnish);
  const ok = canMake(game, recipeId, garnishOff);
  const missing = ok ? [] : missingFor(game, recipeId, garnishOff);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.cookBtn, !ok && styles.cookBtnOff, pressed && { opacity: 0.7 }]}>
      <Text style={styles.cookEmoji}>{r.emoji}</Text>
      <Text style={styles.cookName}>{r.name}</Text>
      <Text style={styles.cookMeta}>
        {r.station === 'stove' ? '🔥' : '🥤'} {r.cookTime / 1000}s
      </Text>
      {!ok && (
        <Text style={styles.cookMissing} numberOfLines={2}>
          Thiếu: {missing.map((m) => INGREDIENTS[m].name).join(', ')}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, backgroundColor: '#FFF3E0', borderBottomWidth: 1, borderBottomColor: colors.border },
  clock: { fontWeight: '800', color: colors.text, marginBottom: 4 },
  peak: { color: colors.bad },
  warn: { color: colors.bad },
  columns: { flex: 1, flexDirection: 'row' },
  col: { flex: 1 },
  colContent: { padding: 10, paddingBottom: 80 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: colors.primary },
  tabText: { fontSize: 12, color: colors.muted, fontWeight: '700' },
  tabTextActive: { color: colors.primary },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  gridItem: { width: '50%', paddingHorizontal: 4 },
  inline: { flexDirection: 'row', gap: 8 },
  hint: { fontSize: 11, color: colors.muted },
  muted: { color: colors.muted, fontSize: 12 },
  bold: { fontWeight: '700', color: colors.text },
  dish: { backgroundColor: colors.warnBg, borderRadius: 10, padding: 8, borderWidth: 2, borderColor: 'transparent' },
  dishSel: { borderColor: colors.primary, backgroundColor: colors.selected },
  dishBurnt: { backgroundColor: '#D7CCC8' },
  dishText: { fontWeight: '700', color: colors.text },
  dishMeta: { fontSize: 11, color: colors.muted },
  cookHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 },
  subTitle: { fontWeight: '800', color: colors.text },
  toggle: { borderWidth: 1, borderColor: colors.bad, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  toggleOn: { backgroundColor: colors.bad },
  toggleText: { color: colors.bad, fontWeight: '700', fontSize: 12 },
  cookBtn: { width: 104, backgroundColor: '#fff', borderWidth: 2, borderColor: colors.primary, borderRadius: 12, padding: 6, alignItems: 'center' },
  cookBtnOff: { borderColor: colors.border, opacity: 0.6 },
  cookEmoji: { fontSize: 26 },
  cookName: { fontWeight: '700', fontSize: 12, color: colors.text, textAlign: 'center' },
  cookMeta: { fontSize: 11, color: colors.muted },
  cookMissing: { fontSize: 10, color: colors.bad, textAlign: 'center' },
  prepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F7EDE2' },
  emoji: { fontSize: 22, width: 30, textAlign: 'center' },
  staffRow: { color: colors.text, marginBottom: 4 },
  logRow: { fontSize: 12, color: colors.text, marginBottom: 3 },
});
