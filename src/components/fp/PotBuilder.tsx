import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { INGREDIENTS, RECIPES } from '../../game/data';
import { DISH_KIND_LABEL, resolveCombo } from '../../game/dishes';
import { playerCookCombo, playerPrep } from '../../game/engine';
import type { GameMutation } from '../../game/GameContext';
import { dishNeeds, usableQty } from '../../game/helpers';
import { unlockedIngredients } from '../../game/progression';
import { trendHeat } from '../../game/trend';
import type { GameState, IngredientId, Station } from '../../game/types';
import IconTile from '../kid/IconTile';
import TutorialGlow from '../kid/TutorialGlow';
import { colors } from '../ui';

const MAX_POT = 4;

/** Nguyên liệu có sẵn để bỏ vào nồi (đồ cần sơ chế thì phải có phần đã thái). */
function available(s: GameState, id: IngredientId): number {
  return INGREDIENTS[id].needsPrep ? s.run?.prepped[id] ?? 0 : usableQty(s, id);
}

/**
 * Nồi tự chọn, chia làm hai phần:
 * - `top` (luôn thấy, không cuộn): 4 ô nồi, 🔥 Nấu (tự vào bếp trống), 🔪 Thái thứ còn thiếu, dòng xem trước;
 * - `list` (cuộn): món trong menu — món khách đang gọi lên đầu, có ×n — rồi nguyên liệu.
 *   Nguyên liệu cần thái mà chưa có phần thái sẵn: chạm = bắt đầu thái trên thớt.
 */
export function usePotBuilder({
  game,
  station,
  slotIds,
  act,
  targets,
}: {
  game: GameState;
  station: Station;
  /** Các bếp / ly ở màn này; 🔥 Nấu tự chọn cái trống đầu tiên. */
  slotIds: string[];
  act: (fn: GameMutation) => void;
  targets: string[];
}) {
  const run = game.run!;
  const [pot, setPot] = useState<IngredientId[]>([]);
  const [error, setError] = useState<string | null>(null);
  const toggle = (id: IngredientId) => {
    setError(null);
    setPot((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_POT ? p : [...p, id]));
  };
  const freeSlot = slotIds.find((id) => !run.slots.find((x) => x.id === id)?.job);
  const preview = pot.length ? resolveCombo(game, pot) : null;
  const missing = pot.filter((i) => available(game, i) < 1);
  const toChop = missing.find((i) => INGREDIENTS[i].needsPrep && usableQty(game, i) > 0);
  const wrongStation = preview && preview.recipe.station !== station;
  const inMenu = preview ? game.unlockedRecipes.includes(preview.recipe.id) : false;
  const kind = preview?.recipe.kind ?? 'chuan';
  const prepping = Boolean(run.playerPrep);

  const cook = () => {
    if (!freeSlot) return;
    // Kiểm tra trên bản sao để báo lỗi ngay, rồi áp dụng thật.
    const err = playerCookCombo(JSON.parse(JSON.stringify(game)), pot, freeSlot);
    if (err) {
      setError(err);
      return;
    }
    const chosen = [...pot];
    act((s) => void playerCookCombo(s, chosen, freeSlot));
    setPot([]);
  };
  const chop = (id: IngredientId) => {
    setError(null);
    act((s) => void playerPrep(s, id));
  };

  const top = (
    <View style={{ gap: 6 }}>
      <View style={styles.potRow}>
        <View style={styles.pot}>
          {Array.from({ length: MAX_POT }, (_, i) => {
            const id = pot[i];
            return (
              <Pressable
                key={i}
                onPress={() => id && toggle(id)}
                style={[styles.slot, id && styles.slotFull, id && missing.includes(id) && styles.slotMissing]}
                accessibilityRole="button"
                accessibilityLabel={id ? `Lấy ra ${INGREDIENTS[id].name}` : 'Ô nồi trống'}
              >
                <Text style={styles.slotText}>{id ? INGREDIENTS[id].emoji : '＋'}</Text>
              </Pressable>
            );
          })}
        </View>
        {toChop ? (
          <TutorialGlow on={targets.includes(`kitchen.prep:${toChop}`)} radius={16}>
            <IconTile
              icon="🔪"
              label={`Thái ${INGREDIENTS[toChop].emoji}`}
              name={`Thái ${INGREDIENTS[toChop].name}`}
              tone="primary"
              size="sm"
              disabled={prepping}
              onPress={() => chop(toChop)}
            />
          </TutorialGlow>
        ) : (
          <TutorialGlow on={targets.includes('kitchen.cook') && pot.length > 0} radius={16}>
            <IconTile
              icon="🔥"
              label={freeSlot ? 'Nấu' : 'Đầy'}
              name={freeSlot ? 'Nấu nồi này' : 'Hết bếp trống'}
              tone="primary"
              size="sm"
              disabled={!preview || missing.length > 0 || Boolean(wrongStation) || !freeSlot}
              onPress={cook}
            />
          </TutorialGlow>
        )}
      </View>
      {preview ? (
        <View style={[styles.preview, kind === 'quai_di' && styles.previewMonster]} accessibilityLabel={`Sẽ ra món ${preview.recipe.name}`}>
          <Text style={styles.previewEmoji}>{preview.recipe.emoji}</Text>
          <Text style={styles.previewName} numberOfLines={1}>
            {preview.recipe.name}
            {preview.noGarnish ? ' 🚫🧅' : ''}
            {trendHeat(game, preview.recipe.id) > 0 ? ' 🔥' : ''}
            <Text style={styles.previewSub}>
              {'  '}
              {DISH_KIND_LABEL[kind]}
              {inMenu ? '' : ' · ⚠️ ngoài menu'}
              {missing.length ? ` · 🔪 thái ${missing.map((m) => INGREDIENTS[m].emoji).join('')} trước` : ''}
              {wrongStation ? (preview.recipe.station === 'counter' ? ' · 🧋 làm ở quầy' : ' · 🔥 nấu trên bếp') : ''}
            </Text>
          </Text>
        </View>
      ) : (
        <Text style={styles.empty}>👇 Chạm món khách gọi để bỏ nguyên liệu vào nồi</Text>
      )}
      {error && <Text style={styles.error}>⚠️ {error}</Text>}
    </View>
  );

  // Món khách đang gọi (×n) lên đầu.
  const need = dishNeeds(run);
  const menu = game.unlockedRecipes
    .map((id) => RECIPES[id])
    .filter((r) => r && r.station === station)
    .sort((a, b) => Math.max(0, need.get(b.id) ?? 0) - Math.max(0, need.get(a.id) ?? 0));
  const list = (
    <View style={{ gap: 4 }}>
      <View style={styles.wrap}>
        {menu.map((r) => {
          const n = Math.max(0, need.get(r.id) ?? 0);
          return (
            <TutorialGlow key={r.id} on={targets.includes(`kitchen.recipe:${r.id}`) && pot.length === 0}>
              <IconTile
                icon={r.emoji}
                name={`${r.name} (bỏ vào nồi)`}
                size="sm"
                badge={n > 0 ? `×${n}` : trendHeat(game, r.id) > 0 ? '🔥' : undefined}
                selected={n > 0}
                style={n === 0 ? styles.idle : undefined}
                onPress={() => {
                  setError(null);
                  setPot(Object.keys(r.ingredients) as IngredientId[]);
                }}
              />
            </TutorialGlow>
          );
        })}
      </View>
      <View style={styles.hr} />
      <View style={styles.wrap}>
        {unlockedIngredients(game).map((id) => {
          const ing = INGREDIENTS[id];
          const ready = available(game, id);
          const raw = usableQty(game, id);
          // Cần thái mà chưa có phần thái sẵn: chạm = thái.
          const mustChop = ing.needsPrep && ready < 1 && !pot.includes(id);
          const choppingThis = run.playerPrep?.ingredientId === id;
          // Đã có phần thái sẵn: chạm ô = bỏ vào nồi; nút 🔪+ nhỏ bên dưới = thái thêm (thái được nhiều lần).
          const canChopMore = ing.needsPrep && !mustChop && raw > 0;
          return (
            <View key={id} style={styles.ingCol}>
              <TutorialGlow on={targets.includes(`kitchen.prep:${id}`) && !toChop}>
                <IconTile
                  icon={ing.emoji}
                  name={mustChop ? `Thái ${ing.name}` : `Bỏ ${ing.name} vào nồi`}
                  size="sm"
                  badge={choppingThis ? '⏳' : mustChop && raw > 0 ? '🔪' : undefined}
                  sub={ing.needsPrep ? `🔪${ready} 📦${raw}` : `📦${raw}`}
                  selected={pot.includes(id)}
                  disabled={mustChop ? raw < 1 || prepping : ready < 1 && !pot.includes(id)}
                  onPress={() => (mustChop ? chop(id) : toggle(id))}
                />
              </TutorialGlow>
              {canChopMore && (
                <Pressable
                  onPress={() => chop(id)}
                  disabled={prepping}
                  style={({ pressed }) => [styles.more, prepping && { opacity: 0.4 }, pressed && { transform: [{ translateY: 2 }] }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Thái thêm ${ing.name}`}
                >
                  <Text style={styles.moreText}>🔪+</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );

  return { top, list };
}

const styles = StyleSheet.create({
  potRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pot: { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: '#5D4037', borderRadius: 18, padding: 6, justifyContent: 'center' },
  slot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFull: { backgroundColor: '#FFF3E0', borderStyle: 'solid', borderColor: colors.accent },
  slotMissing: { borderColor: colors.bad, opacity: 0.6 },
  slotText: { fontSize: 22, color: '#fff' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.goodBg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  previewMonster: { backgroundColor: '#F3E5F5' },
  previewEmoji: { fontSize: 22 },
  previewName: { flex: 1, fontSize: 14, fontWeight: '900', color: colors.text },
  previewSub: { fontSize: 12, fontWeight: '700', color: colors.muted },
  empty: { fontSize: 13, fontWeight: '700', color: colors.muted, paddingHorizontal: 4 },
  error: { color: colors.bad, fontWeight: '800' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 6 },
  hr: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  idle: { opacity: 0.75 },
  ingCol: { alignItems: 'center', gap: 3 },
  more: { minWidth: 46, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10, backgroundColor: '#E8F5E9', borderWidth: 2, borderColor: colors.good, borderBottomWidth: 3, alignItems: 'center' },
  moreText: { fontSize: 13, fontWeight: '900', color: colors.good },
});
