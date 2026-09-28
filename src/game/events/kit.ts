import { INGREDIENTS } from '../data';
import { changeRep, clamp, formatMoney, menuRecipes, pick, takeStock } from '../helpers';
import { addXp } from '../progression';
import { startTrend } from '../trend';
import type { Buff, GameState, IngredientId, Rng } from '../types';
import type { Ctx, EventDef, MiniParams, MiniType } from './types';

/**
 * Bộ hiệu ứng để viết tình huống ngắn gọn. Mỗi hiệu ứng vừa đổi trạng thái vừa (nếu cần) ghi một dòng
 * vào thẻ kết quả. Các con số tiền / sao / độ sạch… được tự tính từ chênh lệch trước – sau (index.ts).
 */
export type Fx = (s: GameState, rng: Rng) => void;

// ---------- Ghi lại câu chuyện + dòng kết quả trong lúc áp dụng một lựa chọn ----------
let story: string[] = [];
let extra: string[] = [];
/** Câu kết hài hiện to ở thẻ kết quả. */
export function say(text: string) {
  story.push(text);
}
/** Dòng kết quả không phải con số (buff nhiều ngày, hẹn ngày sau…). */
export function line(text: string) {
  if (!extra.includes(text)) extra.push(text);
}
export function beginCapture() {
  story = [];
  extra = [];
}
export function endCapture(): { say: string; lines: string[] } {
  const out = { say: story.join(' '), lines: [...extra] };
  story = [];
  extra = [];
  return out;
}

const times = (x: number) => `×${x.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}`;
const span = (days: number) => (days > 1 ? `${days} ngày` : 'hôm nay');

function addBuff(s: GameState, b: Omit<Buff, 'from' | 'until'>, days: number) {
  if (days <= 1) return;
  s.buffs = s.buffs ?? [];
  s.buffs.push({ ...b, from: s.day + 1, until: s.day + days - 1 });
}

// ---------- Hiệu ứng ----------
export const all =
  (...fxs: Fx[]): Fx =>
  (s, rng) =>
    fxs.forEach((f) => f(s, rng));
/** Không có gì xảy ra. */
export const none: Fx = () => {};
export const tell =
  (text: string): Fx =>
  () =>
    say(text);
/** May rủi: xác suất `p` ra `win`, còn lại `lose`. */
export const chance =
  (p: number, win: Fx, lose: Fx): Fx =>
  (s, rng) =>
    (rng() < p ? win : lose)(s, rng);

export const money =
  (n: number): Fx =>
  (s) => {
    s.money += n;
    if (n < 0) s.report.otherCosts += -n;
    else s.report.revenue += n;
  };
export const rep =
  (d: number): Fx =>
  (s) =>
    changeRep(s, d);
export const clean =
  (d: number): Fx =>
  (s) => {
    s.cleanliness = clamp(s.cleanliness + d, 0, 100);
  };
export const mood =
  (d: number): Fx =>
  (s) => {
    for (const st of s.staff) st.mood = clamp(st.mood + d, 0, 100);
    if (s.staff.length) line(d >= 0 ? '😊 Nhân viên vui hơn' : '😒 Nhân viên buồn');
  };
export const xp =
  (n: number): Fx =>
  (s) =>
    addXp(s, n);
export const tickets =
  (n: number): Fx =>
  (s) => {
    s.tickets += n;
  };
export const stars =
  (n: number): Fx =>
  (s) => {
    s.hopeStars += n;
  };
export const debt =
  (n: number): Fx =>
  (s) => {
    s.debt = Math.max(0, s.debt + n);
  };
export const dueDay =
  (d: number): Fx =>
  (s) => {
    s.debtDueDay += d;
  };
/** Thêm / mất nguyên liệu (n > 0 thêm lô mới, n < 0 lấy bớt từ kho). */
export const stock =
  (id: IngredientId, n: number): Fx =>
  (s) => {
    if (n > 0) s.stock.push({ ingredientId: id, qty: n, expiresOnDay: s.day + INGREDIENTS[id].shelfLife - 1 });
    else takeStock(s, id, -n);
  };
/** Mất một phần mọi thứ trong kho. */
export const stockLoss =
  (pct: number): Fx =>
  (s) => {
    s.stock = s.stock.map((b) => ({ ...b, qty: Math.floor(b.qty * (1 - pct)) })).filter((b) => b.qty > 0);
  };
/** Lượng khách ×x trong `days` ngày (tính cả hôm nay). */
export const crowd =
  (x: number, days = 1): Fx =>
  (s) => {
    s.mods.spawnMult *= x;
    addBuff(s, { id: 'crowd', label: `👥 ${times(x)}`, spawnMult: x }, days);
    line(`👥 Khách ${times(x)} (${span(days)})`);
  };
/** Giá bán ×x trong `days` ngày. */
export const sell =
  (x: number, days = 1): Fx =>
  (s) => {
    s.mods.sellPriceMult *= x;
    addBuff(s, { id: 'sell', label: `💲 ${times(x)}`, sellMult: x }, days);
    line(`💲 Giá bán ${times(x)} (${span(days)})`);
  };
export const delivery =
  (x: number, days = 1): Fx =>
  (s) => {
    s.mods.deliveryMult *= x;
    addBuff(s, { id: 'delivery', label: `🛵 ${times(x)}`, deliveryMult: x }, days);
    line(`🛵 Đơn giao ${times(x)} (${span(days)})`);
  };
/** Bàn tạm mất (n < 0) / thêm (n > 0) trong `days` ngày. */
export const seats =
  (n: number, days = 1): Fx =>
  (s) => {
    s.mods.seatDelta = (s.mods.seatDelta ?? 0) + n;
    addBuff(s, { id: 'seats', label: `🪑 ${n > 0 ? '+' : ''}${n}`, seatDelta: n }, days);
    line(`🪑 ${n > 0 ? '+' : ''}${n} bàn (${span(days)})`);
  };
/** Doanh thu ± tỉ lệ lúc đóng cửa trong `days` ngày (xe đẩy +0.1, nhà đầu tư −0.1). */
export const revenue =
  (pct: number, days: number, why: string): Fx =>
  (s) => {
    s.mods.revenueBonus = (s.mods.revenueBonus ?? 0) + pct;
    addBuff(s, { id: 'revenue', label: why, revenueBonus: pct }, days);
    line(`${pct > 0 ? '📈' : '📉'} ${why}: doanh thu ${pct > 0 ? '+' : ''}${Math.round(pct * 100)}% (${span(days)})`);
  };
/** Tiền mặt bằng × `mult` trong `days` ngày. */
export const rent =
  (mult: number, days: number): Fx =>
  (s) => {
    s.mods.rentMult = (s.mods.rentMult ?? 1) * mult;
    addBuff(s, { id: 'rent', label: `🏠 ${times(mult)}`, rentMult: mult }, days);
    line(`🏠 Tiền nhà ${times(mult)} (${span(days)})`);
  };
/** Mất tiền mỗi sáng trong `days` ngày (tính từ mai). */
export const dailyCost =
  (amount: number, days: number, why: string): Fx =>
  (s) => {
    s.buffs = s.buffs ?? [];
    s.buffs.push({ id: 'cost', label: why, from: s.day + 1, until: s.day + days, dailyCost: amount });
    line(`💸 ${why}: −${formatMoney(amount)}/ngày (${days} ngày)`);
  };
/** Bếp dừng `ms` (trong giờ bán); buổi sáng thì mở cửa bếp trễ. */
export const stove =
  (ms: number): Fx =>
  (s) => {
    if (s.run) s.run.powerOutUntil = Math.max(s.run.powerOutUntil, s.run.elapsed) + ms;
    else s.mods.stoveDelay = (s.mods.stoveDelay ?? 0) + ms;
    line(`⏳ Bếp dừng ${Math.round(ms / 1000)} giây`);
  };
/** Khách đang chờ kiên nhẫn × `mult`. */
export const patience =
  (mult: number): Fx =>
  (s) => {
    for (const c of s.run?.customers ?? []) c.patience = Math.min(c.maxPatience, c.patience * mult);
  };
/** Thêm khách ngay (trong giờ bán); buổi sáng thì thành khách đông hơn hôm nay. */
export const guests =
  (n: number): Fx =>
  (s, rng) => {
    if (!s.run) {
      s.mods.spawnMult *= 1 + n * 0.04;
      line(`👥 +${n} khách hôm nay`);
      return;
    }
    const n2 = spawnHook?.(s, rng, n) ?? 0;
    if (n2) line(`👥 +${n2} bàn khách`);
  };
/** Đơn lớn `qty` phần một món trong menu. */
export const bigOrder =
  (qty: number): Fx =>
  (s, rng) => {
    const mains = menuRecipes(s).filter((r) => !r.drink);
    if (!mains.length || !s.run) return;
    const r = pick(rng, mains);
    orderHook?.(s, rng, r.id, qty);
    line(`📦 Đơn ${qty} phần ${r.emoji} ${r.name}`);
  };
/** Món đặc biệt (hoặc một món trong menu) thành trend. */
export const trend = (): Fx => (s, rng) => {
  const menu = menuRecipes(s).filter((r) => !r.drink);
  const id = s.missions?.special ?? (menu.length ? pick(rng, menu).id : null);
  if (!id) return;
  startTrend(s, id, 'viral');
  line('🔥 Món của quán thành trend!');
};
/** Tay nghề mọi nhân viên + d (0..100). */
export const skill =
  (d: number): Fx =>
  (s) => {
    for (const st of s.staff) st.skill = clamp(st.skill + d, 0, 100);
    if (s.staff.length) line('📚 Tay nghề nhân viên tăng');
  };
/** Một nhân viên nghỉ hôm nay. */
export const staffOff = (): Fx => (s) => {
  const st = s.staff.find((x) => !x.absent);
  if (!st) return;
  st.absent = true;
  st.task = null;
  line(`🏖️ ${st.name} nghỉ hôm nay`);
};
/** Mất `pct` tiền mặt, tối đa `cap`, không làm tiền âm. */
export const cashLoss =
  (pct: number, cap: number): Fx =>
  (s) => {
    const amount = Math.min(cap, Math.floor((Math.max(0, s.money) * pct) / 1000) * 1000);
    s.money -= amount;
    s.report.otherCosts += amount;
  };
/** Có thêm tiền mỗi sáng trong `days` ngày (tính từ mai). */
export const dailyIncome =
  (amount: number, days: number, why: string): Fx =>
  (s) => {
    s.buffs = s.buffs ?? [];
    s.buffs.push({ id: 'income', label: why, from: s.day + 1, until: s.day + days, dailyIncome: amount });
    line(`💵 ${why}: +${formatMoney(amount)}/ngày (${days} ngày)`);
  };
/** Bỏ cờ (vd khoá bị phá, gà bay mất). */
export const unflag =
  (id: string): Fx =>
  (s) => {
    if (s.flags) delete s.flags[id];
  };
/** Ghi nhớ lựa chọn (cờ). */
export const flag =
  (id: string): Fx =>
  (s) => {
    s.flags = s.flags ?? {};
    s.flags[id] = s.day;
  };
/** Hậu quả hẹn `days` ngày sau: chạy hàm nối tiếp `key` (đăng ký bằng `follow`). */
export const later =
  (days: number, key: string, hint = 'Còn chuyện sau…'): Fx =>
  (s) => {
    s.pending = s.pending ?? [];
    s.pending.push({ day: s.day + days, key });
    line(`📅 ${hint}`);
  };
/** Nghỉ sớm (đóng cửa luôn). */
export const closeNow = (): Fx => (s) => {
  closeHook?.(s);
};

// ---------- Móc vào engine (gán trong engine.ts, tránh vòng import) ----------
let spawnHook: ((s: GameState, rng: Rng, n: number) => number) | null = null;
let orderHook: ((s: GameState, rng: Rng, recipeId: string, qty: number) => void) | null = null;
let closeHook: ((s: GameState) => void) | null = null;
export function setEngineHooks(h: { spawn: typeof spawnHook; order: typeof orderHook; close: typeof closeHook }) {
  spawnHook = h.spawn;
  orderHook = h.order;
  closeHook = h.close;
}

// ---------- Hậu quả hẹn ngày ----------
export const FOLLOW: Record<string, Fx> = {};
/** Đăng ký hàm nối tiếp (chạy vào sáng ngày hẹn); câu `say` được Chú Tư báo. */
export function follow(key: string, fx: Fx): string {
  FOLLOW[key] = fx;
  return key;
}

// ---------- Viết tình huống gọn ----------
export interface FunChoice {
  label: string;
  /** Chỉ bấm được khi đúng (vd đủ tiền). */
  enabled?: (s: GameState) => boolean;
  fx?: Fx;
  say?: string;
  /** Chọn cái này thì chơi mini game; điểm ≥ 0.6 là thắng. */
  game?: { type: MiniType; params?: MiniParams; win: Fx; lose: Fx; winSay: string; loseSay: string };
}

export interface FunEvent {
  id: string;
  phase: 'morning' | 'day';
  emoji: string;
  title: string;
  body: string | ((s: GameState, ctx: Ctx) => string);
  weight?: number;
  when?: (s: GameState) => boolean;
  setup?: (s: GameState, rng: Rng) => Ctx | null;
  choices: FunChoice[];
}

export const WIN_SCORE = 0.6;

export function fun(e: FunEvent): EventDef {
  return {
    id: e.id,
    phase: e.phase,
    emoji: e.emoji,
    title: e.title,
    weight: e.weight ?? 3,
    when: e.when,
    setup: e.setup,
    body: (ctx, s) => (typeof e.body === 'function' ? e.body(s, ctx) : e.body),
    choices: e.choices.map((c) => ({
      label: c.label,
      enabled: c.enabled ? (s: GameState) => c.enabled!(s) : undefined,
      mini: c.game ? { type: c.game.type, params: c.game.params } : undefined,
      apply: (s: GameState, _ctx: Ctx, rng: Rng, score?: number) => {
        if (c.game) {
          const win = (score ?? 0) >= WIN_SCORE;
          say(win ? c.game.winSay : c.game.loseSay);
          (win ? c.game.win : c.game.lose)(s, rng);
          return;
        }
        if (c.say) say(c.say);
        c.fx?.(s, rng);
      },
    })),
  };
}

// Tiện dụng cho điều kiện xuất hiện.
export const hasStaff = (s: GameState) => s.staff.some((st) => !st.absent);
export const fromDay = (d: number) => (s: GameState) => s.day >= d;
export const noFlag = (id: string) => (s: GameState) => !s.flags?.[id];
export const hasMoney = (n: number) => (s: GameState) => s.money >= n;
/** Tên một nhân viên đang làm, không có thì Chú Tư. */
export const helper = (s: GameState) => s.staff.find((st) => !st.absent)?.name ?? 'Chú Tư';
