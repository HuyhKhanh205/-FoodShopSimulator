import { INGREDIENT_IDS, INGREDIENT_TIER, LEVEL_XP, MAX_LEVEL, RECIPE_IDS, RECIPES, recipeLevel } from './data';
import { log } from './helpers';
import type { GameState, IngredientId, RecipeId } from './types';

/** Cấp hiện tại theo điểm kinh nghiệm. */
export function levelOf(xp: number): number {
  let lv = 1;
  for (let i = 0; i < LEVEL_XP.length; i += 1) if (xp >= LEVEL_XP[i]) lv = i + 1;
  return lv;
}

/** Tiến độ tới cấp sau (0..1), 1 khi đã tối đa. */
export function levelProgress(xp: number): number {
  const lv = levelOf(xp);
  if (lv >= MAX_LEVEL) return 1;
  const a = LEVEL_XP[lv - 1];
  const b = LEVEL_XP[lv];
  return (xp - a) / (b - a);
}

export function unlockedIngredients(s: GameState): IngredientId[] {
  const lv = levelOf(s.xp);
  return INGREDIENT_IDS.filter((i) => INGREDIENT_TIER[i] <= lv);
}

/** Nguyên liệu vừa mở ở đúng cấp này. */
export function ingredientsOfLevel(level: number): IngredientId[] {
  return INGREDIENT_IDS.filter((i) => INGREDIENT_TIER[i] === level);
}

/** Cộng điểm kinh nghiệm; lên cấp thì báo đầu bếp. */
export function addXp(s: GameState, n: number) {
  const before = levelOf(s.xp);
  s.xp += n;
  const after = levelOf(s.xp);
  for (let lv = before + 1; lv <= after; lv += 1) {
    s.chefQueue.push({ kind: 'levelUp', level: lv });
    log(s, `⭐ Lên cấp ${lv}! Mở khoá ${ingredientsOfLevel(lv).length} nguyên liệu mới`, 'good');
  }
}

export type LabResult = { kind: 'new'; recipeId: RecipeId } | { kind: 'known'; recipeId: RecipeId } | { kind: 'near'; missing: number } | { kind: 'nothing' };

const keyOf = (ids: IngredientId[]) => [...new Set(ids)].sort().join('+');

/**
 * Bếp thử món: so bộ nguyên liệu (không tính số lượng) với công thức.
 * Đúng món chưa có → thêm vào menu. Thiếu / thừa đúng 1 thứ so với một món đã mở khoá được → "gần đúng".
 */
export function experiment(s: GameState, ids: IngredientId[]): LabResult {
  const set = [...new Set(ids)];
  if (set.length < 2) return { kind: 'nothing' };
  const unlocked = new Set(unlockedIngredients(s));
  if (set.some((i) => !unlocked.has(i))) return { kind: 'nothing' };
  const key = keyOf(set);
  for (const id of RECIPE_IDS) {
    if (keyOf(Object.keys(RECIPES[id].ingredients) as IngredientId[]) !== key) continue;
    if (s.unlockedRecipes.includes(id)) return { kind: 'known', recipeId: id };
    s.unlockedRecipes.push(id);
    s.labFails = 0;
    s.chefQueue.push({ kind: 'newDish', recipeId: id });
    log(s, `🧪 Sáng tạo thành công: ${RECIPES[id].emoji} ${RECIPES[id].name} — đã thêm vào menu!`, 'good');
    addXp(s, 20);
    return { kind: 'new', recipeId: id };
  }
  s.labFails += 1;
  // Sau mỗi 3 lần sai, lộ thêm 1 nguyên liệu của một món bí ẩn.
  if (s.labFails % 3 === 0) {
    const target = mysteryRecipes(s)[0];
    if (target) s.labHints[target] = Math.min(Object.keys(RECIPES[target].ingredients).length, (s.labHints[target] ?? 0) + 1);
  }
  const lv = levelOf(s.xp);
  for (const id of RECIPE_IDS) {
    if (s.unlockedRecipes.includes(id) || recipeLevel(id) > lv) continue;
    const need = Object.keys(RECIPES[id].ingredients) as IngredientId[];
    const common = need.filter((i) => set.includes(i)).length;
    const extra = set.length - common;
    if ((common === need.length - 1 && extra === 0) || (common === need.length && extra === 1)) return { kind: 'near', missing: need.length - common };
  }
  return { kind: 'nothing' };
}

/** Món chưa tìm ra nhưng đã đủ cấp để làm (sắp theo cấp). */
export function mysteryRecipes(s: GameState): RecipeId[] {
  const lv = levelOf(s.xp);
  return RECIPE_IDS.filter((id) => !s.unlockedRecipes.includes(id) && recipeLevel(id) <= lv).sort((a, b) => recipeLevel(a) - recipeLevel(b));
}

/** Điểm kinh nghiệm tối thiểu để làm được các món đã có (bản lưu cũ). */
export function xpForRecipes(ids: RecipeId[]): number {
  const lv = Math.max(1, ...ids.filter((id) => RECIPES[id]).map(recipeLevel));
  return LEVEL_XP[lv - 1];
}
