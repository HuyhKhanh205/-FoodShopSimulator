/** Đặt chip tên sạp + bong bóng rao hàng trên màn hình sao cho không đè nhau (hàm thuần, kiểm thử được). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CHIP_W = 118;
export const CHIP_H = 36;
export const CALL_W = 130;
export const CALL_H = 34;
const GAP = 4;
const STEP = 14;

export function overlaps(a: Rect, b: Rect, gap = GAP): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

const clampX = (r: Rect, w: number): Rect => ({ ...r, x: Math.max(2, Math.min(w - r.w - 2, r.x)) });

/** Các độ lệch thử (px), gần trước xa sau: lên / xuống trước, rồi lệch ngang. */
const OFFSETS: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let dx = 0; dx <= 8; dx += 1) for (let dy = -10; dy <= 10; dy += 1) out.push([dx * 22, dy * STEP], [-dx * 22, dy * STEP]);
  return out.sort((a, b) => Math.hypot(a[0], a[1] * 1.6) - Math.hypot(b[0], b[1] * 1.6));
})();

/** Chỗ trống gần `base` nhất (không đè `placed`, nằm trong màn); không có thì trả `base`. */
function findFree(base: Rect, placed: Rect[], w: number, h: number, preferUp = false, top = 0): Rect | null {
  const inside = (r: Rect) => r.x >= 2 && r.x + r.w <= w - 2 && r.y >= top + 2 && r.y + r.h <= h - 2;
  const order = preferUp ? [...OFFSETS].sort((a, b) => (a[1] <= 0 ? 0 : 1) - (b[1] <= 0 ? 0 : 1) || Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1])) : OFFSETS;
  for (const [dx, dy] of order) {
    const r = { ...base, x: base.x + dx, y: base.y + dy };
    if (inside(r) && !placed.some((p) => overlaps(p, r))) return r;
  }
  return null;
}

/**
 * `chips`: tâm dưới các chip tên sạp (theo điểm chiếu mái sạp); `call`: tâm dưới bong bóng (đầu người bán) hoặc null.
 * Mỗi nhãn tìm chỗ trống gần vị trí gốc nhất (ưu tiên dời lên / xuống, rồi lệch ngang) — không bao giờ đè nhau.
 */
export function placeLabels(chips: { x: number; y: number }[], call: { x: number; y: number } | null, w: number, fullH: number, top = 0, bottom = 0) {
  // Chỉ đặt nhãn trong vùng không bị lớp nổi (HUD trên, cụm nút dưới) che.
  const h = fullH - bottom;
  const placed: Rect[] = [];
  for (const c of chips) {
    const base = clampX({ x: c.x - CHIP_W / 2, y: Math.max(top + 2, Math.min(h - CHIP_H - 2, c.y - CHIP_H)), w: CHIP_W, h: CHIP_H }, w);
    placed.push(findFree(base, placed, w, h, false, top) ?? base);
  }
  let bubble: Rect | null = null;
  if (call) {
    const base = clampX({ x: call.x - CALL_W / 2, y: Math.max(top + 2, Math.min(h - CALL_H - 2, call.y - CALL_H - 6)), w: CALL_W, h: CALL_H }, w);
    bubble = findFree(base, placed, w, h, true, top);
  }
  return { chips: placed, bubble };
}
