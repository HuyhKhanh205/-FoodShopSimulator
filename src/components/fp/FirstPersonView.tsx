import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BURN_FACTOR, INGREDIENTS, PLAYER_PREP_MS, RECIPES } from '../../game/data';
import { MAX_CARRY, playerChop, playerCook, playerPrep, playerStir, playerTakeOut } from '../../game/engine';
import type { GameMutation } from '../../game/GameContext';
import { canMake, missingFor, prepIngredients, usableQty } from '../../game/helpers';
import type { MapStation } from '../../game/layout';
import type { GameState, IngredientId } from '../../game/types';
import { Canvas } from '../../three/fiber';
import { Button, ProgressBar, colors } from '../ui';
import { BoardScene, CounterScene, EyeCamera, StoveScene } from './FPScenes';

const SHADOWS = Platform.OS === 'web';

/**
 * Góc nhìn thứ nhất khi đứng ở thớt / bếp / quầy pha chế.
 * Chạm vào cảnh để thái (thớt) hoặc khuấy (bếp, quầy) — game vẫn chạy trong lúc này.
 */
export default function FirstPersonView({
  station,
  game,
  act,
  onExit,
  noGarnish,
  setNoGarnish,
}: {
  station: MapStation;
  game: GameState;
  act: (fn: GameMutation) => void;
  onExit: () => void;
  noGarnish: boolean;
  setNoGarnish: (v: boolean) => void;
}) {
  const run = game.run!;
  const pulse = useRef(0);
  const [lastPrep, setLastPrep] = useState<IngredientId | null>(null);
  const skin = game.profile.skin;
  const sleeve = game.profile.shirt;
  const isBoard = station.kind === 'board';
  const slot = station.slotId ? run.slots.find((s) => s.id === station.slotId) : undefined;
  const job = slot?.job ?? null;
  const mine = job?.by === 'player';
  const recipe = job ? RECIPES[job.recipeId] : null;
  const blocked = slot?.station === 'stove' && (run.elapsed < run.powerOutUntil || run.elapsed < run.gasOutUntil);

  // ---------- Trạng thái hiển thị ----------
  const prep = run.playerPrep;
  const prepProgress = prep ? Math.min(1, 1 - (prep.endsAt - run.elapsed) / PLAYER_PREP_MS) : null;
  const cookRatio = job ? job.progress / job.cookTime : 0;
  const burnRatio = job ? (job.progress - job.cookTime) / (job.cookTime * (BURN_FACTOR - 1)) : -1;
  const done = Boolean(job && job.progress >= job.cookTime);
  const warn = Boolean(recipe?.burns && burnRatio > 0.5);

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
    act((s) => playerTakeOut(s, slot.id, true));
    // Món đã lên tay: quay lại quán để mang ra cho khách.
    setTimeout(onExit, 450);
  };

  // Phím trên máy tính: Space / E để thái – khuấy, Esc để về quán.
  const tapRef = useRef(tap);
  tapRef.current = tap;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      } else if (e.key === ' ' || e.key.toLowerCase() === 'e') {
        e.preventDefault();
        tapRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onExit]);

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

  // ---------- Cảnh 3D ----------
  let scene: React.ReactNode;
  if (isBoard) {
    const bowlId = lastPrep ?? null;
    scene = (
      <BoardScene
        ingredient={prep?.ingredientId ?? null}
        progress={prepProgress}
        bowl={!prep && bowlId ? { id: bowlId, count: run.prepped[bowlId] ?? 0 } : null}
        pulse={pulse}
        skin={skin}
        sleeve={sleeve}
      />
    );
  } else if (slot?.station === 'stove') {
    scene = (
      <StoveScene
        recipeId={job?.recipeId ?? null}
        cooking={Boolean(job) && !done}
        burnRatio={job ? burnRatio : -1}
        blocked={Boolean(blocked)}
        pulse={pulse}
        skin={skin}
        sleeve={sleeve}
      />
    );
  } else {
    scene = (
      <CounterScene
        recipeId={job?.recipeId ?? null}
        drink={recipe?.drink ?? true}
        progress={Math.min(1, cookRatio)}
        pulse={pulse}
        skin={skin}
        sleeve={sleeve}
      />
    );
  }

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
                <Button small style={styles.btn} label={`${r.emoji} ${r.name}`} disabled={!ok} onPress={() => act((s) => playerCook(s, r.id, noGarnish))} />
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

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <Canvas shadows={SHADOWS ? 'percentage' : false} dpr={[1, 2]} camera={{ fov: 52, near: 0.05, far: 30 }} style={{ flex: 1 }}>
          <color attach="background" args={['#FFF3E0']} />
          <EyeCamera />
          {scene}
        </Canvas>
        {/* Vùng chạm toàn cảnh */}
        <Pressable accessibilityLabel={isBoard ? 'Thái' : 'Khuấy'} onPress={tap} style={StyleSheet.absoluteFill} />
        <View pointerEvents="box-none" style={styles.top}>
          <View style={styles.topRow}>
            <Pressable onPress={onExit} style={styles.exit} accessibilityRole="button">
              <Text style={styles.exitText}>⬅ Về quán</Text>
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
