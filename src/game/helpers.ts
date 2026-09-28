import {
  BASE_ERROR,
  FIRST_NAMES,
  INGREDIENTS,
  RECIPES,
  TRAITS,
} from './data';
import type {
  DayRuntime,
  GameState,
  IngredientId,
  Recipe,
  RecipeId,
  Rng,
  Staff,
  StaffRole,
  StaffTrait,
} from './types';

/** RNG có seed (mulberry32) để mô phỏng/kiểm thử lặp lại được. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const defaultRng: Rng = Math.random;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function weightedPick<T extends string>(rng: Rng, weights: Partial<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
  let r = rng() * total;
  for (const [key, w] of entries) {
    r -= Math.max(0, w);
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

export function nextId(s: GameState, prefix: string): string {
  s.idSeq += 1;
  return `${prefix}${s.idSeq}`;
}

export function log(s: GameState, text: string, tone: 'good' | 'bad' | 'info' = 'info') {
  if (!s.run) return;
  s.idSeq += 1;
  s.run.log.unshift({ id: s.idSeq, t: s.run.elapsed, text, tone });
  if (s.run.log.length > 40) s.run.log.length = 40;
}

export function note(s: GameState, text: string) {
  s.report.notes.push(text);
}

export function spend(s: GameState, amount: number, bucket: 'fines' | 'otherCosts') {
  s.money -= amount;
  s.report[bucket] += amount;
}

export function changeRep(s: GameState, delta: number) {
  s.reputation = clamp(s.reputation + delta, 0.5, 5);
}

export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.round(Math.abs(n));
  return `${sign}${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;
}

export function formatClock(elapsed: number, dayMs: number, open: number, close: number): string {
  const minutes = Math.floor((open + ((close - open) * Math.min(elapsed, dayMs)) / dayMs) * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ---------- Kho ----------

export function usableQty(s: GameState, id: IngredientId): number {
  return s.stock
    .filter((b) => b.ingredientId === id && b.expiresOnDay >= s.day)
    .reduce((sum, b) => sum + b.qty, 0);
}

export function expiredQty(s: GameState): number {
  return s.stock.filter((b) => b.expiresOnDay < s.day).reduce((sum, b) => sum + b.qty, 0);
}

/** Lấy nguyên liệu theo kiểu FIFO — đồ sắp hết hạn dùng trước. */
export function takeStock(s: GameState, id: IngredientId, qty: number): number {
  let remaining = qty;
  const batches = s.stock
    .filter((b) => b.ingredientId === id && b.expiresOnDay >= s.day)
    .sort((a, b) => a.expiresOnDay - b.expiresOnDay);
  for (const b of batches) {
    if (remaining <= 0) break;
    const used = Math.min(b.qty, remaining);
    b.qty -= used;
    remaining -= used;
  }
  s.stock = s.stock.filter((b) => b.qty > 0);
  return qty - remaining;
}

function ingredientNeeds(recipe: Recipe, noGarnish: boolean) {
  return (Object.entries(recipe.ingredients) as [IngredientId, number][]).filter(
    ([id]) => !(noGarnish && id === recipe.garnish)
  );
}

export function canMake(s: GameState, recipeId: RecipeId, noGarnish: boolean): boolean {
  return missingFor(s, recipeId, noGarnish).length === 0;
}

/** Danh sách nguyên liệu còn thiếu (chưa mua / chưa sơ chế). */
export function missingFor(s: GameState, recipeId: RecipeId, noGarnish: boolean): IngredientId[] {
  const recipe = RECIPES[recipeId];
  const missing: IngredientId[] = [];
  for (const [id, qty] of ingredientNeeds(recipe, noGarnish)) {
    const have = INGREDIENTS[id].needsPrep ? s.run?.prepped[id] ?? 0 : usableQty(s, id);
    if (have < qty) missing.push(id);
  }
  return missing;
}

export function consumeFor(s: GameState, recipeId: RecipeId, noGarnish: boolean) {
  const recipe = RECIPES[recipeId];
  for (const [id, qty] of ingredientNeeds(recipe, noGarnish)) {
    if (INGREDIENTS[id].needsPrep) {
      s.run!.prepped[id] = (s.run!.prepped[id] ?? 0) - qty;
    } else {
      takeStock(s, id, qty);
    }
  }
}

export function menuRecipes(s: GameState): Recipe[] {
  return s.unlockedRecipes.map((id) => RECIPES[id]);
}

/** Nguyên liệu cần sơ chế mà thực đơn hiện tại dùng tới. */
export function prepIngredients(s: GameState): IngredientId[] {
  const set = new Set<IngredientId>();
  for (const r of menuRecipes(s)) {
    for (const id of Object.keys(r.ingredients) as IngredientId[]) {
      if (INGREDIENTS[id].needsPrep) set.add(id);
    }
  }
  return [...set];
}

// ---------- Nhân viên ----------

export function fairWage(skill: number): number {
  return 80_000 + skill * 1_600;
}

export function staffSpeed(st: Staff): number {
  return st.speed * TRAITS[st.trait].speed;
}

export function isRush(s: GameState): boolean {
  const run = s.run;
  if (!run) return false;
  const dineIn = run.customers.filter((c) => c.kind !== 'delivery').length;
  return dineIn >= s.upgrades.seats;
}

/**
 * Tỉ lệ làm sai = gốc(vị trí) × (1 − 0.9·tay nghề) × tâm trạng × giờ cao điểm × tính cách.
 * Tay nghề 20 ≈ 25% sai, tay nghề 80 ≈ 8% sai (đầu bếp).
 */
export function errorRate(s: GameState, st: Staff): number {
  const skillFactor = 1 - (st.skill / 100) * 0.9;
  const moodFactor = st.mood < 30 ? 1.6 : st.mood < 50 ? 1.25 : st.mood > 80 ? 0.8 : 1;
  const rushFactor = isRush(s) ? 1.3 : 1;
  const studentFactor = st.student ? 1.8 : 1;
  return clamp(BASE_ERROR[st.role] * skillFactor * moodFactor * rushFactor * TRAITS[st.trait].error * studentFactor, 0, 0.9);
}

const TRAIT_WEIGHTS: Record<StaffTrait, number> = {
  steady: 40,
  fast_sloppy: 15,
  slow_careful: 15,
  late: 10,
  charming: 10,
  lazy: 10,
};

/** Ứng viên; `student` = sinh viên làm thêm: tay nghề thấp, lương khoảng 45% mức thường. */
export function makeStaff(s: GameState, rng: Rng, role?: StaffRole, student = false): Staff {
  const r: StaffRole = role ?? pick(rng, ['cook', 'prep', 'waiter'] as const);
  const skill = student ? Math.round(10 + rng() * 20) : Math.round(10 + rng() * 70);
  const wage = Math.round((fairWage(skill) * (student ? 0.45 : 0.85 + rng() * 0.3)) / 10_000) * 10_000;
  return {
    id: nextId(s, 'st'),
    name: pick(rng, FIRST_NAMES),
    role: r,
    skill,
    speed: Math.round((0.9 + rng() * 0.2) * 100) / 100,
    wage,
    mood: 70,
    trait: weightedPick(rng, TRAIT_WEIGHTS),
    exp: 0,
    daysWorked: 0,
    absent: false,
    lateUntil: 0,
    task: null,
    student: student || undefined,
  };
}

/** Số phần mỗi món khách còn chờ (chưa mang), trừ phần đang nấu và đã xong (quầy ra món + trên tay). */
export function dishNeeds(run: DayRuntime): Map<RecipeId, number> {
  const need = new Map<RecipeId, number>();
  for (const c of run.customers) for (const i of c.items) if (!i.served) need.set(i.recipeId, (need.get(i.recipeId) ?? 0) + 1);
  for (const sl of run.slots) if (sl.job) need.set(sl.job.recipeId, (need.get(sl.job.recipeId) ?? 0) - 1);
  for (const d of run.pass) if (d.quality !== 'burnt') need.set(d.recipeId, (need.get(d.recipeId) ?? 0) - 1);
  return need;
}

/**
 * Khách "đang được lo": mọi món chưa mang đều đang nấu hoặc đã sẵn sàng.
 * Chia phần đang nấu / đã xong cho khách gấp nhất trước.
 */
export function handledCustomers(run: DayRuntime): Set<string> {
  const supply = new Map<RecipeId, number>();
  const add = (id: RecipeId) => supply.set(id, (supply.get(id) ?? 0) + 1);
  for (const sl of run.slots) if (sl.job) add(sl.job.recipeId);
  for (const d of run.pass) if (d.quality !== 'burnt') add(d.recipeId);
  const out = new Set<string>();
  if (supply.size === 0) return out;
  const order = [...run.customers].sort((a, b) => a.patience / a.maxPatience - b.patience / b.maxPatience);
  for (const c of order) {
    const open = c.items.filter((i) => !i.served);
    if (!open.length) continue;
    const want = new Map<RecipeId, number>();
    for (const i of open) want.set(i.recipeId, (want.get(i.recipeId) ?? 0) + 1);
    if ([...want].every(([id, n]) => (supply.get(id) ?? 0) >= n)) {
      for (const [id, n] of want) supply.set(id, supply.get(id)! - n);
      out.add(c.id);
    }
  }
  return out;
}

/**
 * Nên thái gì tiếp (chạm thớt khi đang rảnh): đồ cần thái của món khách đang chờ còn thiếu nhiều nhất,
 * không có đơn thì món trong menu có ít phần thái sẵn nhất. Chỉ chọn đồ còn trong kho.
 */
export function suggestChop(s: GameState): IngredientId | null {
  const run = s.run;
  if (!run) return null;
  const score = new Map<IngredientId, number>();
  for (const id of s.unlockedRecipes) {
    const r = RECIPES[id];
    if (!r) continue;
    for (const i of Object.keys(r.ingredients) as IngredientId[]) {
      if (!INGREDIENTS[i].needsPrep || usableQty(s, i) <= 0) continue;
      score.set(i, (score.get(i) ?? 0) - (run.prepped[i] ?? 0) * 0.01);
    }
  }
  for (const [rid, n] of dishNeeds(run)) {
    if (n <= 0 || !RECIPES[rid]) continue;
    for (const [i, q] of Object.entries(RECIPES[rid].ingredients) as [IngredientId, number][]) {
      if (score.has(i)) score.set(i, (score.get(i) ?? 0) + n * q - (run.prepped[i] ?? 0));
    }
  }
  let best: IngredientId | null = null;
  for (const [i, v] of score) if (best === null || v > score.get(best)!) best = i;
  return best;
}
