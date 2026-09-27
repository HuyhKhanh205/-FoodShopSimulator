import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { BURN_FACTOR, PLAYER_PREP_MS, RECIPES, ROLE_EMOJI } from '../../game/data';
import type { MapStation, Tile } from '../../game/layout';
import type { CookSlot, Customer, Dish, GameState, Staff } from '../../game/types';
import { colors, patienceColor } from '../ui';

const STATION_STYLE: Record<MapStation['kind'], { bg: string; emoji: string; label?: string }> = {
  stove: { bg: '#546E7A', emoji: '🔥' },
  counter: { bg: '#4DB6AC', emoji: '🥤' },
  fridge: { bg: '#81D4FA', emoji: '🧊', label: 'Kho' },
  board: { bg: '#BCAAA4', emoji: '🔪', label: 'Thớt' },
  trash: { bg: '#9E9E9E', emoji: '🗑️' },
  mop: { bg: '#90CAF9', emoji: '🧽' },
  pass: { bg: '#FFCC80', emoji: '🛎️' },
  table: { bg: '#A1887F', emoji: '' },
  door: { bg: '#8D6E63', emoji: '🚪' },
};

function MiniBar({ value, color, tile }: { value: number; color: string; tile: number }) {
  return (
    <View style={[styles.miniTrack, { height: Math.max(3, tile * 0.08) }]}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

function slotState(slot: CookSlot | undefined) {
  const job = slot?.job;
  if (!job) return null;
  const r = RECIPES[job.recipeId];
  const done = job.progress >= job.cookTime;
  const burnRatio = (job.progress - job.cookTime) / (job.cookTime * (BURN_FACTOR - 1));
  const color = !done ? colors.accent : r.burns && burnRatio > 0.5 ? colors.bad : colors.good;
  const value = done && r.burns ? 1 - burnRatio : job.progress / job.cookTime;
  return { r, done, color, value, mine: job.by === 'player', warn: done && r.burns && burnRatio > 0.5 };
}

export function StationView({
  station,
  game,
  tile,
  highlight,
  onPress,
}: {
  station: MapStation;
  game: GameState;
  tile: number;
  highlight: boolean;
  onPress: () => void;
}) {
  const run = game.run!;
  const look = STATION_STYLE[station.kind];
  const box = {
    left: station.x * tile + 2,
    top: station.y * tile + 2,
    width: station.w * tile - 4,
    height: station.h * tile - 4,
  };
  const emojiSize = tile * 0.5;

  let content: React.ReactNode = <Text style={{ fontSize: emojiSize }}>{look.emoji}</Text>;
  let bar: React.ReactNode = null;

  if (station.slotId) {
    const st = slotState(run.slots.find((s) => s.id === station.slotId));
    if (st) {
      content = (
        <Text style={{ fontSize: emojiSize }}>
          {st.warn ? '⚠️' : st.r.emoji}
        </Text>
      );
      bar = <MiniBar value={st.value} color={st.color} tile={tile} />;
    }
  } else if (station.kind === 'board' && run.playerPrep) {
    bar = <MiniBar value={1 - (run.playerPrep.endsAt - run.elapsed) / PLAYER_PREP_MS} color={colors.info} tile={tile} />;
  } else if (station.kind === 'pass') {
    const dishes = run.pass.filter((d) => !run.carrying.includes(d.id));
    content = (
      <View style={styles.passRow}>
        {dishes.length === 0 ? (
          <Text style={{ fontSize: emojiSize * 0.8, opacity: 0.5 }}>🛎️</Text>
        ) : (
          dishes.slice(0, 8).map((d) => (
            <Text key={d.id} style={{ fontSize: emojiSize * 0.8, opacity: d.quality === 'burnt' ? 0.4 : 1 }}>
              {d.quality === 'burnt' ? '🔥' : RECIPES[d.recipeId].emoji}
            </Text>
          ))
        )}
        {dishes.length > 8 && <Text style={styles.small}>+{dishes.length - 8}</Text>}
      </View>
    );
  }

  const blocked = station.kind === 'stove' && (run.elapsed < run.powerOutUntil || run.elapsed < run.gasOutUntil);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.station,
        box,
        { backgroundColor: look.bg, borderRadius: tile * 0.15 },
        !station.active && styles.inactive,
        highlight && styles.highlight,
        blocked && { backgroundColor: '#263238' },
      ]}
    >
      {station.active ? content : <Text style={{ fontSize: emojiSize * 0.7, color: '#fff' }}>＋</Text>}
      {look.label && station.active && tile >= 36 && <Text style={styles.label}>{look.label}</Text>}
      {bar}
    </Pressable>
  );
}

export function TableView({
  station,
  customer,
  tile,
  highlight,
  wanted,
  onPress,
}: {
  station: MapStation;
  customer?: Customer;
  tile: number;
  highlight: boolean;
  wanted: boolean;
  onPress: () => void;
}) {
  const left = station.x * tile;
  const top = station.y * tile;
  const ratio = customer ? customer.patience / customer.maxPatience : 0;
  const open = customer?.items.filter((i) => !i.served) ?? [];
  return (
    <>
      <Pressable
        onPress={onPress}
        style={[
          styles.table,
          { left: left + 3, top: top + 3, width: tile - 6, height: tile - 6, borderRadius: tile / 2 },
          !station.active && styles.inactive,
          wanted && styles.wanted,
          highlight && styles.highlight,
        ]}
      >
        {customer ? (
          <Text style={{ fontSize: tile * 0.5 }}>{customer.emoji}</Text>
        ) : (
          <Text style={{ fontSize: tile * 0.35, opacity: 0.6 }}>{station.active ? '🪑' : '＋'}</Text>
        )}
        {customer && customer.size > 1 && <Text style={styles.sizeBadge}>{customer.size}</Text>}
      </Pressable>
      {customer && (
        <View pointerEvents="none" style={[styles.bubble, { left: left - tile * 0.35, top: top - tile * 0.62, width: tile * 1.7 }]}>
          <Text style={{ fontSize: tile * 0.26, textAlign: 'center' }} numberOfLines={2}>
            {open.map((i) => RECIPES[i.recipeId].emoji + (i.noGarnish ? '🚫' : '')).join('')}
          </Text>
          <View style={[styles.miniTrack, { height: 3, marginTop: 2 }]}>
            <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: patienceColor(ratio) }} />
          </View>
        </View>
      )}
    </>
  );
}

/** Trượt mượt tới ô mới mỗi khi `to` thay đổi. */
function useSlide(to: Tile, duration: number) {
  const pos = useRef(new Animated.ValueXY(to)).current;
  useEffect(() => {
    Animated.timing(pos, { toValue: to, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
  }, [to.x, to.y]); // eslint-disable-line react-hooks/exhaustive-deps
  return pos;
}

export function StaffSprite({ staff, to, tile }: { staff: Staff; to: Tile; tile: number }) {
  const pos = useSlide(to, 500);
  const holding = staff.task?.kind === 'serve';
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.person,
        { width: tile, height: tile, transform: [{ translateX: Animated.multiply(pos.x, tile) }, { translateY: Animated.multiply(pos.y, tile) }] },
      ]}
    >
      {holding && <Text style={{ fontSize: tile * 0.3 }}>🍽️</Text>}
      <Text style={{ fontSize: tile * 0.5 }}>{ROLE_EMOJI[staff.role]}</Text>
      <Text style={[styles.nameTag, { fontSize: Math.max(9, tile * 0.2) }]} numberOfLines={1}>
        {staff.name}
      </Text>
    </Animated.View>
  );
}

export function AvatarSprite({ pos, tile, carrying }: { pos: Animated.ValueXY; tile: number; carrying: Dish[] }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.person,
        { width: tile, height: tile, transform: [{ translateX: Animated.multiply(pos.x, tile) }, { translateY: Animated.multiply(pos.y, tile) }] },
      ]}
    >
      {carrying.length > 0 && (
        <View style={styles.carry}>
          {carrying.map((d) => (
            <Text key={d.id} style={{ fontSize: tile * 0.32 }}>
              {RECIPES[d.recipeId].emoji}
            </Text>
          ))}
        </View>
      )}
      <View style={[styles.me, { width: tile * 0.8, height: tile * 0.8, borderRadius: tile * 0.4 }]}>
        <Text style={{ fontSize: tile * 0.5 }}>🧑‍🍳</Text>
      </View>
    </Animated.View>
  );
}

export function WaitingAtDoor({ customers, tile, onPress }: { customers: Customer[]; tile: number; onPress: () => void }) {
  if (customers.length === 0) return null;
  return (
    <Pressable onPress={onPress} style={[styles.doorQueue, { left: 10 * tile, top: 7 * tile + tile * 0.1, width: tile * 2, height: tile * 0.8 }]}>
      {customers.slice(0, 3).map((c) => {
        const ratio = c.patience / c.maxPatience;
        return (
          <View key={c.id} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: tile * 0.38 }}>{c.emoji}</Text>
            <View style={[styles.miniTrack, { width: tile * 0.5, height: 3 }]}>
              <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: patienceColor(ratio) }} />
            </View>
          </View>
        );
      })}
      {customers.length > 3 && <Text style={styles.small}>+{customers.length - 3}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  station: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)' },
  inactive: { opacity: 0.3, borderStyle: 'dashed' },
  highlight: { borderColor: '#FFEB3B', borderWidth: 3 },
  wanted: { borderColor: colors.good, borderWidth: 3 },
  label: { position: 'absolute', top: 1, fontSize: 9, fontWeight: '800', color: '#fff' },
  miniTrack: { position: 'relative', width: '80%', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 2, overflow: 'hidden' },
  passRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' },
  small: { fontSize: 10, fontWeight: '700', color: colors.text },
  table: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: '#A1887F', borderWidth: 2, borderColor: '#6D4C41' },
  sizeBadge: { position: 'absolute', right: -2, bottom: -2, backgroundColor: colors.primary, color: '#fff', fontSize: 10, fontWeight: '800', paddingHorizontal: 4, borderRadius: 8, overflow: 'hidden' },
  bubble: { position: 'absolute', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 3, paddingVertical: 2, borderWidth: 1, borderColor: colors.border, zIndex: 5 },
  person: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'flex-end', zIndex: 10 },
  me: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,235,59,0.55)', borderWidth: 2, borderColor: colors.primary },
  carry: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 2, borderWidth: 1, borderColor: colors.primary },
  nameTag: { color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 3, borderRadius: 4, overflow: 'hidden', maxWidth: '140%' },
  doorQueue: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 10, zIndex: 4 },
});
