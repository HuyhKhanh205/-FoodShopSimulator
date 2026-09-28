import { UPGRADES } from './data';
import type { Upgrades } from './types';

/** Bố cục quán cho chế độ bản đồ (nhìn từ trên xuống), đơn vị: ô lưới. */
export const MAP_COLS = 12;
export const MAP_ROWS = 10;
/** Hàng ranh giới giữa bếp (phía trên) và phòng ăn (phía dưới). */
export const PASS_ROW = 4;
/** Quầy ra món: ô bắt đầu và độ dài. */
export const PASS_X = 4;
export const PASS_W = 3;
/** Vị trí đĩa thứ i trên quầy ra món (so với tâm quầy): 2 hàng, mỗi hàng 5 đĩa. */
export function passDishOffset(i: number, w: number): [number, number] {
  return [-w / 2 + 0.3 + (i % 5) * 0.6, i < 5 ? -0.17 : 0.17];
}

export type StationKind = 'stove' | 'counter' | 'fridge' | 'board' | 'trash' | 'mop' | 'pass' | 'table' | 'door';

export type Tile = { x: number; y: number };

export interface MapStation {
  id: string;
  kind: StationKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Các ô đứng cạnh để thao tác. */
  access: Tile[];
  /** Đã mua (bếp/quầy/bàn chưa nâng cấp thì hiện mờ, không dùng được). */
  active: boolean;
  slotId?: string;
  tableIndex?: number;
}

/** Ô đặt đồ trang trí (xem `Decor` trong KayProps.tsx). */
export const DECOR_TILES: [number, number][] = [
  [0, 1],
  [5, 1],
  [8, 1],
  [11, 1],
  [0, 9],
  [11, 5],
  [11, 6],
];

export interface MapLayout {
  stations: MapStation[];
  blocked: Set<string>;
  /** Chỗ đứng của nhân viên khi rảnh. */
  restSpot: Tile;
  start: Tile;
}

const key = (x: number, y: number) => `${x},${y}`;
const maxLevel = (k: keyof Upgrades) => {
  const levels = UPGRADES.find((u) => u.key === k)!.levels;
  return levels[levels.length - 1];
};

export function buildLayout(upgrades: Upgrades): MapLayout {
  const stations: MapStation[] = [];
  const add = (st: Omit<MapStation, 'w' | 'h'> & { w?: number; h?: number }) => stations.push({ w: 1, h: 1, ...st });

  for (let i = 0; i < maxLevel('stoves'); i += 1) {
    add({ id: `stove${i}`, kind: 'stove', x: 1 + i, y: 1, access: [{ x: 1 + i, y: 2 }], active: i < upgrades.stoves, slotId: `stove${i}` });
  }
  for (let i = 0; i < maxLevel('counters'); i += 1) {
    add({ id: `counter${i}`, kind: 'counter', x: 6 + i, y: 1, access: [{ x: 6 + i, y: 2 }], active: i < upgrades.counters, slotId: `counter${i}` });
  }
  add({ id: 'fridge', kind: 'fridge', x: 9, y: 1, access: [{ x: 9, y: 2 }], active: true });
  add({ id: 'board', kind: 'board', x: 10, y: 1, access: [{ x: 10, y: 2 }], active: true });
  add({ id: 'trash', kind: 'trash', x: 0, y: 3, access: [{ x: 1, y: 3 }, { x: 0, y: 2 }], active: true });
  add({ id: 'mop', kind: 'mop', x: 11, y: 3, access: [{ x: 10, y: 3 }, { x: 11, y: 2 }], active: true });

  // Quầy ra món ngắn (3 ô, giữa quán) để bếp và phòng ăn thông thoáng, có lối đi hai bên.
  const passAccess: Tile[] = [];
  for (let x = PASS_X; x < PASS_X + PASS_W; x += 1) passAccess.push({ x, y: PASS_ROW - 1 }, { x, y: PASS_ROW + 1 });
  add({ id: 'pass', kind: 'pass', x: PASS_X, y: PASS_ROW, w: PASS_W, access: passAccess, active: true });

  for (let i = 0; i < maxLevel('seats'); i += 1) {
    const x = 1 + 2 * (i % 5);
    const y = i < 5 ? 6 : 8;
    add({
      id: `table${i}`,
      kind: 'table',
      x,
      y,
      access: [
        { x, y: y - 1 },
        { x, y: y + 1 },
        { x: x - 1, y },
        { x: x + 1, y },
      ],
      active: i < upgrades.seats,
      tableIndex: i,
    });
  }
  add({ id: 'door', kind: 'door', x: 11, y: 9, access: [{ x: 10, y: 9 }, { x: 11, y: 8 }], active: true });

  const blocked = new Set<string>();
  for (let x = 0; x < MAP_COLS; x += 1) blocked.add(key(x, 0));
  // Ô có đồ trang trí (thùng rau thịt, quầy gia vị, cây cảnh, đèn cây) — không đi qua được.
  for (const [x, y] of DECOR_TILES) blocked.add(key(x, y));
  for (const st of stations) {
    for (let dx = 0; dx < st.w; dx += 1) for (let dy = 0; dy < st.h; dy += 1) blocked.add(key(st.x + dx, st.y + dy));
  }
  return { stations, blocked, restSpot: { x: 11, y: 2 }, start: { x: 5, y: 3 } };
}

export function isWalkable(layout: MapLayout, x: number, y: number) {
  return x >= 0 && y >= 0 && x < MAP_COLS && y < MAP_ROWS && !layout.blocked.has(key(x, y));
}

/** Tìm đường ngắn nhất (BFS, 4 hướng) tới một trong các ô đích. Trả về các ô đi qua (không gồm ô xuất phát), null nếu không tới được. */
export function findPath(layout: MapLayout, from: Tile, targets: Tile[]): Tile[] | null {
  const goals = new Set(targets.filter((t) => isWalkable(layout, t.x, t.y)).map((t) => key(t.x, t.y)));
  if (goals.size === 0) return null;
  if (goals.has(key(from.x, from.y))) return [];
  const prev = new Map<string, string | null>([[key(from.x, from.y), null]]);
  const queue: Tile[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const k = key(nx, ny);
      if (prev.has(k) || !isWalkable(layout, nx, ny)) continue;
      prev.set(k, key(cur.x, cur.y));
      if (goals.has(k)) {
        const path: Tile[] = [];
        let at: string | null = k;
        while (at && at !== key(from.x, from.y)) {
          const [px, py] = at.split(',').map(Number);
          path.unshift({ x: px, y: py });
          at = prev.get(at) ?? null;
        }
        return path;
      }
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

/** Đồ vật mà ô (x, y) đứng cạnh để thao tác; ưu tiên đồ vật theo hướng đang nhìn. */
export function stationNextTo(layout: MapLayout, x: number, y: number, facing?: Tile): MapStation | null {
  const candidates = layout.stations.filter((st) => st.access.some((a) => a.x === x && a.y === y));
  if (candidates.length === 0) return null;
  if (facing) {
    const fx = x + facing.x;
    const fy = y + facing.y;
    const faced = candidates.find((st) => fx >= st.x && fx < st.x + st.w && fy >= st.y && fy < st.y + st.h);
    if (faced) return faced;
  }
  return candidates[0];
}

/** Ô bấm vào thuộc đồ vật nào. */
export function stationAt(layout: MapLayout, x: number, y: number): MapStation | null {
  return layout.stations.find((st) => x >= st.x && x < st.x + st.w && y >= st.y && y < st.y + st.h) ?? null;
}
