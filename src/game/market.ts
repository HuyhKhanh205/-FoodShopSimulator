import { CLOSE_HOUR, DAY_MS, INGREDIENTS, OPEN_HOUR, RECIPES } from './data';
import { buy } from './engine';
import { usableQty } from './helpers';
import { unlockedIngredients } from './progression';
import type { GameState, IngredientId, Rng } from './types';

/**
 * Chợ: 4 sạp, mỗi sạp một người bán. Mọi khoản bớt là **số tiền cụ thể mỗi phần** (không dùng phần trăm):
 * bớt do thân thiết, bớt do trả giá thành công, khuyến mãi trong ngày ("rau chiều bớt 500đ").
 * Dữ liệu (thân thiết, lượt trả giá) nằm trong GameState → lưu trên máy người chơi như bản lưu hiện có.
 */

export type VendorId = 'thit' | 'bot' | 'rau' | 'nuoc';

export interface Vendor {
  id: VendorId;
  /** Người bán. */
  name: string;
  /** Tên sạp. */
  stall: string;
  emoji: string;
  /** Màu nhóm (xem GROUP trong ui.tsx). */
  group: 'meat' | 'egg' | 'veg' | 'fish';
  items: IngredientId[];
  /** Mô hình người bán (Kenney Mini Characters). */
  model: string;
}

export const VENDORS: Vendor[] = [
  { id: 'thit', name: 'Cô Bảy', stall: 'Sạp thịt & tôm', emoji: '🥩', group: 'meat', items: ['thit_bo', 'thit_heo', 'ga', 'pate', 'tom'], model: 'mini_female_a' },
  { id: 'bot', name: 'Bà Năm', stall: 'Sạp trứng & bột', emoji: '🥚', group: 'egg', items: ['trung', 'banh_mi', 'gao', 'banh_pho', 'bun', 'banh_trang'], model: 'mini_female_c' },
  { id: 'rau', name: 'Dì Sáu', stall: 'Sạp rau', emoji: '🥬', group: 'veg', items: ['hanh', 'rau'], model: 'mini_male_b' },
  { id: 'nuoc', name: 'Chú Ba', stall: 'Tạp hoá đồ uống', emoji: '🧋', group: 'fish', items: ['tra', 'ca_phe', 'sua', 'da'], model: 'mini_male_d' },
];
export const VENDOR_MAP = Object.fromEntries(VENDORS.map((v) => [v.id, v])) as Record<VendorId, Vendor>;
export const vendorOf = (id: IngredientId): Vendor => VENDORS.find((v) => v.items.includes(id)) ?? VENDORS[1];

export interface VendorState {
  /** 0–100. */
  friendship: number;
  /** Lượt trả giá còn trong ngày. */
  haggles: number;
  /** Trả giá thành công hôm nay: mức bớt (tỉ lệ nội bộ, luôn hiện ra thành số tiền). */
  haggleRate: number;
}
export const HAGGLES_PER_DAY = 2;

export function newVendors(): Record<VendorId, VendorState> {
  return Object.fromEntries(VENDORS.map((v) => [v.id, { friendship: 0, haggles: HAGGLES_PER_DAY, haggleRate: 0 }])) as Record<VendorId, VendorState>;
}

export function vendorState(s: GameState, v: VendorId): VendorState {
  s.vendors ??= newVendors();
  return (s.vendors[v] ??= { friendship: 0, haggles: HAGGLES_PER_DAY, haggleRate: 0 });
}

/** Sáng mới: hồi lượt trả giá, bỏ mức bớt hôm qua. */
export function resetMarketDay(s: GameState) {
  for (const v of VENDORS) {
    const st = vendorState(s, v.id);
    st.haggles = HAGGLES_PER_DAY;
    st.haggleRate = 0;
  }
}

/** Cấp thân thiết 1–5. */
export const friendLevel = (friendship: number) => Math.min(5, 1 + Math.floor(friendship / 25));
const FRIEND_RATE = [0, 0.04, 0.07, 0.1, 0.12];

/** Làm tròn số tiền bớt: món rẻ tới 100đ, món khác tới 500đ; ít nhất 100đ. */
export function roundOff(price: number, amount: number) {
  const step = price < 5_000 ? 100 : 500;
  return Math.max(100, Math.round(amount / step) * step);
}

/** Giờ ở chợ: buổi sáng (trước mở cửa) = 6:30, giữa giờ bán thì theo đồng hồ quán. */
export function marketHour(s: GameState) {
  if (s.phase === 'open' && s.run) return OPEN_HOUR + ((CLOSE_HOUR - OPEN_HOUR) * s.run.elapsed) / DAY_MS;
  return 6.5;
}

export interface Deal {
  id: IngredientId;
  /** Số tiền bớt mỗi phần. */
  off: number;
  /** Câu ngắn, ví dụ "Rau chiều bớt 500đ". */
  label: string;
}

/** Số ngẫu nhiên cố định theo ngày (khuyến mãi không đổi khi tải lại). */
const dayRand = (day: number, k: number) => {
  let x = (day * 2654435761 + k * 40503) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
};

/** Khuyến mãi đang áp dụng: một món buổi sáng; rau / hành buổi chiều (sau 13:00). */
export function activeDeals(s: GameState): Deal[] {
  const open = unlockedIngredients(s).filter((i) => !s.mods.unavailable.includes(i));
  const deals: Deal[] = [];
  const hour = marketHour(s);
  if (hour < 13) {
    const pool = open.filter((i) => !['hanh', 'rau'].includes(i));
    if (pool.length) {
      const id = pool[Math.floor(dayRand(s.day, 1) * pool.length)];
      const off = roundOff(s.prices[id], s.prices[id] * 0.2);
      deals.push({ id, off, label: `${INGREDIENTS[id].name} sáng nay bớt ${fmt(off)}` });
    }
  } else {
    for (const id of ['rau', 'hanh'] as IngredientId[]) {
      if (!open.includes(id)) continue;
      const off = roundOff(s.prices[id], s.prices[id] * 0.3);
      deals.push({ id, off, label: `${id === 'rau' ? 'Rau' : 'Hành'} chiều bớt ${fmt(off)}` });
    }
  }
  return deals;
}

export const fmt = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

export interface PriceLine {
  label: string;
  amount: number;
}

/** Giá mua mỗi phần ở sạp: giá chợ − các khoản bớt (số tiền), không dưới 50% giá chợ. */
export function vendorPrice(s: GameState, id: IngredientId): { base: number; final: number; offs: PriceLine[] } {
  const base = s.prices[id];
  const v = vendorOf(id);
  const st = vendorState(s, v.id);
  const offs: PriceLine[] = [];
  const lv = friendLevel(st.friendship);
  if (FRIEND_RATE[lv - 1] > 0) offs.push({ label: `Thân thiết cấp ${lv}`, amount: roundOff(base, base * FRIEND_RATE[lv - 1]) });
  if (st.haggleRate > 0) offs.push({ label: 'Trả giá', amount: roundOff(base, base * st.haggleRate) });
  const deal = activeDeals(s).find((d) => d.id === id);
  if (deal) offs.push({ label: deal.label.split(' bớt')[0], amount: deal.off });
  const total = offs.reduce((n, o) => n + o.amount, 0);
  const final = Math.max(Math.ceil(base / 2 / 100) * 100, base - total);
  return { base, final, offs };
}

/** Trả giá ở một sạp: 2 lượt / ngày. Thành công → cả sạp bớt thêm một số tiền mỗi phần hôm nay. */
export function haggle(s: GameState, vendor: VendorId, rng: Rng): { ok: boolean; say: string } | null {
  const st = vendorState(s, vendor);
  if (st.haggles <= 0) return null;
  st.haggles -= 1;
  const v = VENDOR_MAP[vendor];
  const lv = friendLevel(st.friendship);
  const chance = 0.45 + 0.08 * (lv - 1);
  if (rng() < chance) {
    st.haggleRate = Math.min(0.2, st.haggleRate + 0.08 + rng() * 0.07);
    const sample = v.items.find((i) => unlockedIngredients(s).includes(i)) ?? v.items[0];
    const off = roundOff(s.prices[sample], s.prices[sample] * st.haggleRate);
    return { ok: true, say: `${v.name}: "Thôi được, bớt con ${fmt(off)} mỗi phần ${INGREDIENTS[sample].name.toLowerCase()} nè!"` };
  }
  st.friendship = Math.max(0, st.friendship - 3);
  return { ok: false, say: `${v.name}: "Giá này là rẻ lắm rồi con ơi, không bớt được nữa đâu!"` };
}

/** Câu rao của người bán (luôn nói số tiền). */
export function vendorCall(s: GameState, vendor: VendorId, k: number): string {
  const v = VENDOR_MAP[vendor];
  const open = v.items.filter((i) => unlockedIngredients(s).includes(i));
  const deal = activeDeals(s).find((d) => v.items.includes(d.id));
  if (deal && k % 2 === 0) return `${deal.label} nè con!`;
  if (!open.length) return 'Ghé coi hàng nghen!';
  const id = open[k % open.length];
  const diff = s.prices[id] - INGREDIENTS[id].basePrice;
  if (diff >= 100) return `${INGREDIENTS[id].name} lên ${fmt(roundOff(s.prices[id], diff))} rồi nghen`;
  if (diff <= -100) return `${INGREDIENTS[id].name} rẻ hơn ${fmt(roundOff(s.prices[id], -diff))} nè!`;
  return `${INGREDIENTS[id].name} ${fmt(s.prices[id])} một phần, tươi lắm!`;
}

/** Người bán chào chủ quán mới (buổi chợ đầu tiên, Chú Tư dẫn đi giới thiệu). */
export const VENDOR_GREET: Record<VendorId, string> = {
  thit: 'Chào con! Cần thịt tươi cứ ghé cô nha!',
  bot: 'Ờ chào cháu! Trứng gà ta, bánh mì nóng giòn nè!',
  rau: 'Chào con nghen! Hành, rau dì mới hái sáng nay!',
  nuoc: 'Chào chủ quán mới! Trà, cà phê, đá chú có đủ hết!',
};

/** Chủ quán chào lại người bán. */
export function ownerGreet(v: VendorId): string {
  const who = VENDOR_MAP[v].name;
  const lower = who.charAt(0).toLowerCase() + who.slice(1);
  return `Dạ con chào ${lower} ạ!`;
}

/** Chú Tư giới thiệu người bán (câu cố định, có giọng đọc). */
export function vendorIntro(v: VendorId): string {
  const x = VENDOR_MAP[v];
  const goods = x.items
    .slice(0, 4)
    .map((i) => INGREDIENTS[i].emoji)
    .join(' ');
  return `Đây là ${x.name}, bán ${goods}. ${x.name} ơi, chủ quán mới của phố mình nè!`;
}

// ---------- Kho & giỏ ----------

/** Sức chứa kho (số phần): gốc 300, mỗi cấp Tủ lạnh +150. */
export const stockCapacity = (s: GameState) => 300 + 150 * s.upgrades.fridge;
export const stockUnits = (s: GameState) => s.stock.filter((b) => b.expiresOnDay >= s.day).reduce((n, b) => n + b.qty, 0);

export type Basket = Partial<Record<IngredientId, number>>;

export function basketTotal(s: GameState, basket: Basket) {
  let cost = 0;
  let units = 0;
  for (const [id, q] of Object.entries(basket) as [IngredientId, number][]) {
    if (!q) continue;
    cost += vendorPrice(s, id).final * q;
    units += q;
  }
  return { cost, units };
}

/** Trả tiền cả giỏ. Trả về lỗi (chuỗi) hoặc null khi xong. Mua xong tăng thân thiết theo số tiền. */
export function checkout(s: GameState, basket: Basket): string | null {
  const { cost, units } = basketTotal(s, basket);
  if (units === 0) return 'Giỏ đang trống';
  if (stockUnits(s) + units > stockCapacity(s)) return `Kho không đủ chỗ (còn ${stockCapacity(s) - stockUnits(s)} chỗ)`;
  if (cost > s.money) return 'Không đủ tiền';
  const spent: Partial<Record<VendorId, number>> = {};
  for (const [id, q] of Object.entries(basket) as [IngredientId, number][]) {
    if (!q) continue;
    const unit = vendorPrice(s, id).final;
    if (!buy(s, id, q, unit)) return `Không mua được ${INGREDIENTS[id].name}`;
    const v = vendorOf(id).id;
    spent[v] = (spent[v] ?? 0) + unit * q;
  }
  for (const [v, money] of Object.entries(spent) as [VendorId, number][]) {
    const st = vendorState(s, v);
    st.friendship = Math.min(100, st.friendship + money / 15_000);
  }
  return null;
}

/**
 * Giỏ gợi ý "Mua theo menu": đủ nguyên liệu cho khoảng một ngày bán các món trong menu
 * (theo số khách hôm qua), trừ đồ còn trong kho; giới hạn theo tiền và sức chứa.
 */
export function suggestBasket(s: GameState, portions?: number): Basket {
  const n = portions ?? Math.max(10, Math.min(40, Math.round((s.history.at(-1)?.served ?? 6) * 1.6 + 4)));
  const need: Partial<Record<IngredientId, number>> = {};
  const menu = s.unlockedRecipes.map((id) => RECIPES[id]).filter(Boolean);
  const mains = menu.filter((r) => !r.drink);
  const drinks = menu.filter((r) => r.drink);
  const add = (r: (typeof menu)[number], k: number) => {
    for (const [ing, q] of Object.entries(r.ingredients)) need[ing as IngredientId] = (need[ing as IngredientId] ?? 0) + (q as number) * k;
  };
  mains.forEach((r) => add(r, n / Math.max(1, mains.length)));
  drinks.forEach((r) => add(r, (n * 0.6) / Math.max(1, drinks.length)));
  const basket: Basket = {};
  let money = s.money;
  let room = stockCapacity(s) - stockUnits(s);
  for (const [id, q] of Object.entries(need) as [IngredientId, number][]) {
    if (s.mods.unavailable.includes(id)) continue;
    let want = Math.max(0, Math.ceil(q) - usableQty(s, id));
    const unit = vendorPrice(s, id).final;
    want = Math.min(want, room, Math.floor(money / unit));
    if (want > 0) {
      basket[id] = want;
      room -= want;
      money -= want * unit;
    }
  }
  return basket;
}
