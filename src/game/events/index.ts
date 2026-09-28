import { formatMoney, note } from '../helpers';
import type { GameState, Rng } from '../types';
import { CLASSIC } from './classic';
import { FUN_EVENTS } from './fun';
import { FOLLOW, beginCapture, endCapture } from './kit';
import type { EventDef } from './types';

export type { EventChoice, EventDef, MiniSpec, MiniType } from './types';

/** Mọi tình huống (cũ + mới) trộn chung một kho. */
export const EVENTS: EventDef[] = [...CLASSIC, ...FUN_EVENTS];
export const EVENT_MAP: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** Không lặp lại một tình huống trong chừng này ngày. */
export const NO_REPEAT_DAYS = 10;

/** Chọn và khởi tạo một sự kiện ngẫu nhiên cho giai đoạn cho trước. */
export function rollEvent(s: GameState, phase: 'morning' | 'day', rng: Rng, exclude: string[] = []) {
  const seen = s.eventSeen ?? {};
  const pool = EVENTS.filter(
    (e) => e.phase === phase && !exclude.includes(e.id) && !(seen[e.id] !== undefined && s.day - seen[e.id] < NO_REPEAT_DAYS) && (!e.when || e.when(s))
  );
  // Thử vài lần vì có sự kiện không phù hợp hoàn cảnh (setup trả null).
  for (let attempt = 0; attempt < 8 && pool.length; attempt += 1) {
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    let r = rng() * total;
    let chosen = pool[0];
    for (const e of pool) {
      r -= e.weight;
      if (r <= 0) {
        chosen = e;
        break;
      }
    }
    const ctx = chosen.setup ? chosen.setup(s, rng) : {};
    if (ctx) {
      s.activeEvent = { defId: chosen.id, ctx };
      s.eventSeen = { ...seen, [chosen.id]: s.day };
      return chosen;
    }
    pool.splice(pool.indexOf(chosen), 1);
  }
  return null;
}

/** Ảnh chụp các chỉ số để tự viết dòng kết quả (💰 ★ 🧽 🎟️ ⭐ 📦 💳 📅 🎖️). */
function snapshot(s: GameState) {
  return {
    money: s.money,
    rep: s.reputation,
    clean: s.cleanliness,
    tickets: s.tickets,
    stars: s.hopeStars,
    debt: s.debt,
    due: s.debtDueDay,
    xp: s.xp,
    stock: s.stock.reduce((n, b) => n + b.qty, 0),
    staff: s.staff.length,
  };
}

const signed = (n: number, digits = 0) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('vi-VN', { maximumFractionDigits: digits })}`;

function diffLines(a: ReturnType<typeof snapshot>, b: ReturnType<typeof snapshot>): string[] {
  const out: string[] = [];
  if (b.money !== a.money) out.push(`💰 ${b.money > a.money ? '+' : '−'}${formatMoney(Math.abs(b.money - a.money))}`);
  if (Math.abs(b.rep - a.rep) >= 0.005) out.push(`★ Danh tiếng ${signed(b.rep - a.rep, 2)}`);
  if (Math.round(b.clean) !== Math.round(a.clean)) out.push(`🧽 Độ sạch ${signed(Math.round(b.clean - a.clean))}%`);
  if (b.tickets !== a.tickets) out.push(`🎟️ Vé ${signed(b.tickets - a.tickets)}`);
  if (b.stars !== a.stars) out.push(`⭐ Sao hy vọng ${signed(b.stars - a.stars)}`);
  if (b.stock !== a.stock) out.push(`📦 Kho ${signed(b.stock - a.stock)} phần`);
  if (b.debt !== a.debt) out.push(`💳 Nợ ${b.debt > a.debt ? '+' : '−'}${formatMoney(Math.abs(b.debt - a.debt))}`);
  if (b.due !== a.due) out.push(`📅 Hạn trả nợ ${signed(b.due - a.due)} ngày`);
  if (b.xp !== a.xp) out.push(`🎖️ ${signed(b.xp - a.xp)} XP`);
  if (b.staff < a.staff) out.push(`👋 Mất ${a.staff - b.staff} nhân viên`);
  return out;
}

/**
 * Áp dụng lựa chọn: `score` (0..1) nếu lựa chọn là mini game. Sau đó hiện thẻ kết quả
 * (câu kết + các dòng thay đổi) — đồng hồ dừng tới khi bấm OK.
 */
export function resolveEvent(s: GameState, choiceIndex: number, rng: Rng, score?: number) {
  const ev = s.activeEvent;
  if (!ev) return;
  const def = EVENT_MAP[ev.defId];
  const choice = def?.choices[choiceIndex];
  if (def && choice?.enabled && !choice.enabled(s, ev.ctx)) return;
  s.activeEvent = null;
  if (!def || !choice) return;
  const before = snapshot(s);
  beginCapture();
  choice.apply(s, ev.ctx, rng, score);
  const cap = endCapture();
  if (choice.mini && score !== undefined) {
    s.miniBest = s.miniBest ?? {};
    s.miniBest[choice.mini.type] = Math.max(s.miniBest[choice.mini.type] ?? 0, score);
  }
  const lines = [...diffLines(before, snapshot(s)), ...cap.lines];
  s.eventResult = { emoji: def.emoji, title: def.title, say: cap.say || `Đã chọn: ${choice.label}`, lines };
  note(s, `${def.emoji} ${def.title}: ${choice.label}${cap.say ? ` — ${cap.say}` : ''}`);
}

/** Buổi sáng: áp hiệu ứng nhiều ngày (buff) vào `mods`, bỏ buff hết hạn; trừ tiền mỗi ngày. */
export function applyBuffs(s: GameState) {
  s.buffs = (s.buffs ?? []).filter((b) => b.until >= s.day);
  for (const b of s.buffs) {
    if (b.from > s.day) continue;
    if (b.spawnMult) s.mods.spawnMult *= b.spawnMult;
    if (b.sellMult) s.mods.sellPriceMult *= b.sellMult;
    if (b.deliveryMult) s.mods.deliveryMult *= b.deliveryMult;
    if (b.seatDelta) s.mods.seatDelta = (s.mods.seatDelta ?? 0) + b.seatDelta;
    if (b.revenueBonus) s.mods.revenueBonus = (s.mods.revenueBonus ?? 0) + b.revenueBonus;
    if (b.rentMult) s.mods.rentMult = (s.mods.rentMult ?? 1) * b.rentMult;
    if (b.dailyCost) {
      s.money -= b.dailyCost;
      s.report.otherCosts += b.dailyCost;
    }
    if (b.dailyIncome) {
      s.money += b.dailyIncome;
      s.report.revenue += b.dailyIncome;
    }
    if (b.label) s.mods.labels.push(b.label);
  }
  // Vật nuôi / linh vật từ tình huống.
  if (s.flags?.parrot) s.mods.spawnMult *= 1.05;
  if (s.flags?.frog) s.mods.spawnMult *= 1.03;
}

/** Buổi sáng: chạy các hậu quả hẹn tới hôm nay; câu chuyện được Chú Tư báo. */
export function runPending(s: GameState, rng: Rng) {
  const due = (s.pending ?? []).filter((p) => p.day <= s.day);
  s.pending = (s.pending ?? []).filter((p) => p.day > s.day);
  for (const p of due) {
    const fx = FOLLOW[p.key];
    if (!fx) continue;
    const before = snapshot(s);
    beginCapture();
    fx(s, rng);
    const cap = endCapture();
    const lines = [...diffLines(before, snapshot(s)), ...cap.lines];
    if (cap.say || lines.length) s.chefQueue.push({ kind: 'news', text: `📅 ${cap.say}${lines.length ? ` (${lines.join(', ')})` : ''}`.trim() });
  }
}

/** Có tình huống buổi sáng không (từ ngày 3, khoảng 50%). */
export function morningEventChance(s: GameState): number {
  return s.day < 3 ? 0 : 0.5;
}

/** Tối đa bao nhiêu tình huống trong giờ bán một ngày. */
export function maxDayEvents(s: GameState): number {
  return s.day <= 2 ? 0 : s.day === 3 ? 1 : 2;
}

