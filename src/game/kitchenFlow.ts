import { INGREDIENTS, RECIPES } from './data';
import { MAX_CARRY } from './engine';
import { dishNeeds, suggestChop, usableQty } from './helpers';
import type { GameState, IngredientId, RecipeId, Station } from './types';

/**
 * Nút "👉 Làm tiếp" trong bếp (thớt + bếp, hoặc quầy pha chế): một việc cần làm ngay, bấm là làm.
 * Thứ tự: lấy món chín → mang món cho khách → thái nhanh (đang thái) → thái đồ còn thiếu → nấu món khách gọi → khuấy → chờ.
 */
export type KitchenAction =
  | { kind: 'take'; slotId: string }
  | { kind: 'exit' }
  | { kind: 'chop' }
  | { kind: 'prep'; ingredient: IngredientId }
  | { kind: 'cook'; recipeId: RecipeId; slotId: string }
  | { kind: 'stir'; slotId: string }
  | { kind: 'wait' };

export interface KitchenNext {
  label: string;
  /** Khoá viền vàng tương ứng của hướng dẫn ngày đầu. */
  key: string;
  action: KitchenAction;
}

/** Đồ bỏ nồi được ngay (đồ cần thái thì tính phần đã thái). */
const ready = (s: GameState, i: IngredientId) => (INGREDIENTS[i].needsPrep ? s.run?.prepped[i] ?? 0 : usableQty(s, i));

export function kitchenNext(s: GameState, station: Station, slotIds: string[]): KitchenNext {
  const run = s.run;
  if (!run) return { label: '👀 Chờ mở cửa', key: '', action: { kind: 'wait' } };
  const slots = slotIds.map((id) => run.slots.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const mine = slots.filter((sl) => sl.job?.by === 'player');
  const done = mine.find((sl) => sl.job!.progress >= sl.job!.cookTime);
  const full = run.carrying.length >= MAX_CARRY;
  if (done && !full) {
    const r = RECIPES[done.job!.recipeId];
    return { label: `🍽️ Lấy ${r?.emoji ?? ''} ra`, key: 'kitchen.takeout', action: { kind: 'take', slotId: done.id } };
  }
  if (run.carrying.length > 0) return { label: '🍽️ Mang món cho khách ➡', key: 'kitchen.exit', action: { kind: 'exit' } };
  if (run.playerPrep) return { label: `🔪 Chạm thớt thái ${INGREDIENTS[run.playerPrep.ingredientId].emoji} nhanh`, key: 'kitchen.board', action: { kind: 'chop' } };

  const free = slots.find((sl) => !sl.job);
  const need = [...dishNeeds(run)].filter(([id, n]) => n > 0 && RECIPES[id]?.station === station).sort((a, b) => b[1] - a[1]);
  let outOf: IngredientId | null = null;
  for (const [id] of need) {
    const ings = Object.entries(RECIPES[id].ingredients) as [IngredientId, number][];
    const raw = ings.find(([i, q]) => usableQty(s, i) < q && !(INGREDIENTS[i].needsPrep && ready(s, i) >= q));
    if (raw) {
      outOf ??= raw[0];
      continue;
    }
    const chop = ings.find(([i, q]) => INGREDIENTS[i].needsPrep && ready(s, i) < q);
    if (chop) {
      const ing = INGREDIENTS[chop[0]];
      return { label: `🔪 Thái ${ing.emoji} ${ing.name.toLowerCase()}`, key: `kitchen.prep:${chop[0]}`, action: { kind: 'prep', ingredient: chop[0] } };
    }
    if (free) {
      const r = RECIPES[id];
      return { label: `🔥 Nấu ${r.emoji} ${r.name}`, key: `kitchen.recipe:${id}`, action: { kind: 'cook', recipeId: id, slotId: free.id } };
    }
  }
  const cooking = mine.filter((sl) => sl.job!.progress < sl.job!.cookTime).sort((a, b) => b.job!.progress / b.job!.cookTime - a.job!.progress / a.job!.cookTime)[0];
  if (cooking) return { label: `🥄 Khuấy ${RECIPES[cooking.job!.recipeId]?.emoji ?? ''} cho mau chín`, key: 'kitchen.stir', action: { kind: 'stir', slotId: cooking.id } };
  if (outOf) return { label: `🛒 Hết ${INGREDIENTS[outOf].emoji} — ra chợ mua thêm`, key: '', action: { kind: 'wait' } };
  if (station === 'stove') {
    const pre = suggestChop(s);
    if (pre && (run.prepped[pre] ?? 0) < 6) return { label: `🔪 Thái sẵn ${INGREDIENTS[pre].emoji} ${INGREDIENTS[pre].name.toLowerCase()}`, key: `kitchen.prep:${pre}`, action: { kind: 'prep', ingredient: pre } };
  }
  return { label: '👀 Chờ khách gọi món', key: '', action: { kind: 'wait' } };
}
