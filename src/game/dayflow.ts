import { INGREDIENTS, RECIPES } from './data';
import { usableQty } from './helpers';
import { claimableCount } from './missions';
import { shows } from './unlocks';
import type { GameState, IngredientId } from './types';

/**
 * Đường sông (thiết kế 1b): tiến trình một ngày Chợ nổi → Sơ chế → Nấu ăn → Phục vụ → Tổng kết.
 * Ba bến giữa là một vòng lặp trong giờ bán: bến "ĐANG" là việc cần làm nhất lúc này.
 */
export type StageId = 'market' | 'prep' | 'cook' | 'serve' | 'summary';
export type StageStatus = 'done' | 'current' | 'todo';

export const STAGES: { id: StageId; icon: string; label: string; say: string }[] = [
  { id: 'market', icon: '🛶', label: 'Chợ nổi', say: 'Ra chợ mua đồ theo menu, rồi bấm 🏮 Mở cửa nha!' },
  { id: 'prep', icon: '🔪', label: 'Sơ chế', say: 'Đồ có dấu dao phải thái trước. Vào thớt sơ chế sẵn cho nhanh nè!' },
  { id: 'cook', icon: '🍳', label: 'Nấu ăn', say: 'Khách đang chờ! Vào bếp bỏ nguyên liệu vô nồi rồi nấu liền.' },
  { id: 'serve', icon: '🍽️', label: 'Phục vụ', say: 'Món chín rồi! Cầm món mang ra đúng bàn khách nha.' },
  { id: 'summary', icon: '🌙', label: 'Tổng kết', say: 'Hết ngày rồi! Nhận thưởng nhiệm vụ, viết nhật ký rồi sang ngày mới.' },
];

/** Câu gợi ý tổng kết khi chưa có sổ tay (ngày 1). */
export const SUMMARY_FIRST_SAY = 'Hết ngày rồi! Xem quán lời bao nhiêu, rồi bấm ☀️ Ngày mới nha.';

/** Câu Chú Tư đọc cho một bến (tổng kết ngày 1 không nhắc tới sổ tay chưa mở). */
export function stageSay(s: GameState, id: StageId): string {
  if (id === 'summary' && !shows(s, 'notebook')) return SUMMARY_FIRST_SAY;
  return STAGES.find((x) => x.id === id)?.say ?? '';
}

export interface FlowNext {
  label: string;
  /** Chỗ cần chỉ vào (dùng chung cơ chế viền vàng của hướng dẫn). */
  target: string | null;
  /** Trong quán: trạm cần đi tới (id trạm trên sơ đồ, hoặc 'table' = bàn đang chờ món trên tay). */
  station?: string;
}

export interface DayFlow {
  stages: { id: StageId; icon: string; label: string; status: StageStatus }[];
  current: StageId;
  next: FlowNext;
}

/** Nguyên liệu phải sơ chế của các món trong menu mà kho còn. */
function prepNeeded(s: GameState): IngredientId[] {
  const ids = new Set<IngredientId>();
  for (const id of s.unlockedRecipes) {
    for (const i of Object.keys(RECIPES[id]?.ingredients ?? {}) as IngredientId[]) if (INGREDIENTS[i].needsPrep) ids.add(i);
  }
  return [...ids].filter((i) => usableQty(s, i) > 0);
}

/** Món nấu được từ kho (chưa tính sơ chế): có ít nhất 1 món đủ `n` phần. */
function menuStocked(s: GameState, n: number): boolean {
  return s.unlockedRecipes.some((id) => {
    const r = RECIPES[id];
    return r && (Object.entries(r.ingredients) as [IngredientId, number][]).every(([i, q]) => usableQty(s, i) >= q * n);
  });
}

function currentStage(s: GameState): { current: StageId; next: FlowNext } {
  if (s.phase === 'summary') {
    // Sổ tay chưa mở (ngày 1): chỉ gợi ý sang ngày mới; thưởng hôm nay tự nhận sáng mai.
    if (!shows(s, 'notebook')) return { current: 'summary', next: { label: '☀️ Ngày mới', target: 'summary.next' } };
    if (claimableCount(s) > 0) return { current: 'summary', next: { label: '🎁 Nhận thưởng', target: 'summary.missions' } };
    if (!s.diary.some((d) => d.day === s.day)) return { current: 'summary', next: { label: '✍️ Viết nhật ký', target: 'summary.diary' } };
    return { current: 'summary', next: { label: '☀️ Ngày mới', target: 'summary.next' } };
  }
  const run = s.run;
  if (s.phase === 'market' || !run) {
    return menuStocked(s, 3)
      ? { current: 'market', next: { label: '🏮 Mở cửa', target: 'market.open' } }
      : { current: 'market', next: { label: '🧾 Mua theo menu', target: 'market.pay' } };
  }
  if (run.ownerAway) return { current: 'market', next: { label: '🏃 Về quán', target: 'market.back' } };

  // Có món chín (trên tay / ở quầy ra món) → mang cho khách.
  const ready = run.pass.some((d) => d.quality !== 'burnt' && !d.sendTo && !run.carrying.includes(d.id));
  if (run.carrying.length > 0) {
    const held = new Set(run.pass.filter((d) => run.carrying.includes(d.id)).map((d) => d.recipeId));
    const c = run.customers.find((x) => x.tableIndex !== undefined && x.items.some((i) => !i.served && held.has(i.recipeId)));
    return { current: 'serve', next: { label: c ? `🍽️ Mang cho bàn ${c.tableIndex! + 1}` : '🍽️ Mang món ra bàn', target: 'shop.table', station: 'table' } };
  }
  // Món mình nấu đã chín trên bếp → lấy ra.
  const mine = run.slots.find((sl) => sl.job?.by === 'player');
  if (mine?.job && mine.job.progress >= mine.job.cookTime) return { current: 'serve', next: { label: '📤 Vào bếp gửi món', target: 'shop.board', station: mine.id } };
  if (ready) return { current: 'serve', next: { label: '📤 Vào bếp gửi món', target: 'shop.board', station: 'board' } };
  if (mine) return { current: 'cook', next: { label: '🍳 Canh bếp', target: 'shop.board', station: mine.id } };
  if (run.playerPrep) return { current: 'prep', next: { label: '🔪 Đang sơ chế', target: 'shop.board', station: 'board' } };
  // Khách đang chờ món mà thiếu đồ sơ chế → sơ chế; đủ thì nấu.
  const waiting = run.customers.some((c) => c.items.some((i) => !i.served));
  const needs = prepNeeded(s);
  const noPrepped = needs.length > 0 && needs.every((i) => (run.prepped[i] ?? 0) <= 0);
  if (noPrepped) {
    const i = needs.find((x) => (run.prepped[x] ?? 0) <= 0)!;
    return { current: 'prep', next: { label: `🔪 Thái ${INGREDIENTS[i].emoji} ${INGREDIENTS[i].name.toLowerCase()}`, target: 'shop.board', station: 'board' } };
  }
  if (waiting) {
    const item = run.customers.flatMap((c) => c.items).find((i) => !i.served && RECIPES[i.recipeId]);
    return { current: 'cook', next: { label: item ? `🍳 Nấu ${RECIPES[item.recipeId].emoji} ${RECIPES[item.recipeId].name}` : '🍳 Nấu cho khách', target: 'shop.board', station: 'stove0' } };
  }
  return { current: 'serve', next: { label: '👀 Chờ khách tới', target: null } };
}

export function dayFlow(s: GameState): DayFlow {
  const { current, next } = currentStage(s);
  const done: Record<StageId, boolean> = {
    market: s.phase !== 'market' && !s.run?.ownerAway,
    prep: s.today.prepped > 0,
    cook: s.today.cooked > 0,
    serve: s.report.served > 0,
    summary: false,
  };
  return {
    current,
    next,
    stages: STAGES.map((st) => ({ id: st.id, icon: st.icon, label: st.label, status: st.id === current ? 'current' : done[st.id] ? 'done' : 'todo' })),
  };
}
