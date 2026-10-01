import { useEffect, useMemo, useRef, useState } from 'react';
import { maxDpr } from '../../game/settings';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { burnGrace, INGREDIENTS, PLAYER_PREP_MS, RECIPES } from '../../game/data';
import { MAX_CARRY, playerChop, playerPrep, playerStir, playerTakeOut } from '../../game/engine';
import { SCREEN_LABEL, screenBusy, screenNext } from '../../game/kitchenFlow';
import type { KitchenScreen } from '../../game/kitchenFlow';
import NextButton from '../kid/NextButton';
import { suggestChop, usableQty } from '../../game/helpers';
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
  nav?: ScreenNav;
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
  const startScreen = (): KitchenScreen => (props.station.kind === 'counter' ? 'counter' : props.station.kind === 'board' ? 'board' : 'stove');
  const [screen, setScreen] = useState<KitchenScreen>(startScreen);
  useEffect(() => setScreen(startScreen()), [props.station.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const counter = props.stations.find((s) => s.kind === 'counter' && s.slotId) ?? (props.station.kind === 'counter' ? props.station : null);
  const nav: ScreenNav = {
    screen,
    setScreen,
    stoveIds: props.stations.filter((s) => s.kind === 'stove' && s.slotId).map((s) => s.slotId!),
    counterIds: counter?.slotId ? [counter.slotId] : [],
  };
  return screen === 'counter' && counter ? <CounterView {...props} station={counter} nav={nav} /> : <KitchenView {...props} nav={nav} />;
}

interface ScreenNav {
  screen: KitchenScreen;
  setScreen: (s: KitchenScreen) => void;
  stoveIds: string[];
  counterIds: string[];
}

/** 3 nút chuyển màn: 🔪 Sơ chế | 🔥 Bếp | 🧋 Pha chế — chấm đỏ = màn đó đang có việc. */
function ScreenTabs({ game, nav, targets }: { game: GameState; nav: ScreenNav; targets: string[] }) {
  const busy = screenBusy(game, nav.stoveIds, nav.counterIds);
  const want = new Set(targets.map(screenOfTarget).filter(Boolean));
  const list: KitchenScreen[] = nav.counterIds.length ? ['board', 'stove', 'counter'] : ['board', 'stove'];
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {list.map((k) => {
        const on = nav.screen === k;
        return (
          <TutorialGlow key={k} on={want.has(k) && !on} radius={12} style={{ flex: 1 }}>
          <Pressable
            onPress={() => nav.setScreen(k)}
            style={[styles.tab, on && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Màn ${SCREEN_LABEL[k]}${busy[k] ? ' (có việc)' : ''}`}
          >
            <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
              {SCREEN_LABEL[k]}
            </Text>
            {busy[k] && !on && <View style={styles.tabDot} />}
          </Pressable>
          </TutorialGlow>
        );
      })}
    </View>
  );
}

function Header({
  onExit,
  carrying,
  asking = 0,
  game,
  topic,
  lines,
  act,
  slotIds,
}: {
  act?: (fn: GameMutation) => void;
  /** Bếp + quầy (để gửi món chín thẳng từ nồi). */
  slotIds?: string[];
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
      <OrderRail game={game} act={act} slotIds={slotIds} />
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

/** Màn Sơ chế: các đồ cần thái của menu, số phần đã thái / còn trong kho; chạm = thái thêm 1 mẻ. */
function PrepList({ game, onPrep, targets }: { game: GameState; onPrep: (id: IngredientId) => void; targets: string[] }) {
  const run = game.run!;
  const ids = [...new Set(game.unlockedRecipes.flatMap((r) => Object.keys(RECIPES[r]?.ingredients ?? {}) as IngredientId[]))].filter((i) => INGREDIENTS[i].needsPrep);
  if (!ids.length) return <Text style={styles.customText}>Menu hôm nay không có đồ cần thái.</Text>;
  return (
    <View style={styles.prepRow}>
      {ids.map((i) => {
        const raw = usableQty(game, i);
        const on = run.playerPrep?.ingredientId === i;
        return (
          <TutorialGlow key={i} on={targets.includes(`kitchen.prep:${i}`) && !run.playerPrep} radius={14}>
          <Pressable
            onPress={() => onPrep(i)}
            disabled={Boolean(run.playerPrep) || raw < 1}
            style={[styles.prepChip, on && styles.prepChipOn, (raw < 1 || (run.playerPrep && !on)) && { opacity: 0.45 }]}
            accessibilityRole="button"
            accessibilityLabel={`Thái ${INGREDIENTS[i].name}`}
          >
            <Text style={styles.prepEmoji}>{INGREDIENTS[i].emoji}</Text>
            <Text style={styles.prepSub}>
              {on ? '⏳' : `🔪${run.prepped[i] ?? 0}`} · 📦{raw}
            </Text>
          </Pressable>
          </TutorialGlow>
        );
      })}
    </View>
  );
}

/** Màn chứa việc mà hướng dẫn / nhãn gợi ý đang chỉ (để sáng nút chuyển màn). */
function screenOfTarget(t: string): KitchenScreen | null {
  if (t.startsWith('kitchen.tab:')) return t.slice(12) as KitchenScreen;
  if (t.startsWith('kitchen.prep:') || t === 'kitchen.board') return 'board';
  if (t.startsWith('kitchen.recipe:')) return RECIPES[t.slice(15)]?.station === 'counter' ? 'counter' : 'stove';
  if (t === 'kitchen.cook' || t === 'kitchen.takeout') return 'stove';
  return null;
}

/**
 * Phần điều khiển dưới cảnh bếp — người chơi tự làm mọi việc:
 * nút chuyển 3 màn, nhãn gợi ý nhỏ (chỉ nói việc tiếp theo, chạm để viền vàng chỗ cần bấm),
 * Sơ chế: các ô đồ cần thái; Bếp / Pha chế: thẻ nồi + nồi 4 ô + món và nguyên liệu (luôn hiện).
 */
function KitchenControls({
  nav,
  game,
  slotIds,
  act,
  targets,
  onTap,
  onPrep,
  pot,
  icon,
  label,
}: {
  nav: ScreenNav;
  game: GameState;
  slotIds: string[];
  act: (fn: GameMutation) => void;
  targets: string[];
  onTap: (slotId: string) => void;
  onPrep: (id: IngredientId) => void;
  pot: { top: React.ReactNode; list: React.ReactNode; count: number };
  icon: string;
  label: string;
}) {
  const next = screenNext(game, nav.screen, nav.stoveIds, nav.counterIds);
  const hintTarget = next.action.kind === 'switch' ? `kitchen.tab:${next.action.to}` : next.key || null;
  // Bong bóng Chú Tư (đứng dưới) nằm trên phần nút này.
  useEffect(() => () => tutorialUi.setBottomInset(0), []);
  return (
    <View style={nav.screen === 'board' ? undefined : styles.controlsWrap} onLayout={(e) => tutorialUi.setBottomInset(Math.min(260, Math.round(e.nativeEvent.layout.height)) + 6)}>
      <View style={styles.fixed}>
        <ScreenTabs game={game} nav={nav} targets={targets} />
        <NextButton label={next.label} target={hintTarget} disabled={next.action.kind === 'wait'} />
        {nav.screen === 'board' ? (
          <PrepList game={game} onPrep={onPrep} targets={targets} />
        ) : (
          <>
            <SlotCards game={game} slotIds={slotIds} act={act} targets={targets} onTap={onTap} icon={icon} label={label} />
            {pot.top}
          </>
        )}
      </View>
      {nav.screen !== 'board' && (
        <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
          {pot.list}
        </ScrollView>
      )}
    </View>
  );
}

// ======================= Thớt + bếp chung một cảnh =======================

function KitchenView({ stations, game, act, onExit, nav }: Props) {
  const run = game.run!;
  const onBoardScreen = nav!.screen === 'board';
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
  const pot = usePotBuilder({ game, station: 'stove', slotIds, act, targets, noChop: true });

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
  const hint = onBoardScreen ? (prep ? '👆🔪' : null) : busiest ? '👆🥄' : null;

  // ---------- Cảnh 3D ----------
  const width = Math.max(1.5, stoves.length * STOVE_GAP);
  const stoveX = (i: number) => (i - (stoves.length - 1) / 2) * STOVE_GAP;
  const bowlId = lastPrep ?? null;
  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <Canvas shadows={shadows ? 'percentage' : false} dpr={[1, Math.min(1.5, maxDpr())]} camera={{ fov: 50, near: 0.05, far: 30 }} style={{ flex: 1 }}>
          <color attach="background" args={['#6D4C41']} />
          {onBoardScreen ? (
            <EyeRig width={1.45} depth={0.8} target={[0.02, TOP_Y, BOARD_Z - 0.3]} tilt={[0, 1.7, 0.55]} shadows={shadows} />
          ) : (
            <EyeRig width={width} depth={0.7} target={[0, TOP_Y, STOVE_Z - 0.3]} tilt={[0, 1.5, 0.7]} shadows={shadows} />
          )}
          <Backdrop from={-width / 2 - 1.5} to={width / 2 + 1.5} z={-0.3} />
          <KitchenCounter width={width} />
          {/* Màn Bếp: dãy bếp */}
          {!onBoardScreen && stoves.map((st, i) => {
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
          {/* Màn Sơ chế: thớt */}
          {onBoardScreen && (
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
          )}
        </Canvas>
        <Header game={game} onExit={onExit} carrying={run.carrying.length} asking={run.customers.filter((c) => c.question).length} topic="kitchen" lines={onBoardScreen && (prep || lastPrep) ? [prepLine] : []} act={act} slotIds={[...nav!.stoveIds, ...nav!.counterIds]} />
        {hint && <Pointer icon={hint} />}
      </View>
      <KitchenControls
        nav={nav!}
        game={game}
        slotIds={slotIds}
        act={act}
        targets={targets}
        onTap={tapStove}
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

function CounterView({ station, game, act, onExit, nav }: Props) {
  const run = game.run!;
  const { width: winW } = useWindowDimensions();
  const shadows = Platform.OS === 'web' && winW >= 700;
  const pulse = useRef(0);
  const slot = station.slotId ? run.slots.find((s) => s.id === station.slotId) : undefined;
  const info = slotInfo(run, slot);
  const slotIds = slot ? [slot.id] : [];
  const targets = useTutorialTargets();
  const pot = usePotBuilder({ game, station: 'counter', slotIds, act, targets });

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
          <color attach="background" args={['#00796B']} />
          <EyeRig width={1.6} shadows={shadows} />
          <Backdrop from={-2} to={2} />
          <Kitchen top="#E0F2F1" body="#4DB6AC" />
          <CounterScene recipeId={info.job?.recipeId ?? null} drink={info.recipe?.drink ?? true} progress={Math.min(1, info.cookRatio)} pulse={pulse} />
        </Canvas>
        <Pressable accessibilityLabel="Lắc" onPress={tap} style={StyleSheet.absoluteFill} />
        <Header game={game} onExit={onExit} carrying={run.carrying.length} asking={run.customers.filter((c) => c.question).length} topic="counter" lines={info.job ? [{ text: `🧋  ${slotStatus(game, info)}`, bar: slotBar(info) }] : []} act={act} slotIds={[...nav!.stoveIds, ...nav!.counterIds]} />
        {info.mine && !info.done && <Pointer icon="👆🧋" />}
      </View>
      <KitchenControls nav={nav!} game={game} slotIds={slotIds} act={act} targets={targets} onTap={tap} onPrep={() => {}} pot={pot} icon="🧋" label="Quầy" />
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
  controlsWrap: { maxHeight: '58%' },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { flex: 1, paddingVertical: 7, borderRadius: 12, backgroundColor: '#FFF3E0', borderWidth: 2, borderColor: colors.chunkyShadow, alignItems: 'center' },
  tabOn: { backgroundColor: colors.brown, borderColor: colors.brown },
  tabText: { fontWeight: '900', fontSize: 14, color: colors.brown },
  tabTextOn: { color: colors.cream },
  tabDot: { position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.bad, borderWidth: 2, borderColor: '#fff' },
  prepRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  prepChip: { minWidth: 72, alignItems: 'center', borderRadius: 14, borderWidth: 2, borderColor: colors.chunkyShadow, backgroundColor: '#fff', paddingVertical: 4, paddingHorizontal: 8 },
  prepChipOn: { borderColor: colors.info, backgroundColor: '#E3F2FD' },
  prepEmoji: { fontSize: 24 },
  prepSub: { fontSize: 12, fontWeight: '800', color: colors.muted },
  customBtn: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 10 },
  customText: { color: colors.muted, fontWeight: '800', fontSize: 13 },
  toggle: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.bad, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  toggleOn: { backgroundColor: colors.bad },
  toggleText: { color: colors.bad, fontWeight: '700', fontSize: 12 },
});
