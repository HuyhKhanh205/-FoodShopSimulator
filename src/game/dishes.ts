import { INGREDIENTS, RECIPES, RECIPE_IDS } from './data';
import type { DishKind, GameState, IngredientId, Recipe, RecipeId } from './types';

/**
 * Mọi tổ hợp nguyên liệu đều ra một món: trùng công thức chuẩn thì là món chuẩn,
 * không thì game tự đặt tên, giá, loại (lạ / quái dị) theo nhóm nguyên liệu.
 */

const CARB: Partial<Record<IngredientId, string>> = { banh_mi: 'Bánh mì', gao: 'Cơm', banh_pho: 'Phở', bun: 'Bún', banh_trang: 'Bánh tráng cuốn' };
const PROTEIN: Partial<Record<IngredientId, string>> = { trung: 'trứng', pate: 'pate', ga: 'gà', thit_bo: 'bò', thit_heo: 'heo', tom: 'tôm' };
const VEG: Partial<Record<IngredientId, string>> = { hanh: 'hành', rau: 'rau' };
const DRINK: Partial<Record<IngredientId, string>> = { tra: 'trà', ca_phe: 'cà phê', sua: 'sữa', da: 'đá' };
/** Thứ tự ghép tên: tinh bột → đạm → rau → đồ uống. */
const ORDER: IngredientId[] = ['banh_mi', 'gao', 'banh_pho', 'bun', 'banh_trang', 'thit_bo', 'thit_heo', 'ga', 'tom', 'trung', 'pate', 'rau', 'hanh', 'tra', 'ca_phe', 'sua', 'da'];

const COLOR: Partial<Record<IngredientId, string>> = {
  thit_bo: '#7B4A3A',
  thit_heo: '#C77B5A',
  ga: '#D98E3A',
  tom: '#FF7043',
  trung: '#F2C94C',
  pate: '#8D5A3B',
  gao: '#FFF6DA',
  banh_mi: '#D9A25F',
  banh_pho: '#F3DFB6',
  bun: '#FFF8E7',
  banh_trang: '#F1F8E9',
  rau: '#66BB6A',
  hanh: '#7CB342',
  tra: '#B87333',
  ca_phe: '#5D4037',
  sua: '#F5F5F0',
  da: '#E1F5FE',
};

export const comboKey = (ids: IngredientId[]) => [...new Set(ids)].sort().join('+');

const BASE_BY_KEY = new Map<string, RecipeId>(RECIPE_IDS.map((id) => [comboKey(Object.keys(RECIPES[id].ingredients) as IngredientId[]), id]));

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const hash = (t: string) => {
  let h = 7;
  for (let i = 0; i < t.length; i += 1) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return h;
};

export const DISH_KIND_LABEL: Record<DishKind, string> = { chuan: '😋 Ngon', la: '🤔 Lạ', quai_di: '🧟 Quái dị' };

/** Xếp loại tổ hợp: chuẩn / lạ (hợp lý) / quái dị. */
export function classify(ids: IngredientId[]): DishKind {
  const set = [...new Set(ids)];
  if (BASE_BY_KEY.has(comboKey(set))) return 'chuan';
  const carbs = set.filter((i) => CARB[i]).length;
  const proteins = set.filter((i) => PROTEIN[i]).length;
  const drinks = set.filter((i) => DRINK[i]).length;
  const food = set.length - drinks;
  if (drinks > 0 && food > 0) return 'quai_di'; // trộn đồ uống với đồ ăn
  if (carbs >= 2) return 'quai_di'; // hai loại tinh bột
  if (drinks === set.length) return 'la'; // chỉ đồ uống: hợp lý
  if (carbs === 0 && proteins === 0) return 'la'; // gỏi rau
  return 'la';
}

/** Tên món tự sinh. */
function nameOf(ids: IngredientId[], kind: DishKind): string {
  const sorted = [...new Set(ids)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const carbs = sorted.filter((i) => CARB[i]).map((i) => CARB[i]!);
  const rest = sorted.filter((i) => !CARB[i]).map((i) => PROTEIN[i] ?? VEG[i] ?? DRINK[i]!);
  if (carbs.length) return [carbs.join(' '), ...rest].join(' ');
  const proteins = sorted.filter((i) => PROTEIN[i]).map((i) => PROTEIN[i]!);
  const veg = sorted.filter((i) => VEG[i]).map((i) => VEG[i]!);
  const drinks = sorted.filter((i) => DRINK[i]).map((i) => DRINK[i]!);
  if (kind !== 'quai_di' && drinks.length === sorted.length) return cap(drinks.join(' '));
  if (proteins.length) return cap([proteins[0], 'xào', ...proteins.slice(1), ...veg, ...drinks].join(' '));
  if (veg.length && !drinks.length) return cap(['gỏi', ...veg].join(' '));
  return cap([...veg, ...drinks].join(' '));
}

function emojiOf(ids: IngredientId[], kind: DishKind, key: string): string {
  if (kind === 'quai_di') return ['🧟', '🤢', '👾', '🫠'][hash(key) % 4];
  const carb = ids.find((i) => CARB[i]);
  if (carb) return ({ banh_mi: '🥖', gao: '🍚', banh_pho: '🍜', bun: '🍝', banh_trang: '🌯' } as Record<string, string>)[carb];
  if (ids.every((i) => DRINK[i])) return '🥤';
  if (ids.includes('trung')) return '🍳';
  if (ids.some((i) => PROTEIN[i])) return '🍖';
  return '🥗';
}

/** Món ứng với tổ hợp (chưa đăng ký vào RECIPES). */
export function dishFromCombo(ids: IngredientId[]): Recipe {
  const set = [...new Set(ids)];
  const key = comboKey(set);
  const base = BASE_BY_KEY.get(key);
  if (base) return RECIPES[base];
  const id = `x_${key}`;
  if (RECIPES[id]) return RECIPES[id];
  const kind = classify(set);
  const drinkOnly = set.every((i) => DRINK[i]);
  const cooked = set.some((i) => ['trung', 'ga', 'thit_bo', 'thit_heo'].includes(i));
  const station = drinkOnly || (!cooked && !set.some((i) => ['gao', 'banh_pho'].includes(i))) ? 'counter' : 'stove';
  const cost = set.reduce((n, i) => n + INGREDIENTS[i].basePrice, 0);
  const price = Math.max(5_000, Math.round((cost * 2.2 * (kind === 'quai_di' ? 0.8 : 1)) / 1000) * 1000);
  const colorOf = set.find((i) => PROTEIN[i]) ?? set.find((i) => CARB[i]) ?? set[0];
  return {
    id,
    name: (kind === 'quai_di' ? '' : '') + nameOf(set, kind),
    emoji: emojiOf(set, kind, key),
    price,
    ingredients: Object.fromEntries(set.map((i) => [i, 1])),
    station,
    cookTime: station === 'stove' ? 2_500 + 1_200 * set.length : 1_200 + 600 * set.length,
    drink: drinkOnly,
    burns: station === 'stove',
    garnish: set.includes('hanh') && kind !== 'quai_di' && set.length > 1 ? 'hanh' : undefined,
    kind,
    color: kind === 'quai_di' ? '#7CB342' : COLOR[colorOf] ?? '#BCAAA4',
  };
}

export function dishKind(id: RecipeId): DishKind {
  return RECIPES[id]?.kind ?? 'chuan';
}

/** Đăng ký món sinh ra vào RECIPES (và bản lưu). */
export function registerDish(s: GameState, r: Recipe) {
  if (!RECIPES[r.id]) RECIPES[r.id] = r;
  if (r.id.startsWith('x_')) s.dishes[r.id] = r;
}

/** Nạp lại các món sinh ra từ bản lưu vào RECIPES. */
export function syncDishes(s: GameState) {
  for (const r of Object.values(s.dishes ?? {})) RECIPES[r.id] = r;
}

/**
 * Tổ hợp trong nồi → món nấu ra. Nồi thiếu hành mà thêm hành vào khớp một món trong menu
 * (hoặc món chuẩn) có hành rắc thêm → nấu món đó dạng "không hành".
 */
export function resolveCombo(s: GameState, ids: IngredientId[]): { recipe: Recipe; noGarnish: boolean } {
  const set = [...new Set(ids)];
  // Đúng tổ hợp là món chuẩn hoặc món đang bán (vd "Phở rau" khi menu có cả "Phở rau hành") → nấu đúng món đó.
  const exact = dishFromCombo(set);
  if (BASE_BY_KEY.has(comboKey(set)) || s.unlockedRecipes.includes(exact.id)) return { recipe: exact, noGarnish: false };
  if (!set.includes('hanh') && set.length >= 1) {
    const withH = dishFromCombo([...set, 'hanh']);
    if (withH.garnish === 'hanh' && (withH.kind === undefined || withH.kind === 'chuan' || s.unlockedRecipes.includes(withH.id))) {
      return { recipe: withH, noGarnish: true };
    }
  }
  return { recipe: dishFromCombo(set), noGarnish: false };
}

/** Lời bình của Chú Tư khi thử ra món. */
export function chefComment(r: Recipe): string {
  const kind = r.kind ?? 'chuan';
  if (kind === 'chuan') return 'Chuẩn vị! Khách nào cũng mê.';
  if (kind === 'la') return 'Lạ miệng đó! Khách có người thích, có người chê.';
  return 'Ối trời... món này quái dị quá! Khách dễ phàn nàn — nhưng biết đâu lại thành trend 🔥';
}

/**
 * Món đã nấu có giao được cho đơn `orderId` không: đúng món, hoặc món "X + hành" nấu không hành
 * cho đơn "X" (cùng nguyên liệu khi bỏ hành — bản lưu cũ có thể còn món nấu lệch như vậy).
 */
export function dishMatches(orderId: RecipeId, dish: { recipeId: RecipeId; noGarnish?: boolean }): boolean {
  if (dish.recipeId === orderId) return true;
  if (!dish.noGarnish) return false;
  const made = RECIPES[dish.recipeId];
  const order = RECIPES[orderId];
  if (!made || !order || 'hanh' in order.ingredients) return false;
  const withoutH = (Object.keys(made.ingredients) as IngredientId[]).filter((i) => i !== 'hanh');
  return comboKey(withoutH) === comboKey(Object.keys(order.ingredients) as IngredientId[]);
}
