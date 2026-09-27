import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, GestureResponderEvent, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Hud from '../../components/Hud';
import ShopTopBar from '../../components/ShopTopBar';
import ActionSheet from '../../components/map/ActionSheet';
import { AvatarSprite, StaffSprite, StationView, TableView, WaitingAtDoor } from '../../components/map/MapPieces';
import { colors } from '../../components/ui';
import { CLOSE_HOUR, DAY_MS, OPEN_HOUR, ROLE_EMOJI } from '../../game/data';
import { autoServeCarried, playerTakeOut } from '../../game/engine';
import { useGame, useGameState } from '../../game/GameContext';
import { formatClock } from '../../game/helpers';
import {
  MAP_COLS,
  MAP_ROWS,
  PASS_ROW,
  MapLayout,
  MapStation,
  Tile,
  buildLayout,
  findPath,
  isWalkable,
  stationAt,
  stationNextTo,
} from '../../game/layout';
import type { GameState, Staff } from '../../game/types';

const STEP_MS = 170;

const KEY_DIRS: Record<string, Tile> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

/** Nhân viên đứng ở đâu: suy ra từ việc họ đang làm. */
function staffTarget(st: Staff, game: GameState, layout: MapLayout): Tile | null {
  const run = game.run!;
  if (st.absent || run.elapsed < st.lateUntil) return null;
  const byId = (id: string) => layout.stations.find((x) => x.id === id);
  const cookingSlot = run.slots.find((sl) => sl.job?.by === st.id);
  const slotId = cookingSlot?.id ?? st.task?.slotId;
  if (slotId) return byId(slotId)?.access[0] ?? layout.restSpot;
  const t = st.task;
  if (t?.kind === 'prep') return { x: 10, y: 2 };
  if (t?.kind === 'serve') {
    const c = run.customers.find((x) => x.id === t.customerId);
    const table = c?.tableIndex !== undefined ? byId(`table${c.tableIndex}`) : byId('door');
    return table?.access[0] ?? { x: 5, y: 5 };
  }
  if (t?.kind === 'clean') return { x: 6, y: 7 };
  if (st.role === 'cook') return { x: 5, y: 2 };
  if (st.role === 'prep') return { x: 8, y: 2 };
  if (st.role === 'waiter') return { x: 9, y: 5 };
  return layout.restSpot;
}

export default function ShopMapView() {
  const game = useGameState();
  const { act } = useGame();
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const run = game.run!;
  const layout = useMemo(() => buildLayout(game.upgrades), [game.upgrades]);

  // Kích thước ô tự co theo màn hình.
  const mapW = wide ? width - 380 - 24 : width - 16;
  const mapH = wide ? height - 130 : height - 130 - 230;
  const tile = Math.max(22, Math.floor(Math.min(mapW / MAP_COLS, mapH / MAP_ROWS)));

  // ---------- Nhân vật chủ quán ----------
  const posRef = useRef<Tile>(layout.start);
  const facingRef = useRef<Tile>({ x: 0, y: -1 });
  const anim = useRef(new Animated.ValueXY(layout.start)).current;
  const walkId = useRef(0);
  const [here, setHere] = useState<MapStation | null>(null);
  const [walkingTo, setWalkingTo] = useState<string | null>(null);
  const [noGarnish, setNoGarnish] = useState(false);

  // Giữ tham chiếu mới nhất cho callback hoạt ảnh.
  const gameRef = useRef(game);
  gameRef.current = game;

  const arrive = useCallback(
    (station: MapStation | null) => {
      setWalkingTo(null);
      setHere(station);
      if (!station || !station.active) return;
      const g = gameRef.current;
      const r = g.run;
      if (!r) return;
      // Tự động làm việc hiển nhiên khi tới nơi.
      if (station.slotId) {
        const job = r.slots.find((s) => s.id === station.slotId)?.job;
        if (job && job.by === 'player' && job.progress >= job.cookTime && r.carrying.length < 2) {
          act((s) => playerTakeOut(s, station.slotId!, true));
        }
      } else if ((station.kind === 'table' || station.kind === 'door') && r.carrying.length) {
        const ids = r.customers
          .filter((c) => (station.kind === 'table' ? c.tableIndex === station.tableIndex : c.tableIndex === undefined))
          .map((c) => c.id);
        if (ids.length) act((s, rng) => void autoServeCarried(s, ids, rng));
      }
    },
    [act]
  );

  const walkPath = useCallback(
    (path: Tile[], onDone: () => void) => {
      const id = ++walkId.current;
      anim.stopAnimation();
      const step = (i: number) => {
        if (id !== walkId.current) return;
        if (i >= path.length) {
          onDone();
          return;
        }
        const next = path[i];
        const prev = i === 0 ? posRef.current : path[i - 1];
        facingRef.current = { x: Math.sign(next.x - prev.x), y: Math.sign(next.y - prev.y) };
        Animated.timing(anim, { toValue: next, duration: STEP_MS, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
          if (!finished || id !== walkId.current) return;
          posRef.current = next;
          step(i + 1);
        });
      };
      step(0);
    },
    [anim]
  );

  const goToStation = useCallback(
    (station: MapStation) => {
      const path = findPath(layout, posRef.current, station.access);
      if (!path) return;
      setHere(null);
      setWalkingTo(station.id);
      walkPath(path, () => {
        // Quay mặt về phía đồ vật.
        const p = posRef.current;
        const cx = Math.min(Math.max(p.x, station.x), station.x + station.w - 1);
        const cy = Math.min(Math.max(p.y, station.y), station.y + station.h - 1);
        facingRef.current = { x: Math.sign(cx - p.x), y: Math.sign(cy - p.y) };
        arrive(station);
      });
    },
    [layout, walkPath, arrive]
  );

  const goToTile = useCallback(
    (t: Tile) => {
      const station = stationAt(layout, t.x, t.y);
      if (station) {
        goToStation(station);
        return;
      }
      const path = findPath(layout, posRef.current, [t]);
      if (!path) return;
      setHere(null);
      setWalkingTo(null);
      walkPath(path, () => arrive(stationNextTo(layout, t.x, t.y, facingRef.current)));
    },
    [layout, goToStation, walkPath, arrive]
  );

  // Bàn phím trên máy tính: WASD / mũi tên để đi, E / Space / Enter để thao tác.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const dir = KEY_DIRS[k];
      if (dir) {
        e.preventDefault();
        facingRef.current = dir;
        const p = posRef.current;
        const next = { x: p.x + dir.x, y: p.y + dir.y };
        if (!isWalkable(layout, next.x, next.y)) {
          arrive(stationAt(layout, next.x, next.y));
          return;
        }
        setWalkingTo(null);
        walkPath([next], () => setHere(stationNextTo(layout, next.x, next.y, facingRef.current)));
        return;
      }
      if (k === 'e' || k === ' ' || k === 'Enter') {
        e.preventDefault();
        const p = posRef.current;
        arrive(stationNextTo(layout, p.x, p.y, facingRef.current));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [layout, walkPath, arrive]);

  const onFloorPress = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    goToTile({ x: Math.floor(locationX / tile), y: Math.floor(locationY / tile) });
  };

  // ---------- Vẽ ----------
  const carried = run.carrying.map((id) => run.pass.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => Boolean(d));
  const doorCustomers = run.customers.filter((c) => c.tableIndex === undefined);
  const hereId = here?.id ?? null;
  const wantedTables = new Set(
    run.customers
      .filter((c) => c.items.some((i) => !i.served && carried.some((d) => d.recipeId === i.recipeId)))
      .map((c) => (c.tableIndex === undefined ? 'door' : `table${c.tableIndex}`))
  );
  // Luôn lấy bản mới nhất của đồ vật đang đứng cạnh (phòng khi nâng cấp đổi bố cục).
  const hereStation = here ? layout.stations.find((s) => s.id === here.id) ?? null : null;

  const map = (
    <View style={{ width: tile * MAP_COLS, height: tile * MAP_ROWS, alignSelf: 'center' }}>
      <View
        style={[StyleSheet.absoluteFill, styles.floor]}
        onStartShouldSetResponder={() => true}
        onResponderRelease={onFloorPress}
      >
        <View pointerEvents="none" style={[styles.zone, { top: 0, height: tile, backgroundColor: '#6D4C41' }]} />
        <View pointerEvents="none" style={[styles.zone, { top: tile, height: tile * (PASS_ROW - 1), backgroundColor: '#CFD8DC' }]} />
        <View pointerEvents="none" style={[styles.zone, { top: tile * PASS_ROW, height: tile, backgroundColor: '#ECEFF1' }]} />
        <View pointerEvents="none" style={[styles.zone, { top: tile * (PASS_ROW + 1), height: tile * (MAP_ROWS - PASS_ROW - 1), backgroundColor: '#F3DDB8' }]} />
        <Text pointerEvents="none" style={[styles.zoneLabel, { top: tile * 0.25, left: tile * 0.2 }]}>
          BẾP
        </Text>
        <Text pointerEvents="none" style={[styles.zoneLabel, { top: tile * (MAP_ROWS - 0.7), left: tile * 0.2, color: '#8D6E63' }]}>
          PHÒNG ĂN
        </Text>
      </View>

      {layout.stations.map((st) =>
        st.kind === 'table' ? (
          <TableView
            key={st.id}
            station={st}
            tile={tile}
            customer={run.customers.find((c) => c.tableIndex === st.tableIndex)}
            highlight={hereId === st.id || walkingTo === st.id}
            wanted={wantedTables.has(st.id)}
            onPress={() => goToStation(st)}
          />
        ) : (
          <StationView
            key={st.id}
            station={st}
            game={game}
            tile={tile}
            highlight={hereId === st.id || walkingTo === st.id || (st.kind === 'door' && wantedTables.has('door'))}
            onPress={() => goToStation(st)}
          />
        )
      )}

      <WaitingAtDoor customers={doorCustomers} tile={tile} onPress={() => goToStation(layout.stations.find((s) => s.id === 'door')!)} />

      {game.staff.map((st) => {
        const to = staffTarget(st, game, layout);
        return to ? <StaffSprite key={st.id} staff={st} to={to} tile={tile} /> : null;
      })}
      <AvatarSprite pos={anim} tile={tile} carrying={carried} />
    </View>
  );

  const logLines = run.log.slice(0, wide ? 12 : 3).map((l) => (
    <Text key={l.id} style={[styles.log, l.tone === 'bad' && { color: colors.bad }, l.tone === 'good' && { color: colors.good }]} numberOfLines={1}>
      {formatClock(l.t, DAY_MS, OPEN_HOUR, CLOSE_HOUR)} {l.text}
    </Text>
  ));

  const sheet = <ActionSheet station={hereStation} game={game} act={act} noGarnish={noGarnish} setNoGarnish={setNoGarnish} />;
  const hint =
    Platform.OS === 'web' ? 'Chạm/nhấp để đi · WASD hoặc phím mũi tên để đi · E / Space để thao tác' : 'Chạm vào đồ vật hoặc sàn để đi tới đó';

  if (wide) {
    return (
      <View style={styles.flex}>
        <Hud game={game} />
        <ShopTopBar showClean={false} />
        <View style={styles.row}>
          <View style={[styles.flex, styles.mapWrap]}>
            {map}
            <Text style={styles.hint}>{hint}</Text>
          </View>
          <View style={styles.side}>
          <ScrollView style={styles.flex} contentContainerStyle={{ padding: 12, gap: 12 }}>
            <View style={styles.card}>{sheet}</View>
            {game.staff.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>👥 Nhân viên</Text>
                {game.staff.map((st) => (
                  <Text key={st.id} style={styles.log}>
                    {ROLE_EMOJI[st.role]} {st.name}: {st.absent ? 'nghỉ' : run.elapsed < st.lateUntil ? 'đi trễ' : st.task ? 'đang làm' : 'rảnh'}
                  </Text>
                ))}
              </View>
            )}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📜 Nhật ký</Text>
              {logLines}
            </View>
          </ScrollView>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Hud game={game} />
      <ShopTopBar showClean={false} />
      <View style={styles.mapWrap}>{map}</View>
      <View style={styles.logBox}>{logLines}</View>
      <ScrollView style={styles.bottom} contentContainerStyle={{ padding: 10 }}>
        {sheet}
        <Text style={[styles.hint, { marginTop: 8 }]}>{hint}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  mapWrap: { padding: 8, alignItems: 'center' },
  floor: { borderRadius: 8, overflow: 'hidden', borderWidth: 3, borderColor: '#5D4037' },
  zone: { position: 'absolute', left: 0, right: 0 },
  zoneLabel: { position: 'absolute', fontSize: 10, fontWeight: '900', color: '#fff', opacity: 0.8 },
  side: { width: 380, flexGrow: 0, flexShrink: 0, borderLeftWidth: 1, borderLeftColor: colors.border, backgroundColor: colors.bg },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
  cardTitle: { fontWeight: '800', color: colors.text, marginBottom: 4 },
  bottom: { flex: 1, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border },
  logBox: { paddingHorizontal: 10, paddingBottom: 4 },
  log: { fontSize: 12, color: colors.text },
  hint: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 6 },
});
