import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import IconTile from '../kid/IconTile';
import { colors } from '../ui';

const TITLES: Record<MapStation['kind'], string> = {
  stove: '🔥 Bếp',
  counter: '🧋 Quầy',
  fridge: '🧊 Kho',
  board: '🔪 Thớt',
  trash: '🗑️',
  mop: '🧽',
  pass: '🛎️',
  table: '🪑 Bàn',
  door: '🚪',
};

function dishIcon(d: Dish) {
  const r = RECIPES[d.recipeId];
  return `${r.emoji}${d.quality === 'raw' ? '🩸' : d.quality === 'burnt' ? '🔥' : ''}${d.noGarnish ? '🚫' : ''}`;
}
function dishName(d: Dish) {
  const r = RECIPES[d.recipeId];
  const q = d.quality === 'raw' ? ' (sống)' : d.quality === 'burnt' ? ' (cháy)' : '';
  return `${r.name}${d.noGarnish ? ' không hành' : ''}${q}`;
}

function CustomerBlock({ c, held, act }: { c: Customer; held: Dish[]; act: (fn: GameMutation) => void }) {
  const label = KIND_LABEL[c.kind];
  return (
    <View style={styles.customer} accessibilityLabel={`${c.name}${label ? ` · ${label}` : ''}`}>
      <View style={styles.wrap}>
        <Text style={styles.custEmoji}>{c.emoji}</Text>
        {c.size > 1 && <Text style={styles.bold}>×{c.size}</Text>}
        <Text style={styles.orderArrow}>💬</Text>
        {c.items.map((i, k) => (
          <Text key={k} style={[styles.order, i.served && styles.orderDone]}>
            {i.served ? '✅' : RECIPES[i.recipeId].emoji}
            {i.noGarnish && !i.served ? '🚫' : ''}
          </Text>
        ))}
      </View>
      {held.length > 0 && (
        <View style={styles.wrap}>
          {held.map((d) => (
            <IconTile
              key={d.id}
              icon={dishIcon(d)}
              label="Đưa"
              name={`Đưa ${dishName(d)}`}
              tone="primary"
              size="sm"
              onPress={() => act((s, rng) => playerServe(s, d.id, c.id, rng))}
            />
          ))}
        </View>
      )}
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
    <Text style={styles.hands} accessibilityLabel={`Trên tay: ${held.length ? held.map(dishName).join(', ') : 'trống'}`}>
      🤲 {held.length ? held.map(dishIcon).join('  ') : '—'}
    </Text>
  );

  if (!station) {
    return (
      <View style={styles.sheet}>
        {handRow}
        <Text style={styles.hint}>👆 🔪 🔥 🍽️ 🪑</Text>
      </View>
    );
  }

  let body: React.ReactNode = null;

  if (!station.active) {
    body = <Text style={styles.hint}>🔒 → 🔧</Text>;
  } else if (station.slotId) {
    const slot = run.slots.find((s) => s.id === station.slotId);
    const job = slot?.job;
    if (job) {
      const r = RECIPES[job.recipeId];
      const done = job.progress >= job.cookTime;
      const byStaff = job.by !== 'player' ? game.staff.find((s) => s.id === job.by) : undefined;
      body = byStaff ? (
        <Text style={styles.hint} accessibilityLabel={`${byStaff.name} đang nấu ${r.name}`}>
          👤 {byStaff.name} → {r.emoji}
        </Text>
      ) : (
        <View style={styles.wrap}>
          <IconTile icon={r.emoji} name={r.name} badge={done ? '✅' : `${Math.round((job.progress / job.cookTime) * 100)}%`} size="sm" />
          <IconTile
            icon="🍽️"
            label={done ? 'Lấy ra' : 'Lấy sớm'}
            name={done ? 'Nhấc ra (cầm trên tay)' : 'Nhấc sớm (sẽ bị sống)'}
            tone={done ? 'primary' : 'plain'}
            onPress={() => act((s) => playerTakeOut(s, slot!.id, true))}
          />
        </View>
      );
    } else {
      const recipes = game.unlockedRecipes.map((id) => RECIPES[id]).filter((r) => r.station === slot?.station);
      body = (
        <View style={styles.wrap}>
          <IconTile icon="🚫🧅" name={`Không hành: ${noGarnish ? 'bật' : 'tắt'}`} selected={noGarnish} tone={noGarnish ? 'danger' : 'plain'} size="sm" onPress={() => setNoGarnish(!noGarnish)} />
          {recipes.map((r) => {
            const off = noGarnish && Boolean(r.garnish);
            const ok = canMake(game, r.id, off);
            const missing = ok ? [] : missingFor(game, r.id, off);
            return (
              <IconTile
                key={r.id}
                icon={r.emoji}
                name={r.name}
                disabled={!ok}
                missing={missing.map((m) => INGREDIENTS[m].emoji)}
                tone={ok ? 'primary' : 'plain'}
                onPress={() => act((s) => playerCook(s, r.id, noGarnish, slot?.id))}
              />
            );
          })}
        </View>
      );
    }
  } else if (station.kind === 'board') {
    body = (
      <View style={styles.wrap}>
        {prepIngredients(game).map((id) => {
          const ing = INGREDIENTS[id];
          const raw = usableQty(game, id);
          const ready = run.prepped[id] ?? 0;
          const busy = run.playerPrep?.ingredientId === id;
          return (
            <IconTile
              key={id}
              icon={ing.emoji}
              name={ing.name}
              badge={ready}
              sub={busy ? '🔪…' : `📦${raw}`}
              tone={ready === 0 && raw > 0 ? 'primary' : 'plain'}
              disabled={Boolean(run.playerPrep) || raw === 0}
              onPress={() => act((s) => playerPrep(s, id))}
            />
          );
        })}
      </View>
    );
  } else if (station.kind === 'fridge') {
    const ids = new Set<string>();
    for (const rid of game.unlockedRecipes) for (const i of Object.keys(RECIPES[rid].ingredients)) ids.add(i);
    body = (
      <View style={styles.wrap}>
        {[...ids].map((i) => {
          const ing = INGREDIENTS[i as keyof typeof INGREDIENTS];
          return (
            <IconTile
              key={i}
              size="sm"
              icon={ing.emoji}
              name={ing.name}
              badge={usableQty(game, ing.id)}
              sub={ing.needsPrep ? `🔪${run.prepped[ing.id] ?? 0}` : undefined}
            />
          );
        })}
      </View>
    );
  } else if (station.kind === 'pass') {
    const onCounter = run.pass.filter((d) => !run.carrying.includes(d.id));
    body = (
      <View style={styles.wrap}>
        {onCounter.length === 0 && held.length === 0 && <Text style={styles.hint}>🛎️ —</Text>}
        {onCounter.map((d) => (
          <IconTile key={d.id} icon={dishIcon(d)} label="Cầm" name={`Cầm ${dishName(d)}`} tone="primary" onPress={() => act((s) => pickUpDish(s, d.id))} />
        ))}
        {held.map((d) => (
          <IconTile key={d.id} icon={dishIcon(d)} label="Đặt ⬇️" name={`Đặt xuống ${dishName(d)}`} onPress={() => act((s) => putDownDish(s, d.id))} />
        ))}
      </View>
    );
  } else if (station.kind === 'table' || station.kind === 'door') {
    const here =
      station.kind === 'table'
        ? run.customers.filter((c) => c.tableIndex === station.tableIndex)
        : run.customers.filter((c) => c.tableIndex === undefined);
    body = here.length === 0 ? <Text style={styles.hint}>{station.kind === 'table' ? '🪑 —' : '🚪 —'}</Text> : here.map((c) => <CustomerBlock key={c.id} c={c} held={held} act={act} />);
  } else if (station.kind === 'trash') {
    body =
      held.length === 0 ? (
        <Text style={styles.hint}>🗑️ —</Text>
      ) : (
        <View style={styles.wrap}>
          {held.map((d) => (
            <IconTile key={d.id} icon={dishIcon(d)} label="Bỏ 🗑️" name={`Bỏ ${dishName(d)}`} tone="danger" onPress={() => act((s) => discardDish(s, d.id))} />
          ))}
        </View>
      );
  } else if (station.kind === 'mop') {
    const ready = run.elapsed >= run.cleanReadyAt;
    body = (
      <View style={styles.wrap}>
        <IconTile icon="🧽" label={ready ? 'Lau' : '…'} name="Lau dọn quán" badge={`${Math.round(game.cleanliness)}%`} tone="primary" disabled={!ready} onPress={() => act((s) => playerClean(s))} />
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
  sheet: { gap: 10 },
  title: { fontSize: 18, fontWeight: '900', color: colors.text },
  hands: { fontSize: 20, color: colors.primaryDark, fontWeight: '800' },
  hint: { fontSize: 26, color: colors.muted, letterSpacing: 4 },
  bold: { fontWeight: '900', color: colors.text, fontSize: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', paddingTop: 6 },
  customer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, gap: 4 },
  custEmoji: { fontSize: 32 },
  orderArrow: { fontSize: 18 },
  order: { fontSize: 28 },
  orderDone: { opacity: 0.6 },
});
