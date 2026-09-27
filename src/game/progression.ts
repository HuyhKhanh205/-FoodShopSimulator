import { INGREDIENT_IDS, INGREDIENT_TIER, LEVEL_XP, MAX_LEVEL, RECIPE_IDS, RECIPES, recipeLevel } from './data';
import { dishFromCombo, registerDish } from './dishes';
import { log } from './helpers';
import { startTrend } from './trend';
import type { GameState, IngredientId, RecipeId, StaffRole } from './types';

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

/** Cấp mở khoá từng vị trí nhân viên. */
export const ROLE_LEVEL: Record<StaffRole, number> = { prep: 3, cook: 4, waiter: 5 };

export function unlockedRoles(s: GameState): StaffRole[] {
  const lv = levelOf(s.xp);
  return (['prep', 'cook', 'waiter'] as StaffRole[]).filter((r) => lv >= ROLE_LEVEL[r]);
}

/** Cộng điểm kinh nghiệm; lên cấp thì báo đầu bếp. */
export function addXp(s: GameState, n: number) {
  const before = levelOf(s.xp);
  s.xp += n;
  const after = levelOf(s.xp);
  for (let lv = before + 1; lv <= after; lv += 1) {
    s.chefQueue.push({ kind: 'levelUp', level: lv });
    log(s, `⭐ Lên cấp ${lv}! Mở khoá ${ingredientsOfLevel(lv).length} nguyên liệu mới`, 'good');
    for (const role of Object.keys(ROLE_LEVEL) as StaffRole[]) if (ROLE_LEVEL[role] === lv) s.chefQueue.push({ kind: 'role', role });
  }
}

export type LabResult = { kind: 'new'; recipeId: RecipeId } | { kind: 'known'; recipeId: RecipeId } | { kind: 'nothing' };

/**
 * Thử món: mọi tổ hợp 2–4 nguyên liệu đã mở đều ra một món (chuẩn / lạ / quái dị).
 * Món mới được ghi vào sổ món; thêm vào menu là do người chơi chọn (`addToMenu`).
 */
export function experiment(s: GameState, ids: IngredientId[]): LabResult {
  const set = [...new Set(ids)];
  if (set.length < 2 || set.length > 4) return { kind: 'nothing' };
  const unlocked = new Set(unlockedIngredients(s));
  if (set.some((i) => !unlocked.has(i))) return { kind: 'nothing' };
  const r = dishFromCombo(set);
  registerDish(s, r);
  if (s.discovered.includes(r.id)) return { kind: 'known', recipeId: r.id };
  s.discovered.push(r.id);
  const standard = !r.kind || r.kind === 'chuan';
  addXp(s, standard ? 15 : 5);
  if (standard) s.labFails = 0;
  else {
    s.labFails += 1;
    // Mỗi 3 lần ra món không chuẩn, lộ thêm 1 nguyên liệu của một món chuẩn còn bí ẩn.
    if (s.labFails % 3 === 0) {
      const target = mysteryRecipes(s)[0];
      if (target) s.labHints[target] = Math.min(Object.keys(RECIPES[target].ingredients).length, (s.labHints[target] ?? 0) + 1);
    }
  }
  log(s, `🧪 Thử ra món: ${r.emoji} ${r.name}`, r.kind === 'quai_di' ? 'bad' : 'good');
  return { kind: 'new', recipeId: r.id };
}

/** Thêm món vào menu: khách gọi nhiều hơn trong ngày bán đầu tiên; có khi thành trend. */
export function addToMenu(s: GameState, id: RecipeId, rng: () => number): boolean {
  if (!RECIPES[id] || s.unlockedRecipes.includes(id)) return false;
  if (!s.discovered.includes(id)) s.discovered.push(id);
  s.unlockedRecipes.push(id);
  s.launched[id] = s.phase === 'summary' ? s.day + 1 : s.day;
  s.chefQueue.push({ kind: 'newDish', recipeId: id });
  log(s, `🆕 ${RECIPES[id].emoji} ${RECIPES[id].name} lên menu!`, 'good');
  if (rng() < 0.3) startTrend(s, id, 'launch');
  return true;
}

/** Bỏ món khỏi menu (menu luôn còn ít nhất 1 món). */
export function removeFromMenu(s: GameState, id: RecipeId): boolean {
  if (!s.unlockedRecipes.includes(id) || s.unlockedRecipes.length <= 1) return false;
  s.unlockedRecipes = s.unlockedRecipes.filter((x) => x !== id);
  return true;
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
