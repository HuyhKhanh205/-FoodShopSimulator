import { DAY_MS, RECIPES } from './data';
import { log } from './helpers';
import type { GameState, RecipeId, TrendSource } from './types';

/** Trend kéo dài 3 ngày, độ hot giảm dần đều từ 100% về 0. */
export const TREND_DAYS = 3;

/** Thời gian liên tục tính bằng ngày (ngày 1 lúc mở cửa = 0). */
export function nowDays(s: GameState): number {
  return s.day - 1 + (s.phase === 'open' && s.run ? s.run.elapsed / DAY_MS : s.phase === 'summary' ? 1 : 0);
}

/** Độ hot 0..1 của trend (hoặc của một món cụ thể). */
export function trendHeat(s: GameState, id?: RecipeId): number {
  const t = s.trend;
  if (!t || (id !== undefined && id !== t.recipeId)) return 0;
  return Math.max(0, Math.min(1, 1 - (nowDays(s) - t.start) / TREND_DAYS));
}

export const TREND_SOURCE_LABEL: Record<TrendSource, string> = {
  viral: 'Khách quay clip lên mạng',
  reviewer: 'Food reviewer khen hết lời',
  launch: 'Món mới ra mắt gây sốt',
};

/** Bắt đầu trend (thay trend cũ). */
export function startTrend(s: GameState, id: RecipeId, source: TrendSource) {
  if (!RECIPES[id]) return;
  s.trend = { recipeId: id, start: nowDays(s), source };
  s.chefQueue.push({ kind: 'trend', recipeId: id, source });
  log(s, `🔥 ${RECIPES[id].emoji} ${RECIPES[id].name} thành TREND! (${TREND_SOURCE_LABEL[source]})`, 'good');
}

/** Giá bán món trend +20% (giảm dần theo độ hot). */
export const trendPriceMult = (s: GameState, id: RecipeId) => 1 + 0.2 * trendHeat(s, id);
/** Danh tiếng cộng thêm từ món trend +20%. */
export const trendRepMult = (s: GameState, id: RecipeId) => 1 + 0.2 * trendHeat(s, id);
/** Lượng khách +150% khi đang có trend. */
export const trendSpawnMult = (s: GameState) => 1 + 1.5 * trendHeat(s);

/** Trọng số khách chọn món: món trend × (1 + 3·hot), món mới ra mắt × 3 trong ngày bán đầu tiên. */
export function orderWeight(s: GameState, id: RecipeId): number {
  const launch = s.launched?.[id] === s.day ? 3 : 1;
  return (1 + 3 * trendHeat(s, id)) * launch;
}

/** Hết hot thì xoá trend. */
export function expireTrend(s: GameState) {
  if (s.trend && trendHeat(s) <= 0) s.trend = null;
}
