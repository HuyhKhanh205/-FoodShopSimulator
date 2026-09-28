import type { MapLayout, Tile } from './layout';

/**
 * Khu phố nối 5 nơi (ra cửa quán là tới): lưới 32 × 7 ô.
 * Hàng 0–3: mặt tiền các nơi (không đi vào được, chạm cửa là vào); hàng 4–6: vỉa hè đi bộ.
 * Phía nam (z ≥ 7) là đường có xe chạy, bên kia đường là bờ sông — chỉ để ngắm.
 */
export const STREET_COLS = 32;
export const STREET_ROWS = 7;
/** Hàng vỉa hè ngay trước cửa. */
export const DOOR_ROW = 4;

export type StreetPlaceId = 'shop' | 'market' | 'uncle' | 'tools' | 'bank';

export interface StreetPlace {
  id: StreetPlaceId;
  emoji: string;
  name: string;
  /** Mặt tiền chiếm các cột x0..x1 (hàng 0–3). */
  x0: number;
  x1: number;
  /** Cột có cửa. */
  door: number;
  /** Việc làm khi vào (chữ ngắn trên chip). */
  verb: string;
}

export const STREET_PLACES: StreetPlace[] = [
  { id: 'shop', emoji: '🍜', name: 'Quán mình', x0: 1, x1: 5, door: 3, verb: 'Về quán' },
  { id: 'market', emoji: '🛒', name: 'Chợ', x0: 7, x1: 12, door: 9, verb: 'Đi chợ' },
  { id: 'uncle', emoji: '🏠', name: 'Nhà Chú Tư', x0: 14, x1: 18, door: 16, verb: 'Thử món' },
  { id: 'tools', emoji: '🏪', name: 'Tiệm đồ quán', x0: 20, x1: 24, door: 22, verb: 'Nâng cấp' },
  { id: 'bank', emoji: '🏦', name: 'Ngân hàng', x0: 26, x1: 30, door: 28, verb: 'Trả nợ' },
];

/** Ô đứng trước cửa một nơi. */
export function doorTile(id: StreetPlaceId): Tile {
  const p = STREET_PLACES.find((x) => x.id === id)!;
  return { x: p.door, y: DOOR_ROW };
}

/** Cây / đèn trên mép vỉa hè giữa các nơi (không đi qua được). */
export const STREET_TREES: Tile[] = [6, 13, 19, 25, 31].map((x) => ({ x, y: 6 }));

const key = (x: number, y: number) => `${x},${y}`;

/** Bản đồ đi bộ của khu phố (dùng chung tìm đường BFS với quán / chợ). */
export function buildStreetLayout(from: StreetPlaceId = 'shop'): MapLayout {
  const blocked = new Set<string>();
  for (let y = 0; y < DOOR_ROW; y += 1) for (let x = 0; x < STREET_COLS; x += 1) blocked.add(key(x, y));
  for (const t of STREET_TREES) blocked.add(key(t.x, t.y));
  const start = doorTile(from);
  return { stations: [], blocked, restSpot: start, start, cols: STREET_COLS, rows: STREET_ROWS };
}

/** Nơi có mặt tiền ở cột x (chạm vào nhà → đi tới cửa nhà đó). */
export function placeAt(x: number, y: number): StreetPlace | undefined {
  if (y >= DOOR_ROW) return undefined;
  return STREET_PLACES.find((p) => x >= p.x0 && x <= p.x1);
}
