import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import FirstPersonView from '../../components/fp/FirstPersonView';
import ActionSheet from '../../components/map/ActionSheet';
import SimpleView from '../../components/map/SimpleView';
import GoMarketButton from '../../components/GoMarketButton';
import { useTutorialTargets } from '../../components/kid/TutorialGlow';
import MapHud from '../../components/scene/MapHud';
import SceneOverlay from '../../components/scene/SceneOverlay';
import ChatPrompt from '../../components/kid/ChatPrompt';
import { tutorialUi } from '../../components/kid/tutorialUi';
import RiverPath from '../../components/kid/RiverPath';
import { NotebookButton } from '../../components/notebook/NotebookSheet';
import type { FlowNext } from '../../game/dayflow';
import { shows } from '../../game/unlocks';
import ShopScene3D from '../../components/scene/ShopScene3D';
import { ISO_YAW, fitCamera, makeCamera, screenDirToTile } from '../../components/scene/camera';
import { colors } from '../../components/ui';
import { CLOSE_HOUR, DAY_MS, OPEN_HOUR, RECIPES, ROLE_EMOJI } from '../../game/data';
import { MAX_CARRY, autoServeCarried, discardDish, pickUpDish, playerClean, playerTakeOut } from '../../game/engine';
import { useGame, useGameState } from '../../game/GameContext';
import { formatClock } from '../../game/helpers';
import { MapStation, Tile, buildLayout, findPath, isWalkable, stationAt, stationNextTo } from '../../game/layout';
import { hasWebGL } from '../../three/webgl';
import { useWalker } from './useWalker';
import StaffSheet from '../../components/staff/StaffSheet';

/** Tên + việc sẽ làm khi tương tác (nút cạnh "Tay không"). */
function stationAction(st: MapStation, carrying: number, has3D: boolean): { icon: string; name: string; verb: string } {
  const n = st.slotId ? Number(st.slotId.replace(/\D/g, '')) + 1 : st.tableIndex !== undefined ? st.tableIndex + 1 : 0;
  switch (st.kind) {
    case 'board':
      return { icon: '🔪', name: 'Thớt', verb: has3D ? 'Vào bếp' : 'Thái' };
    case 'stove':
      return { icon: '🔥', name: `Bếp ${n}`, verb: 'Nấu' };
    case 'counter':
      return { icon: '🧋', name: `Quầy pha ${n}`, verb: 'Pha' };
    case 'fridge':
      return { icon: '📦', name: 'Kho', verb: 'Mở' };
    case 'pass':
      return { icon: '🛎️', name: 'Quầy ra món', verb: 'Lấy món' };
    case 'trash':
      return { icon: '🗑️', name: 'Rác', verb: 'Bỏ' };
    case 'mop':
      return { icon: '🧽', name: 'Rửa · lau', verb: 'Lau' };
    case 'door':
      return { icon: '🚪', name: 'Cửa', verb: carrying ? 'Đưa món' : 'Xem' };
    default:
      return { icon: '🪑', name: `Bàn ${n}`, verb: carrying ? 'Đưa món' : 'Xem' };
  }
}

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
  const { act, sceneMode, setSceneMode, setViewMode, paused } = useGame();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const run = game.run!;
  const layout = useMemo(() => buildLayout(game.upgrades), [game.upgrades]);
  const has3D = useMemo(hasWebGL, []);
  /** Chế độ Đơn giản (mặt bằng 2D, chạm là làm) — máy không có WebGL thì luôn dùng. */
  const simple = !has3D || sceneMode === 'simple';
  /** Chế độ Bố trí: hiện chỗ chưa mua ("+"). */
  const [arrange, setArrange] = useState(false);
  /** Camera isometric khoá 45°, xoay theo nấc 90° và 2 mức zoom. */
  const [rot, setRot] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [stockOpen, setStockOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffSel, setStaffSel] = useState<string | null>(null);
  const [sheetStation, setSheetStation] = useState<MapStation | null>(null);
  const targets = useTutorialTargets();

  // ---------- Khung cảnh & camera ----------
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (Math.abs(w - size.w) > 1 || Math.abs(h - size.h) > 1) setSize({ w, h });
  };
  const yaw = ISO_YAW + rot * (Math.PI / 2);
  // Camera nhìn từ phía tường sau: hạ tường sau cho khỏi che bếp.
  const cutaway = Math.cos(yaw) < 0;
  // Zoom 2 mức; điện thoại mặc định gần hơn và camera đi theo nhân vật.
  const zoom = (width < 600 ? [1.2, 1.75] : [1, 1.5])[zoomLevel];
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
  /** Chữ nổi ngắn khi tự làm việc lúc tới nơi (cầm món, bỏ rác, lau). */
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  }, []);

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
      } else if (station.kind === 'pass') {
        // Quầy ra món: tự cầm món (món khách đang chờ, không cháy, lên trước) tới khi đầy tay.
        const want = new Set(r.customers.flatMap((c) => c.items.filter((i) => !i.served).map((i) => i.recipeId)));
        const busy = new Set(gameRef.current.staff.map((st) => st.task?.dishId).filter(Boolean));
        const free = r.pass
          .filter((d) => !r.carrying.includes(d.id) && !busy.has(d.id))
          .sort((a, b) => Number(b.quality !== 'burnt') - Number(a.quality !== 'burnt') || Number(want.has(b.recipeId)) - Number(want.has(a.recipeId)));
        const take = free.slice(0, Math.max(0, MAX_CARRY - r.carrying.length));
        if (take.length) {
          act((s) => {
            for (const d of take) pickUpDish(s, d.id);
          });
          flash(`🤲 +${take.map((d) => RECIPES[d.recipeId].emoji).join('')}`);
        } else flash(r.carrying.length >= MAX_CARRY ? '🤲 đầy tay' : '🛎️ trống');
      } else if (station.kind === 'trash' && r.carrying.length) {
        // Thùng rác: bỏ món hỏng đang cầm; không có món hỏng thì bỏ hết.
        const held = r.carrying.map((id) => r.pass.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => Boolean(d));
        const bad = held.filter((d) => d.quality !== 'perfect');
        const drop = bad.length ? bad : held;
        act((s) => {
          for (const d of drop) discardDish(s, d.id);
        });
        flash(`🗑️ ${drop.map((d) => RECIPES[d.recipeId].emoji).join('')}`);
      } else if (station.kind === 'mop') {
        if (r.elapsed >= r.cleanReadyAt) {
          act((s) => playerClean(s));
          flash('🧽 ✨');
        } else flash('🧽 ⏳');
      }
    },
    [act, has3D, flash]
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

  // Gợi ý chuyển sang Đơn giản khi máy chậm (FPS < 30 kéo dài) hoặc pin yếu (< 20%) — hỏi một lần.
  const [suggest, setSuggest] = useState(false);
  const perfHint = shows(game, 'perfHint');
  useEffect(() => {
    // Không hỏi lúc đang hướng dẫn ngày đầu (chỉ đo khi đã xong).
    if (simple || !perfHint || suggestAsked || Platform.OS !== 'web' || typeof requestAnimationFrame === 'undefined') return;
    let raf = 0;
    let frames = 0;
    let slow = 0;
    let last = performance.now();
    const loop = (now: number) => {
      frames += 1;
      if (now - last >= 1000) {
        const fps = (frames * 1000) / (now - last);
        slow = fps < 30 ? slow + 1 : 0;
        frames = 0;
        last = now;
        if (slow >= 5 && !suggestAsked) {
          suggestAsked = true;
          setSuggest(true);
          return;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const nav = navigator as unknown as { getBattery?: () => Promise<{ level: number; charging: boolean }> };
    nav.getBattery?.()
      .then((b) => {
        if (b.level < 0.2 && !b.charging && !suggestAsked) {
          suggestAsked = true;
          setSuggest(true);
        }
      })
      .catch(() => {});
    return () => cancelAnimationFrame(raf);
  }, [simple, perfHint]);

  /** Chế độ Đơn giản: chạm trạm là làm luôn (không cần WebGL thì mở bảng thao tác). */
  const tapStation = useCallback(
    (st: MapStation) => {
      if (has3D) arrive(st);
      else setSheetStation(st);
    },
    [has3D, arrive]
  );
  const openUpgrades = () => navigation.navigate('Upgrades' as never);
  /** Đường sông "▶ Tiếp tục": đi tới trạm cần làm (bàn đang chờ món trên tay, thớt, bếp, quầy ra món). */
  const flowGo = useCallback(
    (next: FlowNext) => {
      if (!next.station) return;
      const st =
        next.station === 'table'
          ? layout.stations.find((x) => wanted.has(x.id))
          : layout.stations.find((x) => x.id === next.station && x.active) ?? layout.stations.find((x) => x.kind === 'board');
      if (!st) return;
      if (simple) tapStation(st);
      else goToStation(st);
    },
    [layout, wanted, simple, tapStation, goToStation]
  );
  // Dải Đường sông thu gọn nằm ngay dưới HUD.
  const river = game.tutorial.done;
  const toggle = has3D && shows(game, 'modeToggle');
  const RIVER_H = river ? 50 : 0;
  // HUD giờ chỉ là 1 hàng nhãn nhỏ.
  const HUD_H = 50 + RIVER_H;
  const cleanReady = run.elapsed >= run.cleanReadyAt;
  // Cụm nút tròn nhỏ ở góc phải dưới, tối đa 3 nút một hàng (ngày đầu chỉ có 🛒 Chợ).
  const staffBtn = shows(game, 'staff') || game.staff.length > 0;
  const barCount = 1 + [staffBtn, shows(game, 'clean'), shows(game, 'stock'), shows(game, 'panel'), shows(game, 'notebook'), !simple && shows(game, 'arrange')].filter(Boolean).length;
  const barRows = Math.ceil(barCount / BAR_PER_ROW);
  const BAR_H = barRows * BTN + (barRows - 1) * BAR_GAP + 10;
  const barW = Math.min(barCount, BAR_PER_ROW) * BTN + (Math.min(barCount, BAR_PER_ROW) - 1) * BAR_GAP;

  const actionBar = (
    <View style={[styles.bar, { width: barW }]}>
      {/* Chỉ hiện nút đã mở (src/game/unlocks.ts): ngày đầu gần như chỉ còn 🛒 Chợ. */}
      <GoMarketButton render={(onPress) => <BarButton icon="🛒" label="Chợ" onPress={onPress} />} />
      {staffBtn && (
        <BarButton
          icon="👥"
          label="Người"
          active={staffOpen}
          badge={game.staff.some((st) => st.mood < 30)}
          onPress={() => {
            setStaffOpen(!staffOpen);
            setStaffSel(null);
          }}
        />
      )}
      {shows(game, 'clean') && <BarButton icon="🧽" label={cleanReady ? 'Lau' : 'Lau ⏳'} disabled={!cleanReady} onPress={() => act((s) => playerClean(s))} />}
      {shows(game, 'stock') && <BarButton icon="📦" label="Kho" onPress={() => setStockOpen(true)} />}
      {shows(game, 'panel') && <BarButton icon="📋" label="Bảng" onPress={() => setViewMode('panel')} />}
      {shows(game, 'notebook') && <NotebookButton game={game} style={styles.barBtn} />}
      {!simple && shows(game, 'arrange') && <BarButton icon="🧱" label="Bố trí" active={arrange} onPress={() => setArrange(!arrange)} />}
    </View>
  );

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
        (!simple ? (
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
              onTapTile={arrange ? () => {} : goToTile}
              cutaway={cutaway}
              arrange={arrange}
              selectedStaff={staffOpen ? staffSel : null}
            />
            <SceneOverlay game={game} layout={layout} cam={baseCam} w={size.w} h={size.h} pan={overlayPan} onQuestion={setAskId} arrange={arrange} onPlus={openUpgrades} onStation={goToStation} nearId={walkingTo ?? hereId} />
            {/* Xoay theo nấc 90° và zoom 2 mức */}
            <View style={[styles.camCtl, { bottom: BAR_H + 12 }]}>
              <CamButton label="⟲" name="Xoay góc nhìn" onPress={() => setRot((r) => (r + 1) % 4)} />
              <CamButton label="+" name="Phóng to" disabled={zoomLevel === 1} onPress={() => setZoomLevel(1)} />
              <CamButton label="−" name="Thu nhỏ" disabled={zoomLevel === 0} onPress={() => setZoomLevel(0)} />
            </View>
            {arrange && (
              <View style={[styles.arrangeNote, { top: HUD_H + 6 }]} pointerEvents="none">
                <Text style={styles.arrangeText}>🧱 Bố trí · chạm ＋ để mua thêm bếp, quầy, bàn</Text>
              </View>
            )}
          </>
        ) : (
          <SimpleView game={game} layout={layout} targets={targets} onStation={tapStation} topInset={HUD_H + 28} bottomInset={Math.max(BAR_H, 56) + 12} />
        ))}
      {!fp && <MapHud canToggle={toggle} below={river ? <RiverPath game={game} compact onGo={flowGo} /> : null} />}
      {!fp && !paused && !staffOpen && actionBar}
      {!fp && !paused && staffOpen && (
        <StaffSheet
          selected={staffSel}
          onSelect={setStaffSel}
          onClose={() => {
            setStaffOpen(false);
            setStaffSel(null);
          }}
        />
      )}
      {/* Chip tay cầm gộp với tương tác: đứng cạnh đồ vật thì chip thành nút "🤲 … | 🔪 Thớt 👆 Vào bếp" (hoặc chạm lại vào đồ vật). */}
      {!fp && !paused && !staffOpen && (() => {
        const hands = `🤲 ${carried.length ? carried.map((d) => RECIPES[d.recipeId].emoji + (d.noGarnish ? '🚫' : '')).join(' ') : 'Tay không'}`;
        const near = !simple && hereStation && hereStation.active && !walkingTo ? hereStation : null;
        if (!near)
          return (
            <View pointerEvents="none" style={[styles.hands, { maxWidth: size.w - barW - 34 }]}>
              <Text style={styles.handsText}>{hands}</Text>
            </View>
          );
        const a = stationAction(near, run.carrying.length, has3D);
        return (
          <Pressable
            onPress={() => (near.kind === 'fridge' ? setStockOpen(true) : arrive(near))}
            style={({ pressed }) => [styles.hands, styles.handsAct, { maxWidth: size.w - barW - 34 }, pressed && { transform: [{ translateY: 2 }] }]}
            accessibilityRole="button"
            accessibilityLabel={`${a.verb}: ${a.name}`}
          >
            <Text style={styles.handsText}>{hands}</Text>
            <View style={styles.handsSep} />
            <Text style={styles.interactIcon}>{a.icon}</Text>
            <View>
              <Text style={styles.interactName} numberOfLines={1}>
                {a.name}
              </Text>
              <Text style={styles.interactVerb}>👆 {a.verb}</Text>
            </View>
          </Pressable>
        );
      })()}
      {!fp && !paused && toast && (
        <View pointerEvents="none" style={[styles.toast, { bottom: BAR_H + 56 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
      {!fp && !paused && suggest && !simple && shows(game, 'perfHint') && (
        <View style={[styles.suggest, { top: HUD_H + 6 }]}>
          <Text style={styles.suggestText}>🐢 Máy đang hơi chậm. Chuyển sang chế độ Đơn giản cho mượt?</Text>
          <View style={styles.suggestRow}>
            <Pressable style={[styles.suggestBtn, { backgroundColor: colors.brown }]} onPress={() => { setSuggest(false); setSceneMode('simple'); }} accessibilityRole="button">
              <Text style={[styles.suggestBtnText, { color: colors.cream }]}>Đơn giản</Text>
            </Pressable>
            <Pressable style={styles.suggestBtn} onPress={() => setSuggest(false)} accessibilityRole="button">
              <Text style={styles.suggestBtnText}>Giữ 3D</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );

  const asking = askId ? game.run?.customers.find((c) => c.id === askId) ?? null : null;
  const prompt = <ChatPrompt customer={asking} act={act} onClose={() => setAskId(null)} />;
  const fridge = layout.stations.find((s) => s.kind === 'fridge') ?? null;
  const modals = (
    <>
      {prompt}
      {(stockOpen || sheetStation) && (
        <Modal transparent animationType="none" visible onRequestClose={() => { setStockOpen(false); setSheetStation(null); }}>
          <Pressable style={styles.backdrop} onPress={() => { setStockOpen(false); setSheetStation(null); }}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <ScrollView contentContainerStyle={{ gap: 8 }}>
                <ActionSheet station={stockOpen ? fridge : sheetStation} game={game} act={act} noGarnish={noGarnish} setNoGarnish={setNoGarnish} />
              </ScrollView>
              <Pressable style={styles.closeBtn} onPress={() => { setStockOpen(false); setSheetStation(null); }} accessibilityRole="button">
                <Text style={styles.closeText}>✓ Xong</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
  if (wide) {
    return (
      <View style={styles.row}>
        {scene}
        {modals}
        <View style={styles.side}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.sideContent}>
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
            {Platform.OS === 'web' && <Text style={styles.hint}>👆 · ⌨️ WASD · E</Text>}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {scene}
      {modals}
    </View>
  );
}

/** Đã hỏi chuyển sang Đơn giản trong lần chơi này chưa. */
let suggestAsked = false;

const BTN = 52;
const BAR_GAP = 6;
const BAR_PER_ROW = 3;

/** Nút tròn nhỏ có nhãn trên cụm hành động (chunky). */
function BarButton({ icon, label, onPress, disabled, active, badge }: { icon: string; label: string; onPress: () => void; disabled?: boolean; active?: boolean; badge?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.barBtn, active && styles.barBtnOn, disabled && { opacity: 0.45 }, pressed && { transform: [{ translateY: 2 }] }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.barIcon}>{icon}</Text>
      <Text style={[styles.barLabel, active && { color: colors.cream }]} numberOfLines={1}>
        {label}
      </Text>
      {badge && <View style={styles.barBadge} />}
    </Pressable>
  );
}

function CamButton({ label, name, onPress, disabled }: { label: string; name: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.camBtn, disabled && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel={name}>
      <Text style={styles.camText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap-reverse',
    gap: BAR_GAP,
  },
  barBtn: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.chunkyShadow,
    borderBottomWidth: 4,
    flexGrow: 0,
    flexShrink: 0,
  },
  barBadge: { position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.bad, borderWidth: 2, borderColor: '#fff' },
  barBtnOn: { backgroundColor: colors.brown, borderColor: colors.brown },
  barIcon: { fontSize: 20, lineHeight: 22 },
  barLabel: { fontSize: 10, fontWeight: '900', color: colors.brown, lineHeight: 12 },
  camCtl: { position: 'absolute', right: 10, gap: 6 },
  camBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 4 },
  camText: { fontSize: 20, fontWeight: '900', color: colors.brown },
  arrangeNote: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.brown, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  arrangeText: { color: colors.cream, fontWeight: '900', fontSize: 13 },
  suggest: { position: 'absolute', left: 16, right: 16, backgroundColor: colors.cream, borderRadius: 18, padding: 12, gap: 8, borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 5 },
  suggestText: { fontSize: 15, fontWeight: '800', color: colors.brown },
  suggestRow: { flexDirection: 'row', gap: 8 },
  suggestBtn: { flex: 1, borderRadius: 16, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff', borderWidth: 2, borderColor: colors.chunkyShadow },
  suggestBtnText: { fontWeight: '900', color: colors.brown, fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: colors.cream, borderRadius: 20, padding: 14, maxHeight: '80%', gap: 10 },
  closeBtn: { alignSelf: 'center', backgroundColor: colors.brown, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 10 },
  closeText: { color: colors.cream, fontWeight: '900', fontSize: 16 },
  row: { flex: 1, flexDirection: 'row', backgroundColor: '#FBE3C6' },
  scene: { flex: 1, backgroundColor: '#FBE3C6', overflow: 'hidden' },
  hands: {
    position: 'absolute',
    left: 10,
    bottom: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  handsLow: { bottom: 14 },
  handsAct: { flexDirection: 'row', alignItems: 'center', gap: 6, borderColor: colors.primaryDark, borderBottomWidth: 4, paddingVertical: 4 },
  handsSep: { width: 2, alignSelf: 'stretch', backgroundColor: colors.border, marginHorizontal: 2 },
  interactIcon: { fontSize: 24 },
  interactName: { fontSize: 13, fontWeight: '900', color: colors.brown },
  interactVerb: { fontSize: 12, fontWeight: '900', color: colors.primaryDark },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 80,
    backgroundColor: 'rgba(62,39,35,0.85)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  toastLow: { bottom: 64 },
  toastText: { fontSize: 20, fontWeight: '900', color: '#fff' },
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
