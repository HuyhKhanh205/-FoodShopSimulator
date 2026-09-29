import { useEffect, useMemo, useRef, useState } from 'react';
import { maxDpr } from '../../game/settings';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { burnGrace, INGREDIENTS, PLAYER_PREP_MS, RECIPES } from '../../game/data';
import { MAX_CARRY, playerChop, playerCookCombo, playerPrep, playerStir, playerTakeOut } from '../../game/engine';
import { kitchenNext } from '../../game/kitchenFlow';
import type { KitchenNext } from '../../game/kitchenFlow';
import NextButton from '../kid/NextButton';
import { suggestChop } from '../../game/helpers';
import type { GameMutation } from '../../game/GameContext';
import type { MapStation } from '../../game/layout';
import type { CookSlot, GameState, IngredientId, Station } from '../../game/types';
import { Canvas } from '../../three/fiber';
import type { ThreeEvent } from '../../three/fiber';
import HelpButton from '../kid/HelpButton';
import { tutorialUi } from '../kid/tutorialUi';
import OrderRail from './OrderRail';
import { usePotBuilder } from './PotBuilder';
import TutorialGlow, { useTutorialTarget, useTutorialTargets } from '../kid/TutorialGlow';
import { ProgressBar, colors } from '../ui';
import { BOARD_Z, Backdrop, BoardScene, CounterScene, EyeRig, Kitchen, KitchenCounter, STOVE_GAP, STOVE_SCALE, STOVE_Z, StoveScene, TOP_Y } from './FPScenes';
import type { PulseRef } from './FPScenes';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

type Run = NonNullable<GameState['run']>;

/** Trạng thái một nồi / ly. */
function slotInfo(run: Run, slot: CookSlot | undefined) {
  const job = slot?.job ?? null;
  const recipe = job ? RECIPES[job.recipeId] : null;
  const cookRatio = job ? job.progress / job.cookTime : 0;
  const burnRatio = job ? (job.progress - job.cookTime) / burnGrace(job.cookTime) : -1;
  const done = Boolean(job && job.progress >= job.cookTime);
  const warn = Boolean(recipe?.burns && burnRatio > 0.5);
  const blocked = slot?.station === 'stove' && (run.elapsed < run.powerOutUntil || run.elapsed < run.gasOutUntil);
  return { job, recipe, cookRatio, burnRatio, done, warn, blocked, mine: job?.by === 'player' };
}
type SlotInfo = ReturnType<typeof slotInfo>;

/** Trạng thái bếp bằng hình: món + ⏳ / ✅ / ⚠️ / 🔌 / 👤. */
function slotStatus(game: GameState, info: SlotInfo) {
  const { job, recipe, mine, blocked, done, warn } = info;
  if (!job || !recipe) return '—';
  if (!mine) return `${recipe.emoji} 👤 ${game.staff.find((s) => s.id === job.by)?.name ?? ''}`;
  if (blocked) return `${recipe.emoji} 🔌`;
  if (warn) return `${recipe.emoji} ⚠️ sắp cháy!`;
  if (done) return `${recipe.emoji} ✅ chín rồi!`;
  return `${recipe.emoji} ⏳`;
}

function slotBar(info: SlotInfo) {
  if (!info.job) return null;
  const value = info.done && info.recipe?.burns ? 1 - Math.max(0, info.burnRatio) : Math.min(1, info.cookRatio);
  const color = !info.done ? colors.accent : info.warn ? colors.bad : colors.good;
  return { value, color };
}

/** Phím trên máy tính: Esc về quán, Space / E thao tác, 1–9 khuấy / lấy món ở bếp tương ứng. */
function useKeys(handlers: { exit: () => void; action: () => void; digit?: (n: number) => void }) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        ref.current.exit();
      } else if (e.key === ' ' || e.key.toLowerCase() === 'e') {
        e.preventDefault();
        ref.current.action();
      } else if (/^[1-9]$/.test(e.key) && ref.current.digit) {
        e.preventDefault();
        ref.current.digit(+e.key);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

interface Props {
  station: MapStation;
  /** Các trạm đang hoạt động trong bếp (thớt, bếp, quầy). */
  stations: MapStation[];
  game: GameState;
  act: (fn: GameMutation) => void;
  onExit: () => void;
  noGarnish: boolean;
  setNoGarnish: (v: boolean) => void;
}

/**
 * Góc nhìn thứ nhất (kiểu Kebab Chefs, không vẽ tay). Thớt + các bếp là **một cảnh chung**: dãy bếp phía trên (xa),
 * thớt phía dưới (gần); chạm vào nồi để khuấy (chín thì lấy ra), chạm vào thớt để thái. Quầy pha chế là màn riêng.
 */
export default function FirstPersonView(props: Props) {
  return props.station.kind === 'counter' ? <CounterView {...props} /> : <KitchenView {...props} />;
}

function Header({
  onExit,
  carrying,
  asking = 0,
  game,
  topic,
  lines,
}: {
  onExit: () => void;
  carrying: number;
  /** Số khách đang chờ chủ quán trả lời câu hỏi. */
  asking?: number;
  /** Để hiện thanh phiếu order. */
  game: GameState;
  topic: 'kitchen' | 'counter';
  lines: { text: string; bar: { value: number; color: string } | null }[];
}) {
  const exitGlow = useTutorialTarget('kitchen.exit') && carrying > 0;
  return (
    <View pointerEvents="box-none" style={styles.top}>
      <View style={styles.topRow}>
        <TutorialGlow on={exitGlow} radius={14}>
        <Pressable
          onPress={onExit}
          style={[styles.exit, carrying > 0 && styles.exitServe]}
          accessibilityRole="button"
          accessibilityLabel={carrying > 0 ? `Ra phục vụ (${carrying})` : 'Rời bếp'}
        >
          <Text style={styles.exitText}>{carrying > 0 ? `🍽️×${carrying} ➡` : '⬅'}</Text>
          {asking > 0 && (
            <View style={styles.askBadge} accessibilityLabel={`${asking} khách đang hỏi chủ quán`}>
              <Text style={styles.askBadgeText}>💬❓</Text>
            </View>
          )}
        </Pressable>
        </TutorialGlow>
        {lines.length > 0 ? (
        <View pointerEvents="none" style={styles.titleBox}>
          {lines.map((l, i) => (
            <View key={i} style={{ gap: 3 }}>
              <Text style={styles.status} numberOfLines={1}>
                {l.text}
              </Text>
              {l.bar && <ProgressBar value={l.bar.value} color={l.bar.color} height={7} />}
            </View>
          ))}
        </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <HelpButton topic={topic} />
      </View>
      <OrderRail game={game} />
    </View>
  );
}

/** Ngón tay nhún nhảy chỉ chỗ cần chạm (thay cho câu hướng dẫn). */
function Pointer({ icon }: { icon: string }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: -8, duration: 350, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 350, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [y]);
  return (
    <Animated.View pointerEvents="none" style={[styles.hintBox, { transform: [{ translateY: y }] }]}>
      <Text style={styles.hint}>{icon}</Text>
    </Animated.View>
  );
}

/** Viền vàng nút Làm tiếp khi hướng dẫn ngày đầu đang chỉ đúng việc này. */
function nextGlow(next: KitchenNext, targets: string[]) {
  const k = next.action.kind;
  return targets.some((t) => t === next.key || (t === 'kitchen.cook' && k === 'cook') || (t === 'kitchen.board' && k === 'chop') || (t.startsWith('kitchen.prep:') && k === 'chop'));
}

/**
 * Phần điều khiển dưới cảnh bếp, gọn cho bé: nút to 👉 Làm tiếp (làm hết mọi việc), hàng nồi đang nấu,
 * và nút 🧪 Tự chọn (mở nồi 4 ô + nguyên liệu để tự sáng tạo món).
 */
function KitchenControls({
  game,
  station,
  slotIds,
  act,
  targets,
  onExit,
  onTap,
  onChop,
  onPrep,
  pot,
  icon,
  label,
}: {
  game: GameState;
  station: Station;
  slotIds: string[];
  act: (fn: GameMutation) => void;
  targets: string[];
  onExit: () => void;
  onTap: (slotId: string) => void;
  onChop: () => void;
  onPrep: (id: IngredientId) => void;
  pot: { top: React.ReactNode; list: React.ReactNode; count: number };
  icon: string;
  label: string;
}) {
  const [custom, setCustom] = useState(false);
  const next = kitchenNext(game, station, slotIds);
  const go = () => {
    const a = next.action;
    if (a.kind === 'take') act((s) => void playerTakeOut(s, a.slotId, true));
    else if (a.kind === 'exit') onExit();
    else if (a.kind === 'chop') onChop();
    else if (a.kind === 'prep') onPrep(a.ingredient);
    else if (a.kind === 'cook') act((s) => void playerCookCombo(s, Object.keys(RECIPES[a.recipeId].ingredients) as IngredientId[], a.slotId));
    else if (a.kind === 'stir') onTap(a.slotId);
  };
  const run = game.run!;
  const busy = slotIds.some((id) => run.slots.find((x) => x.id === id)?.job);
  const open = custom || pot.count > 0;
  // Bong bóng Chú Tư (đứng dưới) nằm trên phần nút này, không che nút xanh.
  useEffect(() => () => tutorialUi.setBottomInset(0), []);
  return (
    <View onLayout={(e) => tutorialUi.setBottomInset(Math.round(e.nativeEvent.layout.height) + 6)}>
      <View style={styles.fixed}>
        <TutorialGlow on={nextGlow(next, targets)} radius={20}>
          <NextButton label={next.label} disabled={next.action.kind === 'wait'} onPress={go} />
        </TutorialGlow>
        {busy && <SlotCards game={game} slotIds={slotIds} act={act} targets={[]} onTap={onTap} icon={icon} label={label} />}
        {open && pot.top}
        <Pressable onPress={() => setCustom(!open)} style={styles.customBtn} accessibilityRole="button" accessibilityLabel={open ? 'Đóng tự chọn nguyên liệu' : 'Tự chọn nguyên liệu'}>
          <Text style={styles.customText}>{open ? '▲ Thu gọn' : '🧪 Tự chọn nguyên liệu ▼'}</Text>
        </Pressable>
      </View>
      {open && (
        <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
          {pot.list}
        </ScrollView>
      )}
    </View>
  );
}

// ======================= Thớt + bếp chung một cảnh =======================

function KitchenView({ stations, game, act, onExit }: Props) {
  const run = game.run!;
  const { width: winW } = useWindowDimensions();
  // Bóng đổ chỉ bật trên màn lớn (máy tính) cho nhẹ điện thoại.
  const shadows = Platform.OS === 'web' && winW >= 700;
  const stoves = useMemo(() => stations.filter((s) => s.kind === 'stove' && s.slotId), [stations]);
  const slotIds = stoves.map((s) => s.slotId!);

  const boardPulse = useRef(0);
  const targets = useTutorialTargets();
  const stovePulses = useRef<Record<string, PulseRef>>({});
  const pulseOf = (id: string) => (stovePulses.current[id] ??= { current: 0 });
  const [lastPrep, setLastPrep] = useState<IngredientId | null>(null);
  const prep = run.playerPrep;
  const prepProgress = prep ? Math.min(1, 1 - (prep.endsAt - run.elapsed) / PLAYER_PREP_MS) : null;
  useEffect(() => {
    if (prep) setLastPrep(prep.ingredientId);
  }, [prep]);
  const pot = usePotBuilder({ game, station: 'stove', slotIds, act, targets });

  /** Chạm thớt: đang thái thì thái nhanh hơn; đang rảnh thì bắt đầu thái thêm món cần nhất (thái được nhiều lần). */
  const chop = () => {
    boardPulse.current = now();
    if (prep) act((s) => playerChop(s));
    else {
      const next = suggestChop(game);
      if (next) {
        setLastPrep(next);
        act((s) => void playerPrep(s, next));
      }
    }
  };
  /** Chạm vào nồi: chín thì nhấc ra, chưa chín thì khuấy. */
  const tapStove = (slotId: string) => {
    const info = slotInfo(run, run.slots.find((x) => x.id === slotId));
    pulseOf(slotId).current = now();
    if (!info.mine) return;
    if (info.done) {
      if (run.carrying.length < MAX_CARRY) act((s) => playerTakeOut(s, slotId, true));
    } else act((s) => playerStir(s, slotId));
  };
  // Nồi của mình chưa chín, gần chín nhất.
  const busiest = slotIds
    .map((id) => ({ id, info: slotInfo(run, run.slots.find((x) => x.id === id)) }))
    .filter((x) => x.info.mine && !x.info.done && !x.info.blocked)
    .sort((a, b) => b.info.cookRatio - a.info.cookRatio)[0];

  useKeys({
    exit: onExit,
    // Space / E: đang thái thì thái, không thì khuấy nồi gần chín nhất.
    action: () => {
      if (prep) chop();
      else if (busiest) tapStove(busiest.id);
    },
    digit: (n) => {
      const id = slotIds[n - 1];
      if (id) tapStove(id);
    },
  });

  // ---------- Tiêu đề ----------
  const prepLine = prep
    ? { text: `🔪 ${INGREDIENTS[prep.ingredientId].emoji} ⏳`, bar: { value: prepProgress ?? 0, color: colors.info } }
    : { text: lastPrep ? `🔪 ${INGREDIENTS[lastPrep].emoji} ✅ ×${run.prepped[lastPrep] ?? 0}` : '🔪 —', bar: null };
  const hint = prep ? '👆🔪' : busiest ? '👆🥄' : suggestChop(game) ? '👆🔪+' : null;

  // ---------- Cảnh 3D ----------
  const width = Math.max(1.5, stoves.length * STOVE_GAP);
  const stoveX = (i: number) => (i - (stoves.length - 1) / 2) * STOVE_GAP;
  const bowlId = lastPrep ?? null;
  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <Canvas shadows={shadows ? 'percentage' : false} dpr={[1, Math.min(1.5, maxDpr())]} camera={{ fov: 50, near: 0.05, far: 30 }} style={{ flex: 1 }}>
          <color attach="background" args={['#FFF3E0']} />
          <EyeRig width={width} depth={1.75} target={[0, TOP_Y, -0.2]} tilt={[0, 1.25, 0.8]} shadows={shadows} />
          <Backdrop from={-width / 2 - 1.5} to={width / 2 + 1.5} z={-0.3} />
          <KitchenCounter width={width} />
          {/* Dãy bếp phía xa */}
          {stoves.map((st, i) => {
            const info = slotInfo(run, run.slots.find((x) => x.id === st.slotId));
            const ring = info.warn ? '#FF5252' : info.mine && info.done ? '#43A047' : null;
            return (
              <group key={st.id} position={[stoveX(i), TOP_Y, STOVE_Z]}>
                <group scale={STOVE_SCALE}>
                  <group position={[0, -TOP_Y, 0.3]}>
                    <StoveScene
                      recipeId={info.job?.recipeId ?? null}
                      cooking={Boolean(info.job) && !info.done}
                      cookRatio={info.cookRatio}
                      burnRatio={info.job ? info.burnRatio : -1}
                      blocked={Boolean(info.blocked)}
                      pulse={pulseOf(st.slotId!)}
                    />
                  </group>
                </group>
                {/* Vòng xanh = chín (chạm để lấy), đỏ = sắp cháy */}
                {ring && (
                  <mesh position={[0, 0.012, 0]} rotation-x={-Math.PI / 2}>
                    <ringGeometry args={[0.3, 0.34, 40]} />
                    <meshBasicMaterial color={ring} transparent opacity={0.9} />
                  </mesh>
                )}
                {/* Vùng chạm vào nồi */}
                <mesh
                  position={[0, 0.12, 0]}
                  onClick={(e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation();
                    tapStove(st.slotId!);
                  }}
                >
                  <cylinderGeometry args={[0.36, 0.36, 0.3, 16]} />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
              </group>
            );
          })}
          {/* Thớt phía gần */}
          <group position={[-0.08, 0, BOARD_Z + 0.25]}>
            <BoardScene
              ingredient={prep?.ingredientId ?? null}
              progress={prepProgress}
              bowl={!prep && bowlId ? { id: bowlId, count: run.prepped[bowlId] ?? 0 } : null}
              pulse={boardPulse}
            />
            <mesh
              position={[0.1, TOP_Y + 0.08, -0.25]}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                chop();
              }}
            >
              <boxGeometry args={[1.5, 0.2, 0.7]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        </Canvas>
        <Header game={game} onExit={onExit} carrying={run.carrying.length} asking={run.customers.filter((c) => c.question).length} topic="kitchen" lines={prep || lastPrep ? [prepLine] : []} />
        {hint && <Pointer icon={hint} />}
      </View>
      <KitchenControls
        game={game}
        station="stove"
        slotIds={slotIds}
        act={act}
        targets={targets}
        onExit={onExit}
        onTap={tapStove}
        onChop={chop}
        onPrep={(id) => {
          setLastPrep(id);
          act((s) => void playerPrep(s, id));
        }}
        pot={pot}
        icon="🔥"
        label="Bếp"
      />
    </View>
  );
}

/**
 * Hàng thẻ bếp / ly: mỗi thẻ có món, tiến độ và nút 🍽️ Lấy ra riêng khi chín — không cần chọn bếp.
 * Chạm vào thẻ = khuấy (hoặc lấy ra nếu đã chín).
 */
function SlotCards({
  game,
  slotIds,
  act,
  targets,
  onTap,
  icon,
  label,
}: {
  game: GameState;
  slotIds: string[];
  act: (fn: GameMutation) => void;
  targets: string[];
  onTap: (slotId: string) => void;
  icon: string;
  label: string;
}) {
  const run = game.run!;
  const full = run.carrying.length >= MAX_CARRY;
  const ready = slotIds.filter((id) => {
    const info = slotInfo(run, run.slots.find((x) => x.id === id));
    return info.mine && info.done;
  });
  return (
    <View style={styles.cards}>
      {slotIds.map((id, i) => {
        const info = slotInfo(run, run.slots.find((x) => x.id === id));
        const bar = slotBar(info);
        const pct = info.job && !info.done ? `${Math.round(Math.min(1, info.cookRatio) * 100)}%` : '';
        return (
          <View key={id} style={[styles.card, info.warn && styles.cardWarn, info.mine && info.done && !info.warn && styles.cardDone]}>
            <Pressable onPress={() => onTap(id)} accessibilityRole="button" accessibilityLabel={`${label} ${i + 1}: ${slotStatus(game, info)}`} style={{ gap: 2 }}>
            <Text style={styles.cardTitle}>
              {info.recipe ? info.recipe.emoji : icon} <Text style={styles.cardSub}>{slotIds.length > 1 ? i + 1 : ''}</Text>
            </Text>
            <Text style={styles.cardSub} numberOfLines={1}>
              {!info.job ? 'trống' : !info.mine ? '👤' : info.blocked ? '🔌' : info.warn ? '⚠️ cháy!' : info.done ? '✅' : `⏳ ${pct}`}
            </Text>
            {bar && (
              <View style={styles.cardTrack}>
                <View style={{ width: `${bar.value * 100}%`, height: '100%', backgroundColor: bar.color }} />
              </View>
            )}
            </Pressable>
            {info.mine && info.done && (
              <TutorialGlow on={targets.includes('kitchen.takeout')} radius={10}>
                <Pressable
                  onPress={() => act((s) => playerTakeOut(s, id, true))}
                  disabled={full}
                  style={[styles.take, full && { opacity: 0.4 }]}
                  accessibilityRole="button"
                  accessibilityLabel={full ? 'Tay đã cầm đủ 2 món' : `Nhấc ra ${info.recipe?.name ?? ''}, cầm trên tay`}
                >
                  <Text style={styles.takeText}>{full ? '🤲 đầy' : '🍽️ Lấy'}</Text>
                </Pressable>
              </TutorialGlow>
            )}
          </View>
        );
      })}
      {ready.length >= 2 && !full && (
        <Pressable
          onPress={() =>
            act((s) => {
              for (const id of ready) playerTakeOut(s, id, true);
            })
          }
          style={[styles.card, styles.cardDone, { justifyContent: 'center' }]}
          accessibilityRole="button"
          accessibilityLabel="Lấy hết món đã chín"
        >
          <Text style={styles.cardTitle}>🍽️</Text>
          <Text style={styles.cardSub}>Lấy hết</Text>
        </Pressable>
      )}
    </View>
  );
}

// ======================= Quầy pha chế (màn riêng) =======================

function CounterView({ station, game, act, onExit }: Props) {
  const run = game.run!;
  const { width: winW } = useWindowDimensions();
  const shadows = Platform.OS === 'web' && winW >= 700;
  const pulse = useRef(0);
  const slot = station.slotId ? run.slots.find((s) => s.id === station.slotId) : undefined;
  const info = slotInfo(run, slot);
  const slotIds = slot ? [slot.id] : [];
  const pot = usePotBuilder({ game, station: 'counter', slotIds, act, targets: [] });

  const tap = () => {
    pulse.current = now();
    if (!slot || !info.mine) return;
    if (info.done) {
      if (run.carrying.length < MAX_CARRY) act((s) => playerTakeOut(s, slot.id, true));
    } else act((s) => playerStir(s, slot.id));
  };
  useKeys({ exit: onExit, action: tap, digit: (n) => n === 1 && tap() });

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <Canvas shadows={shadows ? 'percentage' : false} dpr={[1, Math.min(1.5, maxDpr())]} camera={{ fov: 50, near: 0.05, far: 30 }} style={{ flex: 1 }}>
          <color attach="background" args={['#FFF3E0']} />
          <EyeRig width={1.6} shadows={shadows} />
          <Backdrop from={-2} to={2} />
          <Kitchen top="#E0F2F1" body="#4DB6AC" />
          <CounterScene recipeId={info.job?.recipeId ?? null} drink={info.recipe?.drink ?? true} progress={Math.min(1, info.cookRatio)} pulse={pulse} />
        </Canvas>
        <Pressable accessibilityLabel="Lắc" onPress={tap} style={StyleSheet.absoluteFill} />
        <Header game={game} onExit={onExit} carrying={run.carrying.length} asking={run.customers.filter((c) => c.question).length} topic="counter" lines={[{ text: `🧋  ${slotStatus(game, info)}`, bar: slotBar(info) }]} />
        {info.mine && !info.done && <Pointer icon="👆🧋" />}
      </View>
      <KitchenControls
        game={game}
        station="counter"
        slotIds={slotIds}
        act={act}
        targets={[]}
        onExit={onExit}
        onTap={tap}
        onChop={() => {}}
        onPrep={() => {}}
        pot={pot}
        icon="🧋"
        label="Quầy"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF3E0' },
  stage: { flex: 1 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, padding: 8 },
  topRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  exit: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  exitServe: { backgroundColor: colors.good },
  askBadge: { position: 'absolute', top: -10, right: -14, backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 4, borderWidth: 2, borderColor: '#fff' },
  askBadgeText: { fontSize: 12 },
  exitText: { color: '#fff', fontWeight: '900', fontSize: 20 },
  titleBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  title: { fontSize: 15, fontWeight: '900', color: colors.text },
  status: { fontSize: 16, fontWeight: '800', color: colors.primaryDark },
  hintBox: { position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(62,39,35,0.7)', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 4 },
  hint: { fontSize: 30 },
  divider: { width: 2, alignSelf: 'stretch', backgroundColor: colors.border, marginHorizontal: 2 },
  hr: { height: 2, backgroundColor: colors.border, marginVertical: 6 },
  fixed: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4, gap: 6 },
  cards: { flexDirection: 'row', gap: 8 },
  card: {
    flex: 1,
    maxWidth: 130,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#FFFDF7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 2,
  },
  cardWarn: { borderColor: colors.bad, backgroundColor: '#FFEBEE' },
  cardDone: { borderColor: colors.good, backgroundColor: colors.goodBg },
  cardTitle: { fontSize: 22 },
  cardSub: { fontSize: 12, fontWeight: '800', color: colors.muted },
  cardTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.1)', overflow: 'hidden' },
  take: { marginTop: 2, backgroundColor: colors.good, borderRadius: 10, paddingVertical: 4, alignItems: 'center' },
  takeText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  controls: { maxHeight: 200, flexGrow: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border },
  controlsContent: { padding: 10, gap: 6 },
  section: { fontSize: 13, fontWeight: '900', color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 6, alignItems: 'center' },
  btn: { paddingVertical: 9, paddingHorizontal: 11, borderRadius: 12, minHeight: 40 },
  bigBtn: { paddingVertical: 16, borderRadius: 14 },
  missing: { fontSize: 10, color: colors.bad, maxWidth: 170 },
  chip: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff' },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.warnBg },
  chipWarn: { borderColor: colors.bad },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  chipTextOn: { color: colors.primaryDark, fontWeight: '900' },
  customBtn: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 10 },
  customText: { color: colors.muted, fontWeight: '800', fontSize: 13 },
  toggle: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.bad, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  toggleOn: { backgroundColor: colors.bad },
  toggleText: { color: colors.bad, fontWeight: '700', fontSize: 12 },
});
