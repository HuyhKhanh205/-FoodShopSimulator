import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated } from 'react-native';
import type { Tile } from '../../game/layout';

/** Tốc độ đi của chủ quán (ô / giây). */
const SPEED = 6;

export interface WalkerState {
  /** Vị trí hiện tại (đơn vị ô, có thể lẻ khi đang đi). */
  x: number;
  y: number;
  /** Hướng nhìn: vector ô (-1/0/1). */
  facing: Tile;
  moving: boolean;
}

/**
 * Di chuyển chủ quán theo đường đi từng ô bằng requestAnimationFrame.
 * Vị trí nằm trong ref (cảnh 3D đọc mỗi khung hình), đồng thời cập nhật `anim` cho bản đồ 2D.
 */
export function useWalker(start: Tile) {
  const state = useRef<WalkerState>({ x: start.x, y: start.y, facing: { x: 0, y: -1 }, moving: false });
  const anim = useRef(new Animated.ValueXY(start)).current;
  const job = useRef<{ path: Tile[]; i: number; onDone: () => void } | null>(null);
  const raf = useRef<number | null>(null);
  const last = useRef(0);

  const loop = useCallback(
    (t: number) => {
      const s = state.current;
      const dt = last.current ? Math.min(0.05, (t - last.current) / 1000) : 1 / 60;
      last.current = t;
      let move = SPEED * dt;
      while (move > 0 && job.current) {
        const j = job.current;
        const target = j.path[j.i];
        const dx = target.x - s.x;
        const dy = target.y - s.y;
        const d = Math.hypot(dx, dy);
        if (d > 1e-4) s.facing = { x: Math.sign(Math.round(dx * 10)), y: Math.sign(Math.round(dy * 10)) };
        if (d <= move) {
          s.x = target.x;
          s.y = target.y;
          move -= d;
          j.i += 1;
          if (j.i >= j.path.length) {
            job.current = null;
            s.moving = false;
            anim.setValue({ x: s.x, y: s.y });
            j.onDone();
          }
        } else {
          s.x += (dx / d) * move;
          s.y += (dy / d) * move;
          move = 0;
        }
      }
      s.moving = Boolean(job.current);
      anim.setValue({ x: s.x, y: s.y });
      if (job.current) {
        raf.current = requestAnimationFrame(loop);
      } else {
        raf.current = null;
        last.current = 0;
      }
    },
    [anim]
  );

  /** Ô đang đứng (làm tròn khi đang đi giữa hai ô). */
  const origin = useCallback((): Tile => ({ x: Math.round(state.current.x), y: Math.round(state.current.y) }), []);

  /** Ô sẽ đứng khi đi hết đường hiện tại (để phím bấm liên tiếp nối tiếp nhau). */
  const dest = useCallback((): Tile => {
    const j = job.current;
    return j ? j.path[j.path.length - 1] : origin();
  }, [origin]);

  const walk = useCallback(
    (path: Tile[], onDone: () => void) => {
      if (path.length === 0) {
        job.current = null;
        state.current.moving = false;
        onDone();
        return;
      }
      job.current = { path, i: 0, onDone };
      state.current.moving = true;
      if (raf.current === null) raf.current = requestAnimationFrame(loop);
    },
    [loop]
  );

  const face = useCallback((dir: Tile) => {
    state.current.facing = dir;
  }, []);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    []
  );

  return useMemo(() => ({ state, anim, walk, origin, dest, face }), [anim, walk, origin, dest, face]);
}
