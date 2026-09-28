import { INGREDIENTS, PREP_BATCH, RECIPES } from './data';
import { clamp, formatMoney, pick } from './helpers';
import { levelOf, unlockedIngredients } from './progression';
import type { DayReport, DayTally, DiaryEntry, DiaryMood, GameState, IngredientId, Mission, MissionKind, MissionTier, RecipeId, Rng } from './types';

/** Phần thưởng gốc theo mức: chỉ nhiệm vụ khó mới cho ⭐ sao hy vọng. */
export const TIER_REWARD: Record<MissionTier, Mission['reward']> = {
  easy: { money: 5_000, tickets: 1, stars: 0 },
  medium: { money: 15_000, tickets: 2, stars: 0 },
  hard: { money: 30_000, tickets: 3, stars: 1 },
};
/** Nhiệm vụ khó có từ ngày này. */
export const HARD_FROM_DAY = 3;
/** Nhiệm vụ chỉ chốt được lúc tổng kết (phải hết ngày mới biết). */
const END_OF_DAY: MissionKind[] = ['noLost', 'profit'];
export const DIARY_MAX = 60;
export const DIARY_TEXT_MAX = 300;
export const MOODS: DiaryMood[] = ['😄', '🙂', '😐', '😢', '😡'];
export const STICKERS = ['🍜', '🎉', '⭐', '💪', '🌧️', '☀️', '😋', '💸', '🔥', '❤️'];

export const emptyTally = (): DayTally => ({ prepped: 0, cooked: 0, newDishes: 0, specialServed: 0, fiveStars: 0 });

const profitOf = (r: DayReport) => r.revenue + r.tips - (r.ingredientCost + r.wages + r.rent + r.utilities + r.fines + r.otherCosts);

/** Trung bình bàn phục vụ / lãi mấy ngày gần đây (để co giãn mục tiêu). */
function recent(s: GameState) {
  const h = s.history.slice(-3);
  const served = h.length ? h.reduce((a, r) => a + r.served, 0) / h.length : 6;
  const profit = h.length ? h.reduce((a, r) => a + profitOf(r), 0) / h.length : 0;
  return { served, profit };
}

function make(s: GameState, kind: MissionKind, tier: MissionTier, target: number, extra: Partial<Mission> = {}): Mission {
  const base = TIER_REWARD[tier];
  const x2 = kind === 'special' ? 2 : 1;
  return {
    id: `m${s.day}_${kind}`,
    kind,
    tier,
    target: Math.max(1, Math.round(target)),
    reward: { money: base.money * x2, tickets: base.tickets * x2, stars: base.stars },
    claimed: false,
    ...extra,
  };
}

/** Nguyên liệu dùng trong menu hôm nay (đã mở, không bị hết hàng). */
function menuIngredients(s: GameState): IngredientId[] {
  const open = new Set(unlockedIngredients(s));
  const ids = new Set<IngredientId>();
  for (const id of s.unlockedRecipes) {
    for (const i of Object.keys(RECIPES[id]?.ingredients ?? {}) as IngredientId[]) if (open.has(i) && !s.mods.unavailable.includes(i)) ids.add(i);
  }
  return [...ids];
}

/** Món đặc biệt hôm nay: ưu tiên món ăn trong menu. */
export function pickSpecial(s: GameState, rng: Rng): RecipeId | null {
  const menu = s.unlockedRecipes.filter((id) => RECIPES[id]);
  if (!menu.length) return null;
  const food = menu.filter((id) => !RECIPES[id].drink);
  return pick(rng, food.length ? food : menu);
}

/**
 * Nhiệm vụ buổi sáng: 3 nhiệm vụ thường (dễ / vừa), từ ngày 3 thêm 1 nhiệm vụ khó có ⭐.
 * Ngày 1 cố định theo hướng dẫn: mua trứng, sơ chế hành, phục vụ 3 bàn.
 */
export function rollMissions(s: GameState, rng: Rng) {
  const special = s.day === 1 ? 'banh_mi_trung' : pickSpecial(s, rng);
  if (s.day === 1) {
    s.missions = {
      day: 1,
      special,
      list: [
        make(s, 'buy', 'easy', 1, { ingredientId: 'trung' }),
        make(s, 'prep', 'easy', PREP_BATCH, { ingredientId: 'hanh' }),
        make(s, 'serve', 'medium', 3),
      ],
    };
    return;
  }
  const { served, profit } = recent(s);
  const ings = menuIngredients(s);
  const prepIngs = ings.filter((i) => INGREDIENTS[i].needsPrep);

  const easy: Mission[] = [];
  if (ings.length) easy.push(make(s, 'buy', 'easy', 4 + Math.floor(rng() * 3) * 2, { ingredientId: pick(rng, ings) }));
  if (prepIngs.length) easy.push(make(s, 'prep', 'easy', PREP_BATCH * (served >= 12 ? 3 : 2)));
  easy.push(make(s, 'cook', 'easy', clamp(Math.round(served * 0.8), 4, 30)));

  const medium: Mission[] = [make(s, 'serve', 'medium', clamp(Math.round(served * 0.9), 4, 40))];
  if (special) medium.push(make(s, 'special', 'medium', clamp(Math.round(served / 5), 2, 6), { recipeId: special }));
  if (levelOf(s.xp) >= 2) medium.push(make(s, 'newDish', 'medium', 1));

  const takeOne = (arr: Mission[]) => arr.splice(Math.floor(rng() * arr.length), 1)[0];
  const list = [takeOne(easy), takeOne(medium)];
  const rest = [...easy, ...medium];
  if (rest.length) list.push(takeOne(rest));

  if (s.day >= HARD_FROM_DAY) {
    const hard = [
      make(s, 'noLost', 'hard', clamp(Math.round(served * 0.8), 6, 30)),
      make(s, 'profit', 'hard', Math.max(50_000, Math.round((Math.max(0, profit) * 1.15) / 10_000) * 10_000)),
      make(s, 'stars', 'hard', clamp(Math.round(served / 5), 2, 6)),
    ];
    list.push(takeOne(hard));
  }
  s.missions = { day: s.day, special, list };
}

export interface MissionProgress {
  value: number;
  target: number;
  done: boolean;
  /** Không thể xong nữa trong hôm nay (vd: đã có bàn bỏ về). */
  failed: boolean;
}

/** Tiến độ tính từ báo cáo ngày / bộ đếm — không lưu riêng. */
export function missionProgress(s: GameState, m: Mission): MissionProgress {
  const r = s.report;
  const t = s.today;
  const value = (() => {
    switch (m.kind) {
      case 'buy':
        return m.ingredientId ? s.boughtToday?.[m.ingredientId]?.qty ?? 0 : 0;
      case 'prep':
        return t.prepped;
      case 'cook':
        return t.cooked;
      case 'serve':
        return r.served;
      case 'special':
        return t.specialServed;
      case 'newDish':
        return t.newDishes;
      case 'noLost':
        return r.served;
      case 'profit':
        return profitOf(r);
      case 'stars':
        return t.fiveStars;
    }
  })();
  const failed = m.kind === 'noLost' && r.lost > 0;
  const reached = value >= m.target && !failed;
  const done = reached && (!END_OF_DAY.includes(m.kind) || s.phase === 'summary');
  return { value, target: m.target, done, failed };
}

/** Nhiệm vụ còn dùng được (đúng ngày). */
export function todayMissions(s: GameState): Mission[] {
  return s.missions?.day === s.day ? s.missions.list : [];
}

export function claimableCount(s: GameState): number {
  return todayMissions(s).filter((m) => !m.claimed && missionProgress(s, m).done).length;
}

/** Nhận thưởng: cộng tiền, 🎟️ vé, ⭐ sao. Trả về phần thưởng (null nếu chưa xong / đã nhận). */
export function claimMission(s: GameState, id: string): Mission['reward'] | null {
  const m = todayMissions(s).find((x) => x.id === id);
  if (!m || m.claimed || !missionProgress(s, m).done) return null;
  m.claimed = true;
  s.money += m.reward.money;
  s.tickets += m.reward.tickets;
  s.hopeStars += m.reward.stars;
  return m.reward;
}

/** Sang ngày mới: nhiệm vụ đã xong mà quên nhận thì tự nhận. Trả về số nhiệm vụ được nhận. */
export function autoClaimAll(s: GameState): number {
  let n = 0;
  for (const m of todayMissions(s)) if (claimMission(s, m.id)) n += 1;
  // Hết ngày 1 thì sổ tay chưa mở: nhận âm thầm, sáng ngày 2 Chú Tư giới thiệu sổ tay luôn.
  if (n > 0 && s.day > 1) s.chefQueue.push({ kind: 'autoClaim' });
  return n;
}

/** Câu mô tả nhiệm vụ. */
export function missionText(m: Mission): { icon: string; text: string } {
  const ing = m.ingredientId ? INGREDIENTS[m.ingredientId] : null;
  const rec = m.recipeId ? RECIPES[m.recipeId] : null;
  switch (m.kind) {
    case 'buy':
      return { icon: '🛒', text: `Mua ${m.target} ${ing?.emoji ?? ''} ${ing?.name.toLowerCase() ?? 'nguyên liệu'} ở chợ` };
    case 'prep':
      return { icon: '🔪', text: `Sơ chế ${m.target} phần${ing ? ` ${ing.emoji} ${ing.name.toLowerCase()}` : ' nguyên liệu'}` };
    case 'cook':
      return { icon: '🍳', text: `Nấu ${m.target} món` };
    case 'serve':
      return { icon: '🍽️', text: `Phục vụ ${m.target} bàn` };
    case 'special':
      return { icon: '🌟', text: `Bán ${m.target} phần ${rec ? `${rec.emoji} ${rec.name}` : 'món đặc biệt'}` };
    case 'newDish':
      return { icon: '🧪', text: 'Thử 1 công thức mới ở 📖 Sổ món' };
    case 'noLost':
      return { icon: '🛡️', text: `Phục vụ ${m.target} bàn, không bàn nào bỏ về` };
    case 'profit':
      return { icon: '💰', text: `Lãi ít nhất ${formatMoney(m.target)} hôm nay` };
    case 'stars':
      return { icon: '⭐', text: `Nhận ${m.target} đánh giá 5★` };
  }
}

/** Dòng phần thưởng: "💰 5.000đ · 🎟️ 1 · ⭐ 1". */
export function rewardText(r: Mission['reward']): string {
  return [`💰 ${formatMoney(r.money)}`, r.tickets ? `🎟️ ${r.tickets}` : '', r.stars ? `⭐ ${r.stars}` : ''].filter(Boolean).join(' · ');
}

// ================= Nhật ký =================

/** Dòng tóm tắt tự sinh cho trang nhật ký của một ngày. */
export function diarySummary(s: GameState, day: number): string {
  const r = s.history.find((x) => x.day === day);
  if (!r) return day === s.day && s.phase !== 'summary' ? 'Ngày mới bắt đầu, chưa mở cửa.' : '';
  const p = profitOf(r);
  const parts = [`Phục vụ ${r.served} bàn`, `${p >= 0 ? 'lãi' : 'lỗ'} ${formatMoney(Math.abs(p))}`];
  if (s.missions?.day === day) {
    if (s.missions.special && s.today.specialServed > 0) parts.push(`🌟 bán ${s.today.specialServed} phần`);
    const done = s.missions.list.filter((m) => m.claimed || missionProgress(s, m).done).length;
    parts.push(`${done}/${s.missions.list.length} nhiệm vụ ✓`);
  }
  return parts.join(' · ');
}

/**
 * Viết trang nhật ký hôm nay (viết lại thì ghi đè). Lần đầu mỗi ngày được +1 🎟️.
 * Trả về true nếu là trang mới (được vé).
 */
export function writeDiary(s: GameState, mood: DiaryMood, text: string, stickers: string[] = []): boolean {
  const entry: DiaryEntry = {
    day: s.day,
    mood: MOODS.includes(mood) ? mood : '🙂',
    text: text.slice(0, DIARY_TEXT_MAX),
    summary: diarySummary(s, s.day),
    stickers: stickers.filter((x) => STICKERS.includes(x)).slice(0, 5),
  };
  const i = s.diary.findIndex((d) => d.day === s.day);
  if (i >= 0) {
    s.diary[i] = entry;
    return false;
  }
  s.diary.push(entry);
  while (s.diary.length > DIARY_MAX) s.diary.shift();
  s.tickets += 1;
  return true;
}
