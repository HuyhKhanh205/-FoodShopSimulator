/**
 * Ẩn vật ở xa kiểu Farm Together (thuần, không phụ thuộc three để kiểm thử được).
 * Phong cảnh chia thành khối vuông CHUNK ô; khối ngoài bán kính nhìn R quanh tâm nhìn thì ẩn.
 */
export const CHUNK = 6;

export interface ChunkInfo {
  key: string;
  /** Tâm khối (toạ độ thế giới x, z). */
  x: number;
  z: number;
  /** Bán kính bao quanh các vật trong khối. */
  r: number;
}

/** Gom vật theo khối CHUNK × CHUNK; trả tâm + bán kính mỗi khối và vị trí vật tương đối với tâm khối. */
export function chunkify<T extends { x: number; z: number }>(items: T[]): { info: ChunkInfo; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = `${Math.floor(it.x / CHUNK)},${Math.floor(it.z / CHUNK)}`;
    const list = map.get(k) ?? [];
    list.push(it);
    map.set(k, list);
  }
  return [...map.entries()].map(([key, list]) => {
    const [cx, cz] = key.split(',').map(Number);
    const x = (cx + 0.5) * CHUNK;
    const z = (cz + 0.5) * CHUNK;
    const r = Math.max(CHUNK * 0.71, ...list.map((it) => Math.hypot(it.x - x, it.z - z) + 1.5));
    return { info: { key, x, z, r }, items: list };
  });
}

/** Khối có nằm trong tầm nhìn (bán kính R quanh tâm nhìn) không. */
export function chunkVisible(focus: { x: number; z: number }, c: ChunkInfo, R: number): boolean {
  return Math.hypot(c.x - focus.x, c.z - focus.z) - c.r < R;
}

/**
 * Bán kính nhìn trên mặt đất cho camera trực giao nhìn xuống góc `elevation`:
 * nửa đường chéo khung nhìn (chiều dọc giãn ra 1/sin), cộng lề; máy yếu thì nhỏ lại.
 */
export function viewRadius(halfW: number, halfH: number, elevation: number, saver = false): number {
  const r = Math.hypot(halfW, halfH / Math.sin(elevation)) + 3;
  return saver ? r * 0.75 : r;
}
