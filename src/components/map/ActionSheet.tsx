import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { INGREDIENTS, KIND_LABEL, RECIPES } from '../../game/data';
import {
  discardDish,
  pickUpDish,
  playerClean,
  playerCook,
  playerPrep,
  playerServe,
  playerTakeOut,
  putDownDish,
} from '../../game/engine';
import type { GameMutation } from '../../game/GameContext';
import { canMake, missingFor, prepIngredients, usableQty } from '../../game/helpers';
import type { MapStation } from '../../game/layout';
import type { Customer, Dish, GameState } from '../../game/types';
import { Button, colors } from '../ui';

const TITLES: Record<MapStation['kind'], string> = {
  stove: '🔥 Bếp',
  counter: '🥤 Quầy pha chế',
  fridge: '🧊 Kho nguyên liệu',
  board: '🔪 Thớt sơ chế',
  trash: '🗑️ Thùng rác',
  mop: '🧽 Chỗ lau dọn',
  pass: '🛎️ Quầy ra món',
  table: '🪑 Bàn',
  door: '🚪 Cửa ra vào',
};

function dishLabel(d: Dish) {
  const r = RECIPES[d.recipeId];
  const q = d.quality === 'raw' ? ' (sống)' : d.quality === 'burnt' ? ' (cháy)' : '';
  return `${r.emoji} ${r.name}${d.noGarnish ? ' 🚫hành' : ''}${q}`;
}

function CustomerBlock({ c, held, act }: { c: Customer; held: Dish[]; act: (fn: GameMutation) => void }) {
  const label = KIND_LABEL[c.kind];
  return (
    <View style={styles.customer}>
      <Text style={styles.bold}>
        {c.emoji} {c.name} {c.size > 1 ? `(${c.size} người)` : ''} {label ? `· ${label}` : ''}
      </Text>
      <Text style={styles.text}>
        Gọi:{' '}
        {c.items
          .map((i) => `${i.served ? '✅' : RECIPES[i.recipeId].emoji} ${RECIPES[i.recipeId].name}${i.noGarnish && !i.served ? ' 🚫hành' : ''}`)
          .join(' · ')}
      </Text>
      <View style={styles.wrap}>
        {held.map((d) => (
          <Button key={d.id} small label={`Đưa ${dishLabel(d)}`} onPress={() => act((s, rng) => playerServe(s, d.id, c.id, rng))} />
        ))}
      </View>
    </View>
  );
}

export default function ActionSheet({
  station,
  game,
  act,
  noGarnish,
  setNoGarnish,
}: {
  station: MapStation | null;
  game: GameState;
  act: (fn: GameMutation) => void;
  noGarnish: boolean;
  setNoGarnish: (v: boolean) => void;
}) {
  const run = game.run!;
  const held = run.carrying.map((id) => run.pass.find((d) => d.id === id)).filter((d): d is Dish => Boolean(d));

  const handRow = (
    <Text style={styles.hands}>
      🤲 Trên tay: {held.length ? held.map(dishLabel).join(', ') : 'trống'}
    </Text>
  );

  if (!station) {
    return (
      <View style={styles.sheet}>
        {handRow}
        <Text style={styles.muted}>Chạm vào bếp, thớt, quầy ra món hoặc bàn khách để đi tới đó.</Text>
      </View>
    );
  }

  let body: React.ReactNode = null;

  if (!station.active) {
    body = <Text style={styles.muted}>Chưa mua. Nâng cấp quán vào buổi sáng để dùng chỗ này.</Text>;
  } else if (station.slotId) {
    const slot = run.slots.find((s) => s.id === station.slotId);
    const job = slot?.job;
    if (job) {
      const r = RECIPES[job.recipeId];
      const done = job.progress >= job.cookTime;
      const byStaff = job.by !== 'player' ? game.staff.find((s) => s.id === job.by) : undefined;
      body = byStaff ? (
        <Text style={styles.text}>
          {byStaff.name} đang nấu {r.emoji} {r.name}.
        </Text>
      ) : (
        <View style={styles.wrap}>
          <Text style={styles.text}>
            {r.emoji} {r.name} — {done ? 'chín rồi!' : `${Math.round((job.progress / job.cookTime) * 100)}%`}
          </Text>
          <Button
            small
            label={done ? 'Nhấc ra (cầm trên tay)' : 'Nhấc sớm (sẽ bị sống)'}
            variant={done ? 'primary' : 'secondary'}
            onPress={() => act((s) => playerTakeOut(s, slot!.id, true))}
          />
        </View>
      );
    } else {
      const recipes = game.unlockedRecipes.map((id) => RECIPES[id]).filter((r) => r.station === slot?.station);
      body = (
        <>
          <Pressable onPress={() => setNoGarnish(!noGarnish)} style={[styles.toggle, noGarnish && styles.toggleOn]}>
            <Text style={[styles.toggleText, noGarnish && { color: '#fff' }]}>🚫 Không hành: {noGarnish ? 'BẬT' : 'tắt'}</Text>
          </Pressable>
          <View style={styles.wrap}>
            {recipes.map((r) => {
              const off = noGarnish && Boolean(r.garnish);
              const ok = canMake(game, r.id, off);
              const missing = ok ? [] : missingFor(game, r.id, off);
              return (
                <View key={r.id} style={styles.cookItem}>
                  <Button small label={`${r.emoji} ${r.name}`} disabled={!ok} onPress={() => act((s) => playerCook(s, r.id, noGarnish))} />
                  {!ok && <Text style={styles.missing}>Thiếu: {missing.map((m) => INGREDIENTS[m].name).join(', ')}</Text>}
                </View>
              );
            })}
          </View>
        </>
      );
    }
  } else if (station.kind === 'board') {
    body = (
      <>
        {run.playerPrep && <Text style={styles.text}>Đang sơ chế {INGREDIENTS[run.playerPrep.ingredientId].name}...</Text>}
        <View style={styles.wrap}>
          {prepIngredients(game).map((id) => {
            const ing = INGREDIENTS[id];
            const raw = usableQty(game, id);
            const ready = run.prepped[id] ?? 0;
            return (
              <Button
                key={id}
                small
                variant={ready === 0 && raw > 0 ? 'primary' : 'secondary'}
                label={`${ing.emoji} ${ing.name} (${ready} sẵn · ${raw} sống)`}
                disabled={Boolean(run.playerPrep) || raw === 0}
                onPress={() => act((s) => playerPrep(s, id))}
              />
            );
          })}
        </View>
      </>
    );
  } else if (station.kind === 'fridge') {
    const ids = new Set<string>();
    for (const rid of game.unlockedRecipes) for (const i of Object.keys(RECIPES[rid].ingredients)) ids.add(i);
    body = (
      <Text style={styles.text}>
        {[...ids]
          .map((i) => {
            const ing = INGREDIENTS[i as keyof typeof INGREDIENTS];
            const extra = ing.needsPrep ? ` (+${run.prepped[ing.id] ?? 0} đã sơ chế)` : '';
            return `${ing.emoji} ${usableQty(game, ing.id)}${extra}`;
          })
          .join('   ')}
      </Text>
    );
  } else if (station.kind === 'pass') {
    const onCounter = run.pass.filter((d) => !run.carrying.includes(d.id));
    body = (
      <View style={styles.wrap}>
        {onCounter.length === 0 && held.length === 0 && <Text style={styles.muted}>Chưa có món nào xong.</Text>}
        {onCounter.map((d) => (
          <Button key={d.id} small label={`Cầm ${dishLabel(d)}`} onPress={() => act((s) => pickUpDish(s, d.id))} />
        ))}
        {held.map((d) => (
          <Button key={d.id} small variant="secondary" label={`Đặt xuống ${dishLabel(d)}`} onPress={() => act((s) => putDownDish(s, d.id))} />
        ))}
      </View>
    );
  } else if (station.kind === 'table' || station.kind === 'door') {
    const here =
      station.kind === 'table'
        ? run.customers.filter((c) => c.tableIndex === station.tableIndex)
        : run.customers.filter((c) => c.tableIndex === undefined);
    body =
      here.length === 0 ? (
        <Text style={styles.muted}>{station.kind === 'table' ? 'Bàn trống.' : 'Không có ai chờ ở cửa.'}</Text>
      ) : (
        here.map((c) => <CustomerBlock key={c.id} c={c} held={held} act={act} />)
      );
  } else if (station.kind === 'trash') {
    body =
      held.length === 0 ? (
        <Text style={styles.muted}>Tay không có gì để bỏ.</Text>
      ) : (
        <View style={styles.wrap}>
          {held.map((d) => (
            <Button key={d.id} small variant="danger" label={`Bỏ ${dishLabel(d)}`} onPress={() => act((s) => discardDish(s, d.id))} />
          ))}
        </View>
      );
  } else if (station.kind === 'mop') {
    const ready = run.elapsed >= run.cleanReadyAt;
    body = (
      <View style={styles.wrap}>
        <Text style={styles.text}>Vệ sinh: {Math.round(game.cleanliness)}%</Text>
        <Button small label={ready ? '🧽 Lau dọn quán (+20%)' : 'Đang nghỉ tay...'} disabled={!ready} onPress={() => act((s) => playerClean(s))} />
      </View>
    );
  }

  const index = station.slotId ? Number(station.slotId.replace(/\D/g, '')) + 1 : station.tableIndex !== undefined ? station.tableIndex + 1 : '';
  return (
    <View style={styles.sheet}>
      <Text style={styles.title}>
        {TITLES[station.kind]} {index}
      </Text>
      {handRow}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: 6 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  hands: { fontSize: 13, color: colors.primaryDark, fontWeight: '700' },
  text: { color: colors.text },
  bold: { fontWeight: '800', color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  customer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, gap: 4 },
  cookItem: { alignItems: 'flex-start' },
  missing: { fontSize: 10, color: colors.bad, maxWidth: 160 },
  toggle: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.bad, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  toggleOn: { backgroundColor: colors.bad },
  toggleText: { color: colors.bad, fontWeight: '700', fontSize: 12 },
});
