import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BURN_FACTOR, INGREDIENTS, PLAYER_PREP_MS, RECIPES } from '../../game/data';
import { MAX_CARRY, playerChop, playerCook, playerPrep, playerStir, playerTakeOut } from '../../game/engine';
import type { GameMutation } from '../../game/GameContext';
import { canMake, missingFor, prepIngredients, usableQty } from '../../game/helpers';
import type { MapStation } from '../../game/layout';
import type { CookSlot, GameState, IngredientId } from '../../game/types';
import { Canvas } from '../../three/fiber';
import type { ThreeEvent } from '../../three/fiber';
import HelpButton from '../kid/HelpButton';
import OrderRail from './OrderRail';
import TutorialGlow, { useTutorialTarget, useTutorialTargets } from '../kid/TutorialGlow';
import IconTile from '../kid/IconTile';
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
  const burnRatio = job ? (job.progress - job.cookTime) / (job.cookTime * (BURN_FACTOR - 1)) : -1;
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

function takeOutLabel(run: Run, info: SlotInfo) {
  if (run.carrying.length >= MAX_CARRY) return 'Tay đầy';
  if (!info.done) return 'Lấy sớm';
  if (info.warn) return 'Lấy ngay!';
  return 'Lấy ra';
}
function takeOutName(run: Run, info: SlotInfo) {
  if (run.carrying.length >= MAX_CARRY) return 'Tay đã cầm đủ 2 món';
  if (!info.done) return 'Nhấc sớm (món sẽ bị sống)';
  return 'Nhấc ra, cầm trên tay';
}

/** Phím trên máy tính: Esc về quán, Space / E thao tác, 1–9 chọn bếp. */
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
 * thớt phía dưới (gần); chạm vào nồi để chọn / khuấy, chạm vào thớt để thái. Quầy pha chế là màn riêng.
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

// ======================= Thớt + bếp chung một cảnh =======================

function KitchenView({ station: initial, stations, game, act, onExit, noGarnish, setNoGarnish }: Props) {
  const run = game.run!;
  const { width: winW } = useWindowDimensions();
  // Bóng đổ chỉ bật trên màn lớn (máy tính) cho nhẹ điện thoại.
  const shadows = Platform.OS === 'web' && winW >= 700;
  const stoves = useMemo(() => stations.filter((s) => s.kind === 'stove' && s.slotId), [stations]);
  const [sel, setSel] = useState<string | null>(() => (initial.kind === 'stove' ? initial.slotId ?? null : stoves[0]?.slotId ?? null));
  const selIndex = Math.max(0, stoves.findIndex((s) => s.slotId === sel));
  const selSlotId = stoves[selIndex]?.slotId;
  const selSlot = run.slots.find((x) => x.id === selSlotId);
  const selInfo = slotInfo(run, selSlot);

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

  const chop = () => {
    boardPulse.current = now();
    if (prep) act((s) => playerChop(s));
  };
  const stir = (slotId: string) => {
    const info = slotInfo(run, run.slots.find((x) => x.id === slotId));
    pulseOf(slotId).current = now();
    if (info.mine && !info.done) act((s) => playerStir(s, slotId));
  };
  const tapStove = (slotId: string) => {
    setSel(slotId);
    stir(slotId);
  };

  useKeys({
    exit: onExit,
    // Space / E: đang thái thì thái, không thì khuấy nồi đang chọn.
    action: () => {
      if (prep) chop();
      else if (selSlotId) stir(selSlotId);
    },
    digit: (n) => {
      const id = stoves[n - 1]?.slotId;
      if (id) setSel(id);
    },
  });

  // ---------- Tiêu đề ----------
  const prepLine = prep
    ? { text: `🔪 ${INGREDIENTS[prep.ingredientId].emoji} ⏳`, bar: { value: prepProgress ?? 0, color: colors.info } }
    : { text: lastPrep ? `🔪 ${INGREDIENTS[lastPrep].emoji} ✅ ×${run.prepped[lastPrep] ?? 0}` : '🔪 —', bar: null };
  const stoveLine = selSlot ? { text: `🔥${selIndex + 1}  ${slotStatus(game, selInfo)}`, bar: slotBar(selInfo) } : { text: '🔥 —', bar: null };
  const hint = prep ? '👆🔪' : selInfo.mine && !selInfo.done && !selInfo.blocked ? '👆🥄' : null;

  // ---------- Điều khiển: bếp ở trên, thớt ở dưới ----------
  const recipes = game.unlockedRecipes.map((id) => RECIPES[id]).filter((r) => r.station === 'stove');
  const stoveControls = (
    <View style={styles.wrap}>
      {stoves.map((st, i) => {
        const info = slotInfo(run, run.slots.find((x) => x.id === st.slotId));
        const badge = !info.job ? '' : !info.mine ? '👤' : info.warn ? '⚠️' : info.done ? '✅' : `${Math.round(Math.min(1, info.cookRatio) * 100)}%`;
        return (
          <IconTile
            key={st.id}
            size="sm"
            icon={info.recipe ? info.recipe.emoji : '🔥'}
            label={`Bếp ${i + 1}`}
            name={`Bếp ${i + 1}`}
            badge={badge}
            selected={st.slotId === selSlotId}
            tone={info.warn ? 'danger' : 'plain'}
            onPress={() => setSel(st.slotId!)}
          />
        );
      })}
      <View style={styles.divider} />
      {selSlot && !selInfo.job && (
        <>
          <IconTile
            size="sm"
            icon="🚫🧅"
            name={`Không hành: ${noGarnish ? 'bật' : 'tắt'}`}
            selected={noGarnish}
            tone={noGarnish ? 'danger' : 'plain'}
            onPress={() => setNoGarnish(!noGarnish)}
          />
          {recipes.map((r) => {
            const off = noGarnish && Boolean(r.garnish);
            const ok = canMake(game, r.id, off);
            return (
              <TutorialGlow key={r.id} on={targets.includes(`kitchen.recipe:${r.id}`)}>
                <IconTile
                  icon={r.emoji}
                  name={r.name}
                  disabled={!ok}
                  missing={ok ? undefined : missingFor(game, r.id, off).map((m) => INGREDIENTS[m].emoji)}
                  tone={ok ? 'primary' : 'plain'}
                  onPress={() => act((s) => playerCook(s, r.id, noGarnish, selSlot.id))}
                />
              </TutorialGlow>
            );
          })}
        </>
      )}
      {selSlot && selInfo.mine && (
        <TutorialGlow on={targets.includes('kitchen.takeout') && selInfo.done}>
          <IconTile
            icon="🍽️"
            label={takeOutLabel(run, selInfo)}
            name={takeOutName(run, selInfo)}
            tone={!selInfo.done ? 'plain' : selInfo.warn ? 'danger' : 'good'}
            disabled={run.carrying.length >= MAX_CARRY}
            onPress={() => act((s) => playerTakeOut(s, selSlot.id, true))}
          />
        </TutorialGlow>
      )}
    </View>
  );
  const boardControls = (
    <View style={styles.wrap}>
      {prepIngredients(game).map((id) => {
        const ing = INGREDIENTS[id];
        const raw = usableQty(game, id);
        const ready = run.prepped[id] ?? 0;
        return (
          <TutorialGlow key={id} on={targets.includes(`kitchen.prep:${id}`)}>
            <IconTile
              icon={ing.emoji}
              name={ing.name}
              badge={ready}
              sub={`📦${raw}`}
              tone={ready === 0 && raw > 0 ? 'primary' : 'plain'}
              disabled={Boolean(prep) || raw === 0}
              onPress={() => act((s) => playerPrep(s, id))}
            />
          </TutorialGlow>
        );
      })}
    </View>
  );

  // ---------- Cảnh 3D ----------
  const width = Math.max(1.5, stoves.length * STOVE_GAP);
  const stoveX = (i: number) => (i - (stoves.length - 1) / 2) * STOVE_GAP;
  const bowlId = lastPrep ?? null;
  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <Canvas shadows={shadows ? 'percentage' : false} dpr={[1, 1.5]} camera={{ fov: 50, near: 0.05, far: 30 }} style={{ flex: 1 }}>
          <color attach="background" args={['#FFF3E0']} />
          <EyeRig width={width} depth={1.75} target={[0, TOP_Y, -0.2]} tilt={[0, 1.25, 0.8]} shadows={shadows} />
          <Backdrop from={-width / 2 - 1.5} to={width / 2 + 1.5} z={-0.3} />
          <KitchenCounter width={width} />
          {/* Dãy bếp phía xa */}
          {stoves.map((st, i) => {
            const info = slotInfo(run, run.slots.find((x) => x.id === st.slotId));
            const on = st.slotId === selSlotId;
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
                {/* Vòng sáng quanh bếp đang chọn (đỏ khi sắp cháy) */}
                {(on || info.warn) && (
                  <mesh position={[0, 0.012, 0]} rotation-x={-Math.PI / 2}>
                    <ringGeometry args={[0.3, 0.34, 40]} />
                    <meshBasicMaterial color={info.warn ? '#FF5252' : '#FFB300'} transparent opacity={0.9} />
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
        <Header game={game} onExit={onExit} carrying={run.carrying.length} asking={run.customers.filter((c) => c.question).length} topic="kitchen" lines={[stoveLine, prepLine]} />
        {hint && <Pointer icon={hint} />}
      </View>
      <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
        {stoveControls}
        <View style={styles.hr} />
        {boardControls}
      </ScrollView>
    </View>
  );
}

// ======================= Quầy pha chế (màn riêng) =======================

function CounterView({ station, game, act, onExit, noGarnish }: Props) {
  const run = game.run!;
  const { width: winW } = useWindowDimensions();
  const shadows = Platform.OS === 'web' && winW >= 700;
  const pulse = useRef(0);
  const slot = station.slotId ? run.slots.find((s) => s.id === station.slotId) : undefined;
  const info = slotInfo(run, slot);

  const tap = () => {
    pulse.current = now();
    if (slot && info.mine && !info.done) act((s) => playerStir(s, slot.id));
  };
  useKeys({ exit: onExit, action: tap });

  const recipes = game.unlockedRecipes.map((id) => RECIPES[id]).filter((r) => r.station === 'counter');
  let controls: React.ReactNode = null;
  if (slot && !info.job) {
    controls = (
      <View style={styles.wrap}>
        {recipes.map((r) => {
          const ok = canMake(game, r.id, false);
          return (
            <IconTile
              key={r.id}
              icon={r.emoji}
              name={r.name}
              disabled={!ok}
              missing={ok ? undefined : missingFor(game, r.id, false).map((m) => INGREDIENTS[m].emoji)}
              tone={ok ? 'primary' : 'plain'}
              onPress={() => act((s) => playerCook(s, r.id, noGarnish, slot.id))}
            />
          );
        })}
      </View>
    );
  } else if (slot && info.mine) {
    controls = (
      <View style={styles.wrap}>
        <IconTile
          icon="🍽️"
          label={takeOutLabel(run, info)}
          name={takeOutName(run, info)}
          size="lg"
          tone={!info.done ? 'plain' : 'good'}
          disabled={run.carrying.length >= MAX_CARRY}
          onPress={() => act((s) => playerTakeOut(s, slot.id, true))}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <Canvas shadows={shadows ? 'percentage' : false} dpr={[1, 1.5]} camera={{ fov: 50, near: 0.05, far: 30 }} style={{ flex: 1 }}>
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
      {controls && (
        <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
          {controls}
        </ScrollView>
      )}
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
  controls: { maxHeight: 280, flexGrow: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border },
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
  toggle: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.bad, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  toggleOn: { backgroundColor: colors.bad },
  toggleText: { color: colors.bad, fontWeight: '700', fontSize: 12 },
});
