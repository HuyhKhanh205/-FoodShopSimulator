import { MAP_COLS } from '../../game/layout';
import type { MapLayout, Tile } from '../../game/layout';
import type { VendorId } from '../../game/market';

/** Sạp trên bản đồ chợ (12 × 10 ô): sông ở trên, lối đi lát gạch ở giữa, 2 sạp mỗi bên. */
export interface Stall {
  id: VendorId;
  x: number;
  y: number;
  /** Hướng quay mặt ra lối đi: +1 (sang phải) hoặc −1 (sang trái). */
  face: 1 | -1;
  access: Tile[];
}
// Sạp sát hai mép, hai sạp cùng bên cách nhau 4 hàng → chữ tên sạp và câu rao không đè nhau.
export const STALLS: Stall[] = [
  { id: 'thit', x: 0, y: 3, face: 1, access: [{ x: 2, y: 3 }, { x: 2, y: 4 }] },
  { id: 'bot', x: 0, y: 7, face: 1, access: [{ x: 2, y: 7 }, { x: 2, y: 8 }] },
  { id: 'rau', x: 10, y: 3, face: -1, access: [{ x: 9, y: 3 }, { x: 9, y: 4 }] },
  { id: 'nuoc', x: 10, y: 7, face: -1, access: [{ x: 9, y: 7 }, { x: 9, y: 8 }] },
];
export const RIVER_ROWS = 3;
export const PALMS: [number, number, string][] = [
  [0, 5, 'n_tree_palm'],
  [11, 5, 'n_tree_palmbend'],
  [0, 9, 'n_tree_palmshort'],
  [11, 9, 'n_tree_palm'],
  [5, 3, 'n_tree_palmshort'],
];
const key = (x: number, y: number) => `${x},${y}`;
/** Tên sạp ngắn cho chip: "Sạp thịt & tôm" → "Thịt & tôm", "Tạp hoá đồ uống" → "Đồ uống". */
export const shortName = (stall: string) => {
  const s = stall.replace(/^Sạp /, '').replace(/^Tạp hoá /, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function buildMarketLayout(): MapLayout {
  const blocked = new Set<string>();
  for (let y = 0; y < RIVER_ROWS; y += 1) for (let x = 0; x < MAP_COLS; x += 1) blocked.add(key(x, y));
  for (const s of STALLS) for (let dx = 0; dx < 2; dx += 1) for (let dy = 0; dy < 2; dy += 1) blocked.add(key(s.x + dx, s.y + dy));
  for (const [x, y] of PALMS) blocked.add(key(x, y));
  return { stations: [], blocked, restSpot: { x: 6, y: 9 }, start: { x: 6, y: 9 } };
}

