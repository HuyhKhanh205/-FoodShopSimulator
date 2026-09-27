import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BURN_FACTOR, INGREDIENTS, PLAYER_PREP_MS, RECIPES } from '../../game/data';
import { MAX_CARRY, playerChop, playerCook, playerPrep, playerStir, playerTakeOut } from '../../game/engine';
import type { GameMutation } from '../../game/GameContext';
import { canMake, missingFor, prepIngredients, usableQty } from '../../game/helpers';
import type { MapStation } from '../../game/layout';
import type { CookSlot, GameState, IngredientId } from '../../game/types';
import { Canvas } from '../../three/fiber';
import { Button, ProgressBar, colors } from '../ui';
import { Backdrop, BoardScene, CounterScene, KitchenRig, STEP, StoveScene } from './FPScenes';
import type { PulseRef } from './FPScenes';

const SHADOWS = Platform.OS === 'web';
const IDLE: PulseRef = { current: 0 };

/** Trạng thái một nồi / ly để vẽ huy hiệu trên thanh chọn trạm. */
function slotInfo(run: NonNullable<GameState['run']>, slot: CookSlot | undefined) {
  const job = slot?.job ?? null;
  const recipe = job ? RECIPES[job.recipeId] : null;
  const cookRatio = job ? job.progress / job.cookTime : 0;
  const burnRatio = job ? (job.progress - job.cookTime) / (job.cookTime * (BURN_FACTOR - 1)) : -1;
  const done = Boolean(job && job.progress >= job.cookTime);
  const warn = Boolean(recipe?.burns && burnRatio > 0.5);
  const blocked = slot?.station === 'stove' && (run.elapsed < run.powerOutUntil || run.elapsed < run.gasOutUntil);
  return { job, recipe, cookRatio, burnRatio, done, warn, blocked, mine: job?.by === 'player' };
}

/** Tên ngắn của trạm trên thanh chọn. */
function tabLabel(st: MapStation, stations: MapStation[]) {
  if (st.kind === 'board') return '🔪 Thớt';
  const same = stations.filter((x) => x.kind === st.kind);
  const n = same.length > 1 ? ` ${same.indexOf(st) + 1}` : '';
  return st.kind === 'stove' ? `🔥 Bếp${n}` : `🧋 Quầy${n}`;
}

/**
 * "Bếp của tôi": góc nhìn thứ nhất cho cả dãy bếp — thớt, các bếp và quầy pha chế nằm cạnh nhau.
 * Chọn trạm ở thanh trên (hoặc ← →) để camera lướt sang; chạm vào cảnh để thái / khuấy.
 * Game vẫn chạy trong lúc này, nhấc món ra thì cầm trên tay và vẫn ở lại bếp.
 */
export default function FirstPersonView({
  station: initial,
  stations,
  game,
  act,
  onExit,
  noGarnish,
  setNoGarnish,
}: {
  station: MapStation;
  /** Các trạm làm được ở góc nhìn thứ nhất (thớt, bếp, quầy đang hoạt động). */
  stations: MapStation[];
  game: GameState;
  act: (fn: GameMutation) => void;
  onExit: () => void;
  noGarnish: boolean;
  setNoGarnish: (v: boolean) => void;
}) {
  const run = game.run!;
  const pulse = useRef(0);
  const [lastPrep, setLastPrep] = useState<IngredientId | null>(null);
  const [tab, setTab] = useState(() => Math.max(0, stations.findIndex((s) => s.id === initial.id)));
  const index = Math.min(tab, stations.length - 1);
  const station = stations[index] ?? initial;
  const isBoard = station.kind === 'board';
  const slot = station.slotId ? run.slots.find((s) => s.id === station.slotId) : undefined;
  const { job, recipe, cookRatio, burnRatio, done, warn, blocked, mine } = slotInfo(run, slot);

  // ---------- Trạng thái hiển thị ----------
  const prep = run.playerPrep;
  const prepProgress = prep ? Math.min(1, 1 - (prep.endsAt - run.elapsed) / PLAYER_PREP_MS) : null;

  useEffect(() => {
    if (prep) setLastPrep(prep.ingredientId);
  }, [prep]);

  const tap = () => {
    pulse.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (isBoard) {
      if (prep) act((s) => playerChop(s));
    } else if (slot && mine && !done) {
      act((s) => playerStir(s, slot.id));
    }
  };

  const takeOut = () => {
    if (!slot) return;
    // Món lên tay; vẫn ở lại bếp để làm tiếp, bấm "Ra phục vụ" khi muốn mang ra.
    act((s) => playerTakeOut(s, slot.id, true));
  };

  // Phím trên máy tính: Space / E để thái – khuấy, ← → (A D) hoặc 1–9 để đổi trạm, Esc để về quán.
  const tapRef = useRef(tap);
  tapRef.current = tap;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      } else if (e.key === ' ' || k === 'e') {
        e.preventDefault();
        tapRef.current();
      } else if (e.key === 'ArrowLeft' || k === 'a') {
        e.preventDefault();
        setTab((i) => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight' || k === 'd') {
        e.preventDefault();
        setTab((i) => Math.min(stations.length - 1, i + 1));
      } else if (/^[1-9]$/.test(e.key) && +e.key <= stations.length) {
        e.preventDefault();
        setTab(+e.key - 1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onExit, stations.length]);

  // ---------- Tiêu đề, tiến độ, gợi ý ----------
  let title = '';
  let status = '';
  let hint = '';
  let progress: number | null = null;
  let barColor: string = colors.accent;
  if (isBoard) {
    title = '🔪 Thớt sơ chế';
    if (prep) {
      status = `Đang thái ${INGREDIENTS[prep.ingredientId].name} (${prep.qty} phần)`;
      hint = '👆 Chạm liên tục vào màn hình để thái nhanh hơn!';
      progress = prepProgress;
      barColor = colors.info;
    } else {
      status = lastPrep ? `Xong! Đã có ${run.prepped[lastPrep] ?? 0} phần ${INGREDIENTS[lastPrep].name}` : 'Chọn nguyên liệu để sơ chế';
    }
  } else {
    title = slot?.station === 'stove' ? '🔥 Bếp' : '🥤 Quầy pha chế';
    if (!job) status = 'Chọn món để nấu';
    else if (!mine) status = `${game.staff.find((s) => s.id === job.by)?.name ?? 'Nhân viên'} đang nấu ${recipe!.name}`;
    else if (blocked) status = `${recipe!.name}: bếp đang tắt (cúp điện / hết gas)`;
    else if (!done) {
      status = `Đang nấu ${recipe!.emoji} ${recipe!.name}`;
      hint = slot?.station === 'stove' ? '👆 Chạm để khuấy — món chín nhanh hơn' : '👆 Chạm để lắc — pha nhanh hơn';
    } else if (warn) status = `⚠️ ${recipe!.name} sắp cháy! Nhấc ra ngay!`;
    else status = `✅ ${recipe!.name} chín rồi!`;
    if (job) {
      progress = done && recipe?.burns ? 1 - Math.max(0, burnRatio) : cookRatio;
      barColor = !done ? colors.accent : warn ? colors.bad : colors.good;
    }
  }

  // ---------- Cảnh 3D: cả dãy bếp ----------
  const bowlId = lastPrep ?? null;
  const scenes = stations.map((st, i) => {
    const active = i === index;
    const p = active ? pulse : IDLE;
    let node: React.ReactNode;
    if (st.kind === 'board') {
      node = (
        <BoardScene
          ingredient={prep?.ingredientId ?? null}
          progress={prepProgress}
          bowl={!prep && bowlId ? { id: bowlId, count: run.prepped[bowlId] ?? 0 } : null}
          pulse={p}
          active={active}
        />
      );
    } else {
      const sl = run.slots.find((x) => x.id === st.slotId);
      const info = slotInfo(run, sl);
      node =
        sl?.station === 'stove' ? (
          <StoveScene
            recipeId={info.job?.recipeId ?? null}
            cooking={Boolean(info.job) && !info.done}
            cookRatio={info.cookRatio}
            burnRatio={info.job ? info.burnRatio : -1}
            blocked={Boolean(info.blocked)}
            pulse={p}
          />
        ) : (
          <CounterScene recipeId={info.job?.recipeId ?? null} drink={info.recipe?.drink ?? true} progress={Math.min(1, info.cookRatio)} pulse={p} />
        );
    }
    return (
      <group key={st.id} position={[i * STEP, 0, 0]}>
        {node}
      </group>
    );
  });

  // ---------- Điều khiển ----------
  let controls: React.ReactNode = null;
  if (isBoard) {
    controls = (
      <View style={styles.wrap}>
        {prepIngredients(game).map((id) => {
          const ing = INGREDIENTS[id];
          const raw = usableQty(game, id);
          const ready = run.prepped[id] ?? 0;
          return (
            <Button
              key={id}
              small
              style={styles.btn}
              variant={ready === 0 && raw > 0 ? 'primary' : 'secondary'}
              label={`${ing.emoji} ${ing.name} · ${ready} sẵn / ${raw} sống`}
              disabled={Boolean(prep) || raw === 0}
              onPress={() => act((s) => playerPrep(s, id))}
            />
          );
        })}
      </View>
    );
  } else if (slot && !job) {
    const recipes = game.unlockedRecipes.map((id) => RECIPES[id]).filter((r) => r.station === slot.station);
    controls = (
      <View style={{ gap: 8 }}>
        <Pressable onPress={() => setNoGarnish(!noGarnish)} style={[styles.toggle, noGarnish && styles.toggleOn]}>
          <Text style={[styles.toggleText, noGarnish && { color: '#fff' }]}>🚫 Không hành: {noGarnish ? 'BẬT' : 'tắt'}</Text>
        </Pressable>
        <View style={styles.wrap}>
          {recipes.map((r) => {
            const off = noGarnish && Boolean(r.garnish);
            const ok = canMake(game, r.id, off);
            return (
              <View key={r.id}>
                <Button small style={styles.btn} label={`${r.emoji} ${r.name}`} disabled={!ok} onPress={() => act((s) => playerCook(s, r.id, noGarnish, slot.id))} />
                {!ok && <Text style={styles.missing}>Thiếu: {missingFor(game, r.id, off).map((m) => INGREDIENTS[m].name).join(', ')}</Text>}
              </View>
            );
          })}
        </View>
      </View>
    );
  } else if (slot && mine) {
    const handsFull = run.carrying.length >= MAX_CARRY;
    controls = (
      <Button
        style={styles.bigBtn}
        variant={!done ? 'secondary' : warn ? 'danger' : 'primary'}
        label={handsFull ? '🤲 Tay đã cầm đủ 2 món' : !done ? 'Nhấc sớm (món sẽ bị sống)' : warn ? '⚠️ Nhấc ra ngay kẻo cháy!' : '🍽️ Nhấc ra, cầm trên tay'}
        disabled={handsFull}
        onPress={takeOut}
      />
    );
  }

  const carrying = run.carrying.length;
  return (
    <View style={styles.root}>
      {/* Thanh chọn trạm */}
      <ScrollView horizontal style={styles.tabs} contentContainerStyle={styles.tabsContent} showsHorizontalScrollIndicator={false}>
        {stations.map((st, i) => {
          const sl = st.slotId ? run.slots.find((x) => x.id === st.slotId) : undefined;
          const info = slotInfo(run, sl);
          const badge =
            st.kind === 'board'
              ? prep
                ? '⏳'
                : ''
              : !info.job
                ? ''
                : !info.mine
                  ? '👤'
                  : info.warn
                    ? '⚠️'
                    : info.done
                      ? '✅'
                      : `${Math.round(Math.min(1, info.cookRatio) * 100)}%`;
          const on = i === index;
          return (
            <Pressable
              key={st.id}
              onPress={() => setTab(i)}
              style={[styles.tab, on && styles.tabOn, info.warn && styles.tabWarn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>
                {tabLabel(st, stations)}
                {info.job ? ` ${info.recipe!.emoji}` : ''}
              </Text>
              {badge ? <Text style={[styles.badge, on && styles.tabTextOn]}>{badge}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.stage}>
        <Canvas shadows={SHADOWS ? 'percentage' : false} dpr={[1, 2]} camera={{ fov: 52, near: 0.05, far: 30 }} style={{ flex: 1 }}>
          <color attach="background" args={['#FFF3E0']} />
          <KitchenRig x={index * STEP} />
          <Backdrop from={-STEP / 2 - 1.5} to={(stations.length - 0.5) * STEP + 1.5} />
          {scenes}
        </Canvas>
        {/* Vùng chạm toàn cảnh */}
        <Pressable accessibilityLabel={isBoard ? 'Thái' : 'Khuấy'} onPress={tap} style={StyleSheet.absoluteFill} />
        <View pointerEvents="box-none" style={styles.top}>
          <View style={styles.topRow}>
            <Pressable onPress={onExit} style={[styles.exit, carrying > 0 && styles.exitServe]} accessibilityRole="button">
              <Text style={styles.exitText}>{carrying > 0 ? `🍽️ Ra phục vụ (${carrying})` : '⬅ Rời bếp'}</Text>
            </Pressable>
            <View pointerEvents="none" style={styles.titleBox}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.status} numberOfLines={2}>
                {status}
              </Text>
            </View>
          </View>
          {progress !== null && (
            <View pointerEvents="none" style={styles.progressBox}>
              <ProgressBar value={progress} color={barColor} height={10} />
            </View>
          )}
        </View>
        {/* Nút chuyển trạm hai bên */}
        {index > 0 && (
          <Pressable onPress={() => setTab(index - 1)} style={[styles.arrow, { left: 8 }]} accessibilityLabel="Trạm bên trái">
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
        )}
        {index < stations.length - 1 && (
          <Pressable onPress={() => setTab(index + 1)} style={[styles.arrow, { right: 8 }]} accessibilityLabel="Trạm bên phải">
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        )}
        {hint ? (
          <View pointerEvents="none" style={styles.hintBox}>
            <Text style={styles.hint}>{hint}</Text>
          </View>
        ) : null}
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
  top: { position: 'absolute', left: 0, right: 0, top: 0, padding: 10, gap: 8 },
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
  exitText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  exitServe: { backgroundColor: colors.good },
  tabs: { flexGrow: 0, backgroundColor: '#3E2723' },
  tabsContent: { paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)' },
  tabOn: { backgroundColor: colors.primary },
  tabWarn: { borderWidth: 2, borderColor: '#FF5252' },
  tabText: { color: '#FFE0B2', fontWeight: '800', fontSize: 13 },
  tabTextOn: { color: '#fff' },
  badge: { color: '#FFE0B2', fontWeight: '900', fontSize: 11 },
  arrow: {
    position: 'absolute',
    top: '45%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(62,39,35,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: -4 },
  titleBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  title: { fontSize: 16, fontWeight: '900', color: colors.text },
  status: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  progressBox: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: 6 },
  hintBox: { position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: 'rgba(62,39,35,0.78)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  hint: { color: '#fff', fontWeight: '800', fontSize: 14 },
  controls: { maxHeight: 190, flexGrow: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border },
  controlsContent: { padding: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, minHeight: 44 },
  bigBtn: { paddingVertical: 16, borderRadius: 14 },
  missing: { fontSize: 10, color: colors.bad, maxWidth: 170 },
  toggle: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.bad, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  toggleOn: { backgroundColor: colors.bad },
  toggleText: { color: colors.bad, fontWeight: '700', fontSize: 12 },
});
