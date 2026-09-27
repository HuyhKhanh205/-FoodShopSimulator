import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import FirstPersonView from '../../components/fp/FirstPersonView';
import ActionSheet from '../../components/map/ActionSheet';
import Map2D from '../../components/map/Map2D';
import MapHud from '../../components/scene/MapHud';
import SceneOverlay from '../../components/scene/SceneOverlay';
import ChatPrompt from '../../components/kid/ChatPrompt';
import { tutorialUi } from '../../components/kid/tutorialUi';
import ShopScene3D from '../../components/scene/ShopScene3D';
import { LANDSCAPE_YAW, PORTRAIT_YAW, fitCamera, makeCamera, screenDirToTile } from '../../components/scene/camera';
import { colors } from '../../components/ui';
import { CLOSE_HOUR, DAY_MS, OPEN_HOUR, RECIPES, ROLE_EMOJI } from '../../game/data';
import { MAX_CARRY, autoServeCarried, playerTakeOut } from '../../game/engine';
import { useGame, useGameState } from '../../game/GameContext';
import { formatClock } from '../../game/helpers';
import { MapStation, Tile, buildLayout, findPath, isWalkable, stationAt, stationNextTo } from '../../game/layout';
import { hasWebGL } from '../../three/webgl';
import { useWalker } from './useWalker';

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

export default function ShopMapView() {
  const game = useGameState();
  const { act } = useGame();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const run = game.run!;
  const layout = useMemo(() => buildLayout(game.upgrades), [game.upgrades]);
  const has3D = useMemo(hasWebGL, []);

  // ---------- Khung cảnh & camera ----------
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (Math.abs(w - size.w) > 1 || Math.abs(h - size.h) > 1) setSize({ w, h });
  };
  const portrait = size.h > size.w * 1.05;
  const yaw = portrait ? PORTRAIT_YAW : LANDSCAPE_YAW;
  // Điện thoại: phóng to cảnh 30% và camera đi theo nhân vật.
  const zoom = width < 600 ? 1.3 : 1;
  const cam = useMemo(makeCamera, []);
  const baseCam = useMemo(makeCamera, []);
  const overlayPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const frame = useMemo(() => {
    const w = Math.max(1, size.w);
    const h = Math.max(1, size.h);
    fitCamera(baseCam, w, h, yaw, zoom);
    return fitCamera(cam, w, h, yaw, zoom);
  }, [cam, baseCam, size.w, size.h, yaw, zoom]);

  // ---------- Nhân vật chủ quán ----------
  const walker = useWalker(layout.start);
  const [here, setHere] = useState<MapStation | null>(null);
  const [walkingTo, setWalkingTo] = useState<string | null>(null);
  const [noGarnish, setNoGarnish] = useState(false);
  /** Khách đang được trả lời câu hỏi (chạm vào ❓). */
  const [askId, setAskId] = useState<string | null>(null);
  /** Đồ vật đang thao tác ở góc nhìn thứ nhất (thớt / bếp / quầy). */
  const [fp, setFp] = useState<MapStation | null>(null);
  const fpOpen = useRef(false);
  fpOpen.current = fp !== null;
  useEffect(() => {
    tutorialUi.setFpOpen(fp !== null);
    return () => tutorialUi.setFpOpen(false);
  }, [fp]);
  const gameRef = useRef(game);
  gameRef.current = game;

  const arrive = useCallback(
    (station: MapStation | null) => {
      setWalkingTo(null);
      setHere(station);
      if (!station || !station.active) return;
      const r = gameRef.current.run;
      if (!r) return;
      // Tự động làm việc hiển nhiên khi tới nơi; thớt / bếp / quầy thì mở góc nhìn thứ nhất.
      if (station.slotId) {
        const job = r.slots.find((s) => s.id === station.slotId)?.job;
        if (job && job.by === 'player' && job.progress >= job.cookTime && r.carrying.length < MAX_CARRY) {
          act((s) => playerTakeOut(s, station.slotId!, true));
        } else if (has3D) {
          setFp(station);
        }
      } else if (station.kind === 'board' && has3D) {
        setFp(station);
      } else if ((station.kind === 'table' || station.kind === 'door') && r.carrying.length) {
        const ids = r.customers
          .filter((c) => (station.kind === 'table' ? c.tableIndex === station.tableIndex : c.tableIndex === undefined))
          .map((c) => c.id);
        if (ids.length) act((s, rng) => void autoServeCarried(s, ids, rng));
      }
    },
    [act, has3D]
  );

  const goToStation = useCallback(
    (station: MapStation) => {
      const path = findPath(layout, walker.origin(), station.access);
      if (!path) return;
      setHere(null);
      setWalkingTo(station.id);
      walker.walk(path, () => {
        // Quay mặt về phía đồ vật.
        const p = walker.origin();
        const cx = Math.min(Math.max(p.x, station.x), station.x + station.w - 1);
        const cy = Math.min(Math.max(p.y, station.y), station.y + station.h - 1);
        walker.face({ x: Math.sign(cx - p.x), y: Math.sign(cy - p.y) });
        arrive(station);
      });
    },
    [layout, walker, arrive]
  );

  const goToTile = useCallback(
    (t: Tile) => {
      const station = stationAt(layout, t.x, t.y);
      if (station) {
        goToStation(station);
        return;
      }
      const path = findPath(layout, walker.origin(), [t]);
      if (!path) return;
      setHere(null);
      setWalkingTo(null);
      walker.walk(path, () => arrive(stationNextTo(layout, t.x, t.y, walker.state.current.facing)));
    },
    [layout, goToStation, walker, arrive]
  );

  // Bàn phím trên máy tính: WASD / mũi tên để đi (theo hướng màn hình), E / Space / Enter để thao tác.
  const keyYaw = has3D ? yaw : 0;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      // Góc nhìn thứ nhất tự xử lý phím của nó.
      if (fpOpen.current) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const screenDir = KEY_DIRS[k];
      if (screenDir) {
        e.preventDefault();
        const dir = screenDirToTile(screenDir, keyYaw);
        walker.face(dir);
        const p = walker.dest();
        const next = { x: p.x + dir.x, y: p.y + dir.y };
        if (!isWalkable(layout, next.x, next.y)) {
          arrive(stationAt(layout, next.x, next.y));
          return;
        }
        setWalkingTo(null);
        walker.walk([next], () => {
          walker.face(dir);
          setHere(stationNextTo(layout, next.x, next.y, dir));
        });
        return;
      }
      if (k === 'e' || k === ' ' || k === 'Enter') {
        e.preventDefault();
        const p = walker.origin();
        arrive(stationNextTo(layout, p.x, p.y, walker.state.current.facing));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [layout, walker, arrive, keyYaw]);

  // ---------- Vẽ ----------
  const carried = run.carrying.map((id) => run.pass.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => Boolean(d));
  const wanted = new Set(
    run.customers
      .filter((c) => c.items.some((i) => !i.served && carried.some((d) => d.recipeId === i.recipeId)))
      .map((c) => (c.tableIndex === undefined ? 'door' : `table${c.tableIndex}`))
  );
  const hereId = here?.id ?? null;
  // Dãy bếp ở góc nhìn thứ nhất: thớt trước, rồi các bếp, rồi quầy pha chế.
  const kitchenStations = useMemo(() => {
    const order = { board: 0, stove: 1, counter: 2 } as Record<string, number>;
    return layout.stations.filter((s) => s.active && s.kind in order).sort((a, b) => order[a.kind] - order[b.kind] || a.x - b.x);
  }, [layout]);
  const hereStation = here ? layout.stations.find((s) => s.id === here.id) ?? null : null;

  const scene = (
    <View style={styles.scene} onLayout={onLayout}>
      {size.w > 0 && fp ? (
        <FirstPersonView
          station={layout.stations.find((x) => x.id === fp.id) ?? fp}
          stations={kitchenStations}
          game={game}
          act={act}
          onExit={() => setFp(null)}
          noGarnish={noGarnish}
          setNoGarnish={setNoGarnish}
        />
      ) : size.w > 0 &&
        (has3D ? (
          <>
            <ShopScene3D
              game={game}
              layout={layout}
              walker={walker.state}
              cam={cam}
              frame={frame}
              overlayPan={overlayPan}
              hereId={hereId}
              walkingTo={walkingTo}
              wanted={wanted}
              onTapTile={goToTile}
            />
            <SceneOverlay game={game} layout={layout} cam={baseCam} w={size.w} h={size.h} pan={overlayPan} onQuestion={setAskId} />
          </>
        ) : (
          <Map2D
            game={game}
            layout={layout}
            width={size.w}
            height={size.h - 90}
            anim={walker.anim}
            hereId={hereId}
            walkingTo={walkingTo}
            wanted={wanted}
            onTapTile={goToTile}
            onStation={goToStation}
          />
        ))}
      {!fp && <MapHud compact={!wide} />}
      {!fp && (
        <View pointerEvents="none" style={styles.hands}>
          <Text style={styles.handsText}>
            🤲 {carried.length ? carried.map((d) => RECIPES[d.recipeId].emoji + (d.noGarnish ? '🚫' : '')).join(' ') : 'Tay không'}
          </Text>
        </View>
      )}
    </View>
  );

  const sheet = <ActionSheet station={hereStation} game={game} act={act} noGarnish={noGarnish} setNoGarnish={setNoGarnish} />;
  const hint =
    Platform.OS === 'web' ? '👆 · ⌨️ WASD · E' : '👆';

  const asking = askId ? game.run?.customers.find((c) => c.id === askId) ?? null : null;
  const prompt = <ChatPrompt customer={asking} act={act} onClose={() => setAskId(null)} />;
  if (wide) {
    return (
      <View style={styles.row}>
        {scene}
        {prompt}
        <View style={styles.side}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.sideContent}>
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
              {run.log.slice(0, 12).map((l) => (
                <Text key={l.id} style={[styles.log, l.tone === 'bad' && { color: colors.bad }, l.tone === 'good' && { color: colors.good }]} numberOfLines={1}>
                  {formatClock(l.t, DAY_MS, OPEN_HOUR, CLOSE_HOUR)} {l.text}
                </Text>
              ))}
            </View>
            <Text style={styles.hint}>{hint}</Text>
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {scene}
      {prompt}
      {!fp && (
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            {sheet}
            <Text style={styles.hint}>{hint}</Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row', backgroundColor: '#FBE3C6' },
  scene: { flex: 1, backgroundColor: '#FBE3C6', overflow: 'hidden' },
  hands: {
    position: 'absolute',
    left: 10,
    bottom: 26,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  handsText: { fontSize: 15, fontWeight: '800', color: colors.primaryDark },
  side: { width: 380, flexGrow: 0, flexShrink: 0, borderLeftWidth: 1, borderLeftColor: colors.border, backgroundColor: colors.bg },
  sideContent: { padding: 12, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
  cardTitle: { fontWeight: '800', color: colors.text, marginBottom: 4 },
  sheet: {
    maxHeight: '32%',
    minHeight: 150,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D7CCC8', marginTop: 8 },
  sheetContent: { padding: 14, paddingTop: 8, gap: 8 },
  log: { fontSize: 12, color: colors.text },
  hint: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 6 },
});
