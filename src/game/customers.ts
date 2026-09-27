import { addXp } from './progression';
import { orderWeight, startTrend, trendPriceMult, trendRepMult } from './trend';
import { CUSTOMER_EMOJI, FIRST_NAMES, RECIPES, REGULARS, REVIEW_TEXTS } from './data';
import { changeRep, clamp, formatMoney, log, menuRecipes, nextId, pick, weightedPick } from './helpers';
import type { Customer, CustomerKind, GameState, OrderItem, RecipeId, Rng, Staff } from './types';

const QUALITY_SCORE = { perfect: 1, raw: 0.35, burnt: 0.05 } as const;

/** Hệ số kéo dài thời gian chờ của mọi khách. */
const PATIENCE_BONUS = 1.95;
/** Mỗi món mang ra hồi lại chừng này kiên nhẫn. */
export const SERVE_REFILL = 0.15;

/** Thời gian khách chịu chờ (ms) trước khi bỏ về (trước khi nhân PATIENCE_BONUS). */
const BASE_PATIENCE: Record<CustomerKind, number> = {
  normal: 75_000,
  picky: 48_000,
  reviewer: 68_000,
  allergic: 75_000,
  regular: 90_000,
  delivery: 120_000,
  dasher: 75_000,
  group: 150_000,
};

function repWeight(c: Customer): number {
  if (c.kind === 'reviewer') return 3;
  if (c.kind === 'group') return 2;
  return 1;
}

/** Chọn món theo trọng số: món trend và món mới ra mắt được gọi nhiều hơn. */
function pickMenu<T extends { id: RecipeId }>(s: GameState, rng: Rng, list: T[]): T {
  const weights = list.map((r) => orderWeight(s, r.id));
  let x = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i += 1) {
    x -= weights[i];
    if (x <= 0) return list[i];
  }
  return list[list.length - 1];
}

/** Ngày làm quen: lượng khách ngày 1 ≈ 1/3, ngày 2 ≈ 1/2, ngày 3 ≈ 3/4, từ ngày 4 bình thường. */
export function introFactor(day: number): number {
  return day <= 1 ? 0.33 : day === 2 ? 0.5 : day === 3 ? 0.75 : 1;
}

export function makeCustomer(s: GameState, rng: Rng, forced?: CustomerKind, groupOrder?: { recipeId: RecipeId; qty: number }): Customer | null {
  const menu = menuRecipes(s);
  const mains = menu.filter((r) => !r.drink);
  const drinks = menu.filter((r) => r.drink);
  if (mains.length === 0) return null;

  const present = new Set(s.run!.customers.map((c) => c.name));
  const regularsAvailable = REGULARS.filter((r) => !present.has(r.name) && s.unlockedRecipes.includes(r.favorite));

  // Ngày làm quen (1–3): khách lẻ, dễ tính, gọi ít món.
  const easy = s.day <= 3 && !forced;
  const kind: CustomerKind =
    forced ??
    (easy
      ? weightedPick<CustomerKind>(rng, { normal: 80, allergic: s.day >= 2 ? 10 : 0, picky: s.day === 3 ? 6 : 0, delivery: s.day === 3 ? 6 : 0 })
      : null) ??
    weightedPick<CustomerKind>(rng, {
      normal: 55,
      picky: 8,
      reviewer: 3,
      allergic: 8,
      regular: s.day > 2 && regularsAvailable.length ? 8 : 0,
      delivery: 8 * s.mods.deliveryMult,
      dasher: 4,
    });

  let name = pick(rng, FIRST_NAMES);
  let emoji = pick(rng, CUSTOMER_EMOJI);
  let size = 1;
  const items: OrderItem[] = [];
  const item = (recipeId: RecipeId, noGarnish = false): OrderItem => ({ recipeId, noGarnish, served: false, quality: 0 });

  if (kind === 'group' && groupOrder) {
    name = 'Công ty ' + pick(rng, ['Sao Mai', 'Hòa Phát', 'Minh Long', 'Tân Tiến']);
    emoji = '🏢';
    size = groupOrder.qty;
    for (let i = 0; i < groupOrder.qty; i += 1) items.push(item(groupOrder.recipeId));
  } else if (kind === 'regular') {
    const reg = pick(rng, regularsAvailable);
    name = reg.name;
    emoji = '😊';
    items.push(item(reg.favorite));
    if (drinks.length && rng() < 0.7) items.push(item(pickMenu(s, rng, drinks).id));
  } else if (kind === 'delivery') {
    name = 'Shipper (đơn của ' + name + ')';
    emoji = '🛵';
    const count = rng() < 0.4 ? 2 : 1;
    for (let i = 0; i < count; i += 1) items.push(item(pickMenu(s, rng, mains).id));
    if (drinks.length && rng() < 0.4) items.push(item(pickMenu(s, rng, drinks).id));
  } else {
    // Khách đi theo nhóm 1–3 người, mỗi người một món chính và có thể gọi thêm nước.
    size = easy ? 1 : Number(weightedPick(rng, { '1': 45, '2': 40, '3': 15 }));
    for (let p = 0; p < size; p += 1) {
      if (kind === 'allergic' && p === 0) {
        const withGarnish = mains.filter((r) => r.garnish);
        const main = withGarnish.length ? pick(rng, withGarnish) : pickMenu(s, rng, mains);
        items.push(item(main.id, Boolean(main.garnish)));
      } else {
        items.push(item(pickMenu(s, rng, mains).id));
      }
      if (drinks.length && rng() < (easy ? (s.day === 3 ? 0.3 : 0) : 0.6)) items.push(item(pickMenu(s, rng, drinks).id));
    }
  }

  const patience =
    (BASE_PATIENCE[kind] + 15_000 * Math.min(5, items.length - 1)) * PATIENCE_BONUS * (1 + 0.2 * s.upgrades.aircon) * (1 + 0.5 * (1 - introFactor(s.day)));
  return {
    id: nextId(s, 'c'),
    name,
    emoji,
    kind,
    size,
    items,
    patience,
    maxPatience: patience,
    arrivedAt: s.run!.elapsed,
  };
}

function addReview(s: GameState, c: Customer, stars: number, rng: Rng, text?: string) {
  s.report.reviews.push({ name: c.name, stars, text: text ?? pick(rng, REVIEW_TEXTS[stars]) });
  if (s.report.reviews.length > 60) s.report.reviews.shift();
}

/**
 * Khách ăn món lạ / quái dị: có thể phàn nàn (trả ít tiền, danh tiếng giảm),
 * khen lạ miệng, hoặc quay clip lên mạng → món thành trend.
 */
function reactToOddDish(s: GameState, c: Customer, item: OrderItem, rng: Rng) {
  const kind = RECIPES[item.recipeId]?.kind;
  if (!kind || kind === 'chuan') return;
  const r = rng();
  const t = s.run!.elapsed;
  const say = (icon: string, text: string) => (c.chat = { icon, text, until: t + 4500 });
  const name = RECIPES[item.recipeId].name;
  if (kind === 'quai_di') {
    if (r < 0.55) {
      item.quality = Math.min(item.quality, 0.3);
      changeRep(s, -0.05 * repWeight(c));
      s.report.complaints = (s.report.complaints ?? 0) + 1;
      say('🤢', pick(rng, ['Món gì kỳ vậy trời!', 'Ăn không nổi luôn...', 'Ai nghĩ ra món này vậy?!']));
      addReview(s, c, 1, rng, `${name}?? Quái dị hết sức!`);
      log(s, `🤢 ${c.name} phàn nàn về món quái dị ${name}`, 'bad');
    } else if (r < 0.85) {
      say('😐', 'Ờ... cũng ăn được.');
    } else {
      say('📱', 'Món này độc lạ quá, quay clip mới được!');
      c.tipBonus = (c.tipBonus ?? 0) + 0.3;
      startTrend(s, item.recipeId, 'viral');
    }
  } else if (r < 0.1) {
    item.quality = Math.min(item.quality, 0.6);
    say('😕', 'Hơi lạ miệng quá...');
  } else if (r < 0.3) {
    c.tipBonus = (c.tipBonus ?? 0) + 0.2;
    say('😋', 'Lạ miệng mà ngon ghê!');
  } else if (r < 0.33) {
    say('📱', 'Ngon lạ quá, phải đăng lên mạng!');
    startTrend(s, item.recipeId, 'viral');
  }
}

function removeCustomer(s: GameState, c: Customer) {
  s.run!.customers = s.run!.customers.filter((x) => x.id !== c.id);
}

function priceOf(s: GameState, recipeId: RecipeId) {
  return Math.round(RECIPES[recipeId].price * s.mods.sellPriceMult * trendPriceMult(s, recipeId));
}

/** Khách hết kiên nhẫn bỏ về: chỉ trả tiền món đã nhận. */
export function customerLeavesAngry(s: GameState, c: Customer, rng: Rng) {
  const paid = c.items.filter((i) => i.served).reduce((sum, i) => sum + priceOf(s, i.recipeId), 0);
  s.money += paid;
  s.report.revenue += paid;
  s.report.lost += 1;
  changeRep(s, -0.05 * repWeight(c));
  addReview(s, c, 1, rng, pick(rng, ['Chờ lâu quá, bỏ về!', 'Gọi mãi không thấy món.', 'Quán gì mà chậm thế!']));
  log(s, `😡 ${c.name} chờ lâu quá nên bỏ về`, 'bad');
  if (c.kind === 'reviewer') log(s, '📸 Hóa ra đó là food reviewer! Danh tiếng giảm mạnh', 'bad');
  removeCustomer(s, c);
}

function completeCustomer(s: GameState, c: Customer, rng: Rng) {
  const base = c.items.reduce((sum, i) => sum + priceOf(s, i.recipeId), 0);
  const qAvg = c.items.reduce((sum, i) => sum + i.quality, 0) / c.items.length;
  const patienceRatio = clamp(c.patience / c.maxPatience, 0, 1);
  let score = qAvg * 0.7 + patienceRatio * 0.3;
  let paid = base * (0.5 + 0.5 * qAvg);

  const staffOnDuty = s.staff.filter((st) => !st.absent && s.run!.elapsed >= st.lateUntil);
  const charming = staffOnDuty.some((st) => st.role === 'waiter' && st.trait === 'charming');
  let tipMult = (c.kind === 'regular' ? 2 : 1) + (charming ? 0.3 : 0) + (c.tipBonus ?? 0);
  let tip = base * 0.15 * patienceRatio * qAvg * tipMult;

  if (c.kind === 'picky') {
    if (qAvg >= 0.99) {
      paid *= 1.5;
      log(s, `🧐 Khách khó tính ${c.name} hài lòng, trả gấp rưỡi!`, 'good');
    } else {
      score -= 0.15;
    }
  }
  if (c.kind === 'delivery') {
    paid *= 0.8;
    tip = 0;
  }
  if (c.kind === 'group' && qAvg > 0.9) paid *= 1.2;

  if (c.kind === 'dasher') {
    const catchChance = Math.max(0, ...staffOnDuty.filter((st) => st.role === 'waiter').map((st) => (st.skill / 100) * 0.8));
    const catcher = staffOnDuty.find((st) => st.role === 'waiter');
    if (rng() < catchChance && catcher) {
      log(s, `🏃 ${catcher.name} đã chặn được khách định bùng tiền!`, 'good');
    } else {
      s.report.dashers += 1;
      log(s, `🏃💨 ${c.name} ăn xong bùng tiền, mất ${formatMoney(base)}!`, 'bad');
      paid = 0;
      tip = 0;
    }
  }

  paid = Math.round(paid);
  tip = Math.round(tip);
  s.money += paid + tip;
  s.report.revenue += paid;
  s.report.tips += tip;
  s.report.served += 1;
  if (c.kind !== 'delivery') s.cleanliness = clamp(s.cleanliness - 2.5, 0, 100);

  // Món trend: danh tiếng cộng thêm tới 20%.
  const trendBoost = Math.max(...c.items.map((i) => trendRepMult(s, i.recipeId)));
  const repDelta = (score - 0.55) * 0.06 * repWeight(c);
  changeRep(s, repDelta > 0 ? repDelta * trendBoost : repDelta);
  const stars = clamp(Math.round(1 + 4 * score), 1, 5);
  addReview(s, c, stars, rng);
  if (c.kind === 'reviewer') {
    log(s, `📸 ${c.name} là food reviewer! Chấm ${stars}★`, stars >= 4 ? 'good' : 'bad');
  } else if (paid > 0) {
    log(s, `💰 ${c.name} trả ${formatMoney(paid)}${tip ? ` + tip ${formatMoney(tip)}` : ''} (${stars}★)`, 'good');
  }
  removeCustomer(s, c);

  // Tình huống: khách phàn nàn có tóc trong đồ ăn (vệ sinh kém thì dễ xảy ra hơn).
  const hairChance = 0.02 + (s.cleanliness < 50 ? 0.06 : 0);
  if (paid > 0 && !s.activeEvent && c.kind !== 'delivery' && rng() < hairChance) {
    s.activeEvent = { defId: 'hair_complaint', ctx: { name: c.name, amount: paid } };
  }
}

/**
 * Mang món ra cho khách. Món không có trong đơn → khách trả lại, bực mình.
 * Khách dặn "không hành" mà món có hành → dị ứng, bỏ về ngay.
 */
export function serveDish(s: GameState, dishId: string, customerId: string, rng: Rng, by?: Staff): boolean {
  const run = s.run!;
  const dish = run.pass.find((d) => d.id === dishId);
  const c = run.customers.find((x) => x.id === customerId);
  if (!dish || !c) return false;
  const who = by ? `${by.name} mang` : 'Bạn mang';
  const recipe = RECIPES[dish.recipeId];

  const candidates = c.items.filter((i) => !i.served && i.recipeId === dish.recipeId);
  if (candidates.length === 0) {
    c.patience -= c.maxPatience * 0.2;
    s.report.wrongDishes += 1;
    log(s, `🙅 ${who} ${recipe.name} nhầm bàn — ${c.name}: "Tôi đâu có gọi món này!"`, 'bad');
    return false;
  }
  const target = candidates.find((i) => i.noGarnish === dish.noGarnish) ?? candidates[0];
  run.pass = run.pass.filter((d) => d.id !== dish.id);
  run.carrying = run.carrying.filter((id) => id !== dish.id);

  if (target.noGarnish && !dish.noGarnish) {
    s.report.allergic += 1;
    changeRep(s, -0.25 * repWeight(c));
    addReview(s, c, 1, rng, 'Tôi đã dặn KHÔNG HÀNH mà!! Dị ứng nổi mẩn hết người.');
    log(s, `🤢 ${c.name} bị dị ứng hành! Khách bỏ về, danh tiếng giảm mạnh`, 'bad');
    removeCustomer(s, c);
    return true;
  }

  target.served = true;
  target.quality = QUALITY_SCORE[dish.quality];
  // Nhận được món thì khách vui lên một chút.
  c.patience = Math.min(c.maxPatience, c.patience + c.maxPatience * SERVE_REFILL);
  reactToOddDish(s, c, target, rng);
  addXp(s, dish.quality === 'perfect' ? 10 : 4);
  if (dish.quality === 'raw') log(s, `😖 ${c.name}: "${recipe.name} còn sống!"`, 'bad');
  if (dish.quality === 'burnt') log(s, `🤮 ${c.name}: "${recipe.name} cháy khét!"`, 'bad');
  if (c.items.every((i) => i.served)) completeCustomer(s, c, rng);
  return true;
}
