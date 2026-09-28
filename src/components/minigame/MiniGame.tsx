import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MINI_INFO, QUIZ } from '../../game/events/mini';
import type { MiniParams, MiniSpec } from '../../game/events/types';
import { colors } from '../ui';

/**
 * Mini game ngắn (5–15 giây) trong tình huống. Vẽ bằng emoji + View, chạy mọi chế độ.
 * Đếm ngược 3-2-1 (kèm cách chơi) → chơi → hiện điểm → `onDone(score 0..1)`. "Bỏ qua" = 0 điểm.
 */
export default function MiniGame({ spec, onDone }: { spec: MiniSpec; onDone: (score: number) => void }) {
  const { width, height } = useWindowDimensions();
  const w = Math.min(width - 24, 400);
  const h = Math.min(Math.max(height * 0.55, 300), 440);
  const info = MINI_INFO[spec.type];
  const [count, setCount] = useState(3);
  const [score, setScore] = useState<number | null>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (count <= 0) return;
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [count]);

  const finish = (sc: number) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const v = Math.max(0, Math.min(1, Number.isFinite(sc) ? sc : 0));
    setScore(v);
    setTimeout(() => onDoneRef.current(v), 1000);
  };

  const p = spec.params ?? {};
  const Game = GAMES[spec.type];
  return (
    <View style={styles.wrap} accessibilityLabel={`Mini game ${info.name}`}>
      <View style={styles.head}>
        <Text style={styles.title}>
          {info.emoji} {info.name}
        </Text>
        {score === null && (
          <Pressable onPress={() => finish(0)} style={styles.skip} accessibilityRole="button" accessibilityLabel="Bỏ qua">
            <Text style={styles.skipText}>Bỏ qua</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.prompt}>{p.prompt ?? info.hint}</Text>
      <View style={[styles.area, { width: w, height: h }]}>
        {score !== null ? (
          <View style={styles.center}>
            <Text style={styles.big}>{score >= 0.6 ? '🎉' : '😅'}</Text>
            <Text style={styles.scoreText}>{score >= 0.6 ? 'Giỏi lắm!' : 'Tiếc quá!'}</Text>
            <Text style={styles.scoreSub}>{Math.round(score * 100)} điểm</Text>
          </View>
        ) : count > 0 ? (
          <View style={styles.center}>
            <Text style={styles.count}>{count}</Text>
            <Text style={styles.scoreSub}>{info.hint}</Text>
          </View>
        ) : (
          <Game p={p} w={w} h={h} finish={finish} />
        )}
      </View>
    </View>
  );
}

type GameProps = { p: MiniParams; w: number; h: number; finish: (score: number) => void };

// ---------- Tiện ích ----------
const noop = () => {};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const rint = (n: number) => Math.floor(Math.random() * n);
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = rint(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Gọi `cb(dt, t)` mỗi khung hình (ms). */
function useFrame(cb: (dt: number, t: number) => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    let last = start;
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(64, now - last);
      last = now;
      ref.current(dt, now - start);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

/** Đồng hồ đếm lùi: trả phần còn lại 0..1, hết giờ gọi `onEnd`. */
function useClock(seconds: number, onEnd: () => void, running = true) {
  const total = seconds * 1000;
  const [left, setLeft] = useState(total);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const fired = useRef(false);
  const runRef = useRef(running);
  runRef.current = running;
  useFrame((dt) => {
    if (runRef.current && !fired.current) setLeft((l) => Math.max(0, l - dt));
  });
  useEffect(() => {
    if (left <= 0 && !fired.current) {
      fired.current = true;
      endRef.current();
    }
  }, [left]);
  return left / total;
}

/** Phím trên máy tính (Space, mũi tên, D F J K). */
function useKeys(cb: (key: string, down: boolean) => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const down = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat) ref.current(e.key, true);
    };
    const up = (e: KeyboardEvent) => ref.current(e.key, false);
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    return () => {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
    };
  }, []);
}

function TimeBar({ frac }: { frac: number }) {
  return (
    <View style={styles.timeBar}>
      <View style={[styles.timeFill, { width: `${Math.max(0, frac) * 100}%`, backgroundColor: frac < 0.25 ? colors.bad : colors.primary }]} />
    </View>
  );
}

function Hud({ frac, text }: { frac: number; text: string }) {
  return (
    <View style={styles.hud}>
      <TimeBar frac={frac} />
      <Text style={styles.hudText}>{text}</Text>
    </View>
  );
}

// ---------- 1. tap: chạm liên tục ----------
function Tap({ p, finish }: GameProps) {
  const need = p.need ?? 20;
  const [n, setN] = useState(0);
  const nRef = useRef(0);
  const hit = () => {
    nRef.current += 1;
    setN(nRef.current);
    if (nRef.current >= need) finish(1);
  };
  const frac = useClock(p.seconds ?? 6, () => finish(nRef.current / need));
  useKeys((k, d) => d && k === ' ' && hit());
  return (
    <View style={styles.fill}>
      <Hud frac={frac} text={`${n} / ${need}`} />
      <View style={styles.center}>
        <Pressable onPressIn={hit} onPress={noop} style={styles.tapBtn} accessibilityRole="button" accessibilityLabel="Chạm">
          <Text style={[styles.huge, { transform: [{ scale: n % 2 ? 1.12 : 1 }] }]}>{p.emoji ?? '👆'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------- 2. catch: chạm trúng mục tiêu nhảy / rơi ----------
type Target = { id: number; x: number; y: number; vy: number; born: number };
const T_SIZE = 64;
function Catch({ p, w, h, finish }: GameProps) {
  const need = p.need ?? 6;
  const fall = !!p.fall;
  const areaH = h - 40;
  const [targets, setTargets] = useState<Target[]>([]);
  const [got, setGot] = useState(0);
  const gotRef = useRef(0);
  const nextId = useRef(1);
  const spawnAt = useRef(0);
  const place = (t: number): Target => ({
    id: nextId.current++,
    x: rnd(0, w - T_SIZE),
    y: fall ? -T_SIZE : rnd(0, areaH - T_SIZE),
    vy: fall ? rnd(areaH * 0.35, areaH * 0.55) : 0,
    born: t,
  });
  useFrame((dt, t) => {
    setTargets((list) => {
      let next = list;
      if (fall) {
        next = list.map((o) => ({ ...o, y: o.y + (o.vy * dt) / 1000 })).filter((o) => o.y < areaH);
        if (t >= spawnAt.current) {
          spawnAt.current = t + 520;
          next = [...next, place(t)];
        }
      } else {
        const life = Math.max(550, 950 - gotRef.current * 50);
        next = list.filter((o) => t - o.born < life);
        if (!next.length) next = [place(t)];
      }
      return next;
    });
  });
  const frac = useClock(p.seconds ?? 8, () => finish(gotRef.current / need));
  const tapOn = (id: number) => {
    gotRef.current += 1;
    setGot(gotRef.current);
    setTargets((l) => l.filter((o) => o.id !== id));
    if (gotRef.current >= need) finish(1);
  };
  return (
    <View style={styles.fill}>
      <Hud frac={frac} text={`${got} / ${need}`} />
      <View style={{ flex: 1 }}>
        {targets.map((o) => (
          <Pressable key={o.id} onPressIn={() => tapOn(o.id)} onPress={noop} style={[styles.target, { left: o.x, top: o.y }]} accessibilityRole="button" accessibilityLabel="Mục tiêu">
            <Text style={styles.targetText}>{p.emoji ?? '🏃'}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------- 3. sequence: nhớ và lặp lại thứ tự ----------
const STEP_MS = 650;
function Sequence({ p, finish }: GameProps) {
  const pads = p.options ?? ['🥬', '🥩', '🧅', '🌶️'];
  const len = p.need ?? 4;
  const seq = useMemo(() => Array.from({ length: len }, () => rint(pads.length)), [len, pads.length]);
  const [t, setT] = useState(0);
  const [pos, setPos] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  useFrame((_dt, time) => setT(time));
  const showing = t < len * STEP_MS + 200;
  const lit = showing && t % STEP_MS < STEP_MS * 0.75 ? seq[Math.floor(t / STEP_MS)] : null;
  const seconds = p.seconds ?? 10;
  const inputLeft = showing ? 1 : Math.max(0, 1 - (t - len * STEP_MS - 200) / (seconds * 1000));
  useEffect(() => {
    if (!showing && inputLeft <= 0) finish(pos / len);
  }, [inputLeft, showing, pos, len, finish]);
  const press = (i: number) => {
    if (showing) return;
    setFlash(i);
    setTimeout(() => setFlash(null), 150);
    if (seq[pos] === i) {
      if (pos + 1 >= len) finish(1);
      setPos(pos + 1);
    } else finish(pos / len);
  };
  return (
    <View style={styles.fill}>
      <Hud frac={inputLeft} text={showing ? '👀 Nhìn kỹ…' : `Bấm lại: ${pos} / ${len}`} />
      <View style={styles.grid2}>
        {pads.map((e, i) => (
          <Pressable
            key={i}
            onPressIn={() => press(i)} onPress={noop}
            style={[styles.pad, (lit === i || flash === i) && styles.padLit]}
            accessibilityRole="button"
            accessibilityLabel={`Ô ${i + 1}`}
          >
            <Text style={styles.padText}>{e}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------- 4. timing: dừng vạch đúng ô xanh (3 lần) ----------
function Timing({ p, w, finish }: GameProps) {
  const tries = 3;
  const [x, setX] = useState(0);
  const phase = useRef(0);
  const [zone, setZone] = useState(() => rnd(0.25, 0.75));
  const [marks, setMarks] = useState<boolean[]>([]);
  const pauseUntil = useRef(0);
  const now = useRef(0);
  const zw = 0.2;
  useFrame((dt, t) => {
    now.current = t;
    if (t < pauseUntil.current) return;
    phase.current += (dt / 1000) * (0.9 + marks.length * 0.25);
    const ph = phase.current % 2;
    setX(1 - Math.abs(ph - 1));
  });
  const frac = useClock(p.seconds ?? 12, () => finish(marks.filter(Boolean).length / tries));
  const stop = () => {
    if (now.current < pauseUntil.current || marks.length >= tries) return;
    const hit = Math.abs(x - zone) <= zw / 2;
    const next = [...marks, hit];
    setMarks(next);
    pauseUntil.current = now.current + 450;
    if (next.length >= tries) setTimeout(() => finish(next.filter(Boolean).length / tries), 450);
    else setTimeout(() => setZone(rnd(0.2, 0.8)), 450);
  };
  useKeys((k, d) => d && k === ' ' && stop());
  const barW = w - 40;
  return (
    <View style={styles.fill}>
      <Hud frac={frac} text={`${marks.map((m) => (m ? '✅' : '❌')).join(' ')}  ${marks.length} / ${tries}`} />
      <Pressable onPressIn={stop} onPress={noop} style={styles.center} accessibilityRole="button" accessibilityLabel="Dừng">
        <Text style={styles.huge}>{p.emoji ?? '🎯'}</Text>
        <View style={[styles.track, { width: barW }]}>
          <View style={[styles.zone, { left: (zone - zw / 2) * barW, width: zw * barW }]} />
          <View style={[styles.needle, { left: x * barW - 3 }]} />
        </View>
        <Text style={styles.scoreSub}>Chạm màn hình để dừng</Text>
      </Pressable>
    </View>
  );
}

// ---------- 5. pick: chọn đúng một hình ----------
function Pick({ p, finish }: GameProps) {
  const opts = p.options ?? ['❓', '❔'];
  const order = useMemo(() => shuffle(opts.map((_, i) => i)), [opts]);
  const [chosen, setChosen] = useState<number | null>(null);
  const frac = useClock(p.seconds ?? 8, () => finish(0), chosen === null);
  const choose = (i: number) => {
    if (chosen !== null) return;
    setChosen(i);
    setTimeout(() => finish(i === (p.answer ?? 0) ? 1 : 0), 500);
  };
  return (
    <View style={styles.fill}>
      <Hud frac={frac} text="Chọn một" />
      <View style={styles.grid2}>
        {order.map((i) => (
          <Pressable
            key={i}
            onPress={() => choose(i)}
            style={[styles.pad, chosen !== null && i === (p.answer ?? 0) && styles.padOk, chosen === i && i !== (p.answer ?? 0) && styles.padBad]}
            accessibilityRole="button"
            accessibilityLabel={opts[i]}
          >
            <Text style={styles.padText} numberOfLines={2} adjustsFontSizeToFit>
              {opts[i]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------- 6. whack: đập khi thò lên ----------
function Whack({ p, finish }: GameProps) {
  const need = p.need ?? 8;
  const [up, setUp] = useState<number[]>(() => Array(6).fill(0));
  const [hits, setHits] = useState(0);
  const hitsRef = useRef(0);
  const next = useRef(300);
  const now = useRef(0);
  useFrame((_dt, t) => {
    now.current = t;
    if (t >= next.current) {
      next.current = t + rnd(450, 700);
      setUp((u) => {
        const free = u.map((v, i) => (v < t ? i : -1)).filter((i) => i >= 0);
        if (!free.length) return u;
        const c = [...u];
        c[free[rint(free.length)]] = t + rnd(700, 950);
        return c;
      });
    }
  });
  const frac = useClock(p.seconds ?? 8, () => finish(hitsRef.current / need));
  const whack = (i: number) => {
    if (up[i] < now.current) return;
    hitsRef.current += 1;
    setHits(hitsRef.current);
    setUp((u) => u.map((v, j) => (j === i ? 0 : v)));
    if (hitsRef.current >= need) finish(1);
  };
  return (
    <View style={styles.fill}>
      <Hud frac={frac} text={`${hits} / ${need}`} />
      <View style={styles.grid3}>
        {up.map((v, i) => (
          <Pressable key={i} onPressIn={() => whack(i)} onPress={noop} style={styles.hole} accessibilityRole="button" accessibilityLabel={`Lỗ ${i + 1}`}>
            <Text style={styles.padText}>{v >= now.current ? p.emoji ?? '🐀' : '🕳️'}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------- 7. balance: giữ mâm thăng bằng ----------
function Balance({ p, finish }: GameProps) {
  const seconds = p.seconds ?? 8;
  const tilt = useRef(rnd(-6, 6));
  const vel = useRef(0);
  const push = useRef(0);
  const good = useRef(0);
  const total = useRef(0);
  const [, render] = useState(0);
  useFrame((dt, t) => {
    const s = dt / 1000;
    const wind = Math.sin(t / 700) * Math.sin(t / 1300 + 1) * 35;
    const acc = tilt.current * 0.9 + wind + push.current * 120;
    vel.current = (vel.current + acc * s) * 0.985;
    tilt.current = Math.max(-45, Math.min(45, tilt.current + vel.current * s));
    if (Math.abs(tilt.current) >= 45) vel.current = 0;
    total.current += dt;
    if (Math.abs(tilt.current) < 15) good.current += dt;
    render((n) => n + 1);
  });
  const frac = useClock(seconds, () => finish(good.current / Math.max(1, total.current) / 0.85));
  useKeys((k, d) => {
    if (k === 'ArrowLeft') push.current = d ? -1 : 0;
    if (k === 'ArrowRight') push.current = d ? 1 : 0;
  });
  const ok = Math.abs(tilt.current) < 15;
  const hold = (dir: number) => ({ onPressIn: () => (push.current = dir), onPressOut: () => (push.current = 0), onPress: noop });
  return (
    <View style={styles.fill}>
      <Hud frac={frac} text={ok ? '👍 Thẳng rồi!' : '⚠️ Nghiêng quá!'} />
      <View style={styles.center}>
        <View style={[styles.tray, { transform: [{ rotate: `${tilt.current}deg` }], borderColor: ok ? colors.primary : colors.bad }]}>
          <Text style={styles.trayText}>{p.emoji ?? '🍜🍵🍜'}</Text>
        </View>
        <Text style={styles.huge}>🧍</Text>
      </View>
      <View style={styles.row}>
        <Pressable {...hold(-1)} style={styles.arrow} accessibilityRole="button" accessibilityLabel="Nghiêng trái">
          <Text style={styles.arrowText}>◀</Text>
        </Pressable>
        <Pressable {...hold(1)} style={styles.arrow} accessibilityRole="button" accessibilityLabel="Nghiêng phải">
          <Text style={styles.arrowText}>▶</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------- 8. memory: lật tìm cặp ----------
const MEM_POOL = ['🍜', '🥖', '🍚', '🥚', '🍤', '🌶️', '🥬', '🍵', '🧅', '🍅'];
function Memory({ p, finish }: GameProps) {
  const pairs = Math.min(p.need ?? 4, 6);
  const cards = useMemo(() => shuffle(shuffle(MEM_POOL).slice(0, pairs).flatMap((e) => [e, e])), [pairs]);
  const [open, setOpen] = useState<number[]>([]);
  const [done, setDone] = useState<number[]>([]);
  const doneRef = useRef(0);
  const frac = useClock(p.seconds ?? 20, () => finish(doneRef.current / pairs));
  const flip = (i: number) => {
    if (open.length >= 2 || open.includes(i) || done.includes(i)) return;
    const o = [...open, i];
    setOpen(o);
    if (o.length === 2) {
      if (cards[o[0]] === cards[o[1]]) {
        const d = [...done, ...o];
        setDone(d);
        setOpen([]);
        doneRef.current = d.length / 2;
        if (d.length === cards.length) finish(1);
      } else setTimeout(() => setOpen([]), 600);
    }
  };
  return (
    <View style={styles.fill}>
      <Hud frac={frac} text={`${done.length / 2} / ${pairs} cặp`} />
      <View style={styles.grid4}>
        {cards.map((e, i) => {
          const shown = open.includes(i) || done.includes(i);
          return (
            <Pressable key={i} onPressIn={() => flip(i)} onPress={noop} style={[styles.card, shown && styles.cardOpen, done.includes(i) && styles.padOk]} accessibilityRole="button" accessibilityLabel={`Thẻ ${i + 1}`}>
              <Text style={styles.padText}>{shown ? e : '❔'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------- 9. slice: chém rau bay lên, né ớt ----------
type Fly = { id: number; x: number; y: number; vx: number; vy: number; e: string; bomb: boolean };
const VEG = ['🥕', '🥒', '🧅', '🍅', '🥬', '🍆', '🥔'];
function Slice({ p, w, h, finish }: GameProps) {
  const need = p.need ?? 8;
  const areaH = h - 40;
  const [items, setItems] = useState<Fly[]>([]);
  const [cut, setCut] = useState(0);
  const [bad, setBad] = useState(0);
  const cutRef = useRef(0);
  const badRef = useRef(0);
  const nextId = useRef(1);
  const spawnAt = useRef(0);
  const g = areaH * 1.5;
  const sc = () => (cutRef.current - badRef.current * 2) / need;
  useFrame((dt, t) => {
    const s = dt / 1000;
    setItems((list) => {
      let next = list.map((o) => ({ ...o, x: o.x + o.vx * s, y: o.y + o.vy * s, vy: o.vy + g * s })).filter((o) => o.y < areaH + 10);
      if (t >= spawnAt.current) {
        spawnAt.current = t + rnd(420, 650);
        const bomb = Math.random() < 0.22;
        next = [
          ...next,
          { id: nextId.current++, x: rnd(10, w - T_SIZE - 10), y: areaH, vx: rnd(-40, 40), vy: -Math.sqrt(2 * g * areaH * rnd(0.55, 0.9)), e: bomb ? '🌶️' : VEG[rint(VEG.length)], bomb },
        ];
      }
      return next;
    });
  });
  const frac = useClock(p.seconds ?? 8, () => finish(sc()));
  const hit = (o: Fly) => {
    setItems((l) => l.filter((x) => x.id !== o.id));
    if (o.bomb) {
      badRef.current += 1;
      setBad(badRef.current);
    } else {
      cutRef.current += 1;
      setCut(cutRef.current);
      if (sc() >= 1) finish(1);
    }
  };
  return (
    <View style={styles.fill}>
      <Hud frac={frac} text={`🔪 ${cut} / ${need}${bad ? `   🌶️ −${bad * 2}` : ''}`} />
      <View style={{ flex: 1 }}>
        {items.map((o) => (
          <Pressable key={o.id} onPressIn={() => hit(o)} onPress={noop} style={[styles.target, { left: o.x, top: o.y }]} accessibilityRole="button" accessibilityLabel={o.bomb ? 'Ớt' : 'Rau'}>
            <Text style={styles.targetText}>{o.e}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------- 10. stack: thả bát chồng lên nhau ----------
const BOWL_W = 70;
function Stack({ p, w, h, finish }: GameProps) {
  const need = p.need ?? 6;
  const [x, setX] = useState(0);
  const phase = useRef(0);
  const [stack, setStack] = useState<number[]>(() => [(w - BOWL_W) / 2]);
  const [miss, setMiss] = useState(false);
  useFrame((dt) => {
    if (miss) return;
    phase.current += (dt / 1000) * (0.55 + (stack.length - 1) * 0.12);
    const ph = phase.current % 2;
    setX((1 - Math.abs(ph - 1)) * (w - BOWL_W));
  });
  const placed = stack.length - 1;
  const frac = useClock(p.seconds ?? 15, () => finish(placed / need));
  const drop = () => {
    if (miss) return;
    const top = stack[stack.length - 1];
    if (Math.abs(x - top) < BOWL_W * 0.6) {
      const s2 = [...stack, x];
      setStack(s2);
      if (s2.length - 1 >= need) finish(1);
    } else {
      setMiss(true);
      setTimeout(() => finish(placed / need), 500);
    }
  };
  useKeys((k, d) => d && k === ' ' && drop());
  const step = Math.min(34, (h - 140) / (need + 1));
  const e = p.emoji ?? '🥣';
  return (
    <Pressable onPressIn={drop} onPress={noop} style={styles.fill} accessibilityRole="button" accessibilityLabel="Thả bát">
      <Hud frac={frac} text={miss ? '💥 Rơi mất rồi!' : `${placed} / ${need}`} />
      <View style={{ flex: 1 }}>
        {!miss && <Text style={[styles.bowl, { left: x, top: 4 }]}>{e}</Text>}
        {stack.map((sx, i) => (
          <Text key={i} style={[styles.bowl, { left: sx, bottom: 6 + i * step }]}>
            {i === 0 ? '🟫' : e}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

// ---------- 11. spot: tìm 3 điểm khác ----------
const SPOT_POOL = ['🍜', '🥢', '🍚', '🧂', '🥄', '🍳', '🥬', '🧅', '🍅', '🥚', '🫖', '🍶', '🔪', '🧽'];
const SPOT_ODD = ['🪳', '🧦', '🐸', '🦴', '🍌', '🧸'];
function Spot({ p, finish }: GameProps) {
  const base = useMemo(() => shuffle(SPOT_POOL).slice(0, 12), []);
  const diffs = useMemo(() => shuffle(base.map((_, i) => i)).slice(0, 3), [base]);
  const odd = useMemo(() => shuffle(SPOT_ODD), []);
  const [found, setFound] = useState<number[]>([]);
  const [penalty, setPenalty] = useState(0);
  const foundRef = useRef(0);
  const seconds = (p.seconds ?? 15) - penalty;
  const frac = useClock(Math.max(1, seconds), () => finish(foundRef.current / 3));
  const tap = (i: number) => {
    if (found.includes(i)) return;
    if (diffs.includes(i)) {
      const f = [...found, i];
      setFound(f);
      foundRef.current = f.length;
      if (f.length >= 3) finish(1);
    } else setPenalty((x) => Math.min(x + 1.5, (p.seconds ?? 15) - 2));
  };
  const cell = (side: 'L' | 'R') =>
    base.map((e, i) => {
      const d = diffs.indexOf(i);
      const show = side === 'R' && d >= 0 ? odd[d] : e;
      const ok = side === 'R' && found.includes(i);
      return side === 'R' ? (
        <Pressable key={i} onPressIn={() => tap(i)} onPress={noop} style={[styles.spotCell, ok && styles.padOk]} accessibilityRole="button" accessibilityLabel={`Ô ${i + 1}`}>
          <Text style={styles.spotText}>{show}</Text>
        </Pressable>
      ) : (
        <View key={i} style={styles.spotCell}>
          <Text style={styles.spotText}>{show}</Text>
        </View>
      );
    });
  return (
    <View style={styles.fill}>
      <Hud frac={frac} text={`${found.length} / 3`} />
      <View style={styles.spotRow}>
        <View style={styles.spotGrid}>{cell('L')}</View>
        <View style={[styles.spotGrid, styles.spotRight]}>{cell('R')}</View>
      </View>
      <Text style={styles.scoreSub}>Chạm vào hình bên phải</Text>
    </View>
  );
}

// ---------- 12. quiz: đố vui 3 câu ----------
function Quiz({ p, finish }: GameProps) {
  const qs = useMemo(() => shuffle(QUIZ).slice(0, 3).map((q) => ({ q: q.q, order: shuffle(q.a.map((_, i) => i)), a: q.a })), []);
  const [idx, setIdx] = useState(0);
  const [right, setRight] = useState(0);
  const rightRef = useRef(0);
  const [picked, setPicked] = useState<number | null>(null);
  const frac = useClock(p.seconds ?? 24, () => finish(rightRef.current / 3));
  const q = qs[idx];
  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === 0) {
      rightRef.current += 1;
      setRight(rightRef.current);
    }
    setTimeout(() => {
      setPicked(null);
      if (idx + 1 >= qs.length) finish(rightRef.current / 3);
      else setIdx(idx + 1);
    }, 600);
  };
  return (
    <View style={styles.fill}>
      <Hud frac={frac} text={`Câu ${idx + 1} / 3   ✅ ${right}`} />
      <Text style={styles.question}>{q.q}</Text>
      <View style={styles.list}>
        {q.order.map((i) => (
          <Pressable key={i} onPress={() => choose(i)} style={[styles.answer, picked !== null && i === 0 && styles.padOk, picked === i && i !== 0 && styles.padBad]} accessibilityRole="button" accessibilityLabel={q.a[i]}>
            <Text style={styles.answerText}>{q.a[i]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------- 13. rhythm: chạm theo nhịp ----------
const LANES = ['🥁', '🎵', '🎶', '🎤'];
const TRAVEL = 1500;
function Rhythm({ p, h, finish }: GameProps) {
  const total = p.need ?? 12;
  const notes = useMemo(() => Array.from({ length: total }, (_, i) => ({ id: i, lane: rint(4), at: 900 + i * rnd(480, 620) })), [total]);
  const [t, setT] = useState(0);
  const [hit, setHit] = useState<number[]>([]);
  const hitRef = useRef<number[]>([]);
  const areaH = h - 120;
  const endAt = notes[notes.length - 1].at + TRAVEL + 400;
  useFrame((_dt, time) => setT(time));
  useEffect(() => {
    if (t > endAt) finish(hitRef.current.length / total);
  }, [t, endAt, total, finish]);
  const lineY = areaH * 0.88;
  const yOf = (n: { at: number }) => lineY - ((n.at - t) / TRAVEL) * lineY;
  const tapLane = (lane: number) => {
    const cand = notes.find((n) => n.lane === lane && !hitRef.current.includes(n.id) && Math.abs(yOf(n) - lineY) < areaH * 0.12);
    if (!cand) return;
    hitRef.current = [...hitRef.current, cand.id];
    setHit(hitRef.current);
  };
  useKeys((k, d) => {
    const i = ['d', 'f', 'j', 'k'].indexOf(k.toLowerCase());
    if (d && i >= 0) tapLane(i);
  });
  return (
    <View style={styles.fill}>
      <Hud frac={Math.max(0, 1 - t / endAt)} text={`🎵 ${hit.length} / ${total}`} />
      <View style={[styles.lanes, { height: areaH }]}>
        {LANES.map((_, lane) => (
          <View key={lane} style={styles.lane}>
            {notes
              .filter((n) => n.lane === lane && !hit.includes(n.id))
              .map((n) => {
                const y = yOf(n);
                if (y < -40 || y > areaH) return null;
                return (
                  <Text key={n.id} style={[styles.note, { top: y - 20 }]}>
                    {p.emoji ?? '🎵'}
                  </Text>
                );
              })}
          </View>
        ))}
        <View style={[styles.hitLine, { top: lineY }]} />
      </View>
      <View style={styles.row}>
        {LANES.map((e, lane) => (
          <Pressable key={lane} onPressIn={() => tapLane(lane)} onPress={noop} style={styles.laneBtn} accessibilityRole="button" accessibilityLabel={`Làn ${lane + 1}`}>
            <Text style={styles.padText}>{e}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const GAMES: Record<MiniSpec['type'], (props: GameProps) => React.ReactElement> = {
  tap: Tap,
  catch: Catch,
  sequence: Sequence,
  timing: Timing,
  pick: Pick,
  whack: Whack,
  balance: Balance,
  memory: Memory,
  slice: Slice,
  stack: Stack,
  spot: Spot,
  quiz: Quiz,
  rhythm: Rhythm,
};

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 420, alignItems: 'center', backgroundColor: colors.card, borderRadius: 18, padding: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4 },
  title: { fontSize: 20, fontWeight: '900', color: colors.text },
  skip: { backgroundColor: '#EEE', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  skipText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  prompt: { fontSize: 15, color: colors.text, marginVertical: 6, textAlign: 'center', fontWeight: '700' },
  area: { backgroundColor: '#FFF6E6', borderRadius: 14, overflow: 'hidden' },
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  big: { fontSize: 80 },
  huge: { fontSize: 90 },
  count: { fontSize: 110, fontWeight: '900', color: colors.primary },
  scoreText: { fontSize: 26, fontWeight: '900', color: colors.text },
  scoreSub: { fontSize: 14, color: colors.muted, marginTop: 6, textAlign: 'center' },
  hud: { padding: 8, gap: 4 },
  hudText: { fontSize: 15, fontWeight: '800', color: colors.text, textAlign: 'center' },
  timeBar: { height: 8, borderRadius: 4, backgroundColor: '#E8DCC8', overflow: 'hidden' },
  timeFill: { height: 8, borderRadius: 4 },
  tapBtn: { width: 170, height: 170, borderRadius: 85, backgroundColor: '#FFE0B2', alignItems: 'center', justifyContent: 'center' },
  target: { position: 'absolute', width: T_SIZE, height: T_SIZE, alignItems: 'center', justifyContent: 'center' },
  targetText: { fontSize: 46 },
  grid2: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 12, padding: 8 },
  grid3: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 14, padding: 8 },
  grid4: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 8, padding: 6 },
  pad: { width: '44%', aspectRatio: 1.3, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#EBDDC6', padding: 4 },
  padLit: { backgroundColor: '#FFE082', borderColor: '#F9A825', transform: [{ scale: 1.06 }] },
  padOk: { backgroundColor: '#C8F7C5', borderColor: '#43A047' },
  padBad: { backgroundColor: '#FFCDD2', borderColor: '#E53935' },
  padText: { fontSize: 40, textAlign: 'center' },
  hole: { width: '28%', aspectRatio: 1, borderRadius: 50, backgroundColor: '#8D6E63', alignItems: 'center', justifyContent: 'center' },
  track: { height: 34, borderRadius: 17, backgroundColor: '#E8DCC8', marginTop: 20, overflow: 'hidden' },
  zone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#81C784' },
  needle: { position: 'absolute', top: 0, bottom: 0, width: 6, backgroundColor: '#D84315', borderRadius: 3 },
  tray: { paddingHorizontal: 22, paddingVertical: 4, borderBottomWidth: 8, borderRadius: 6, marginBottom: -8 },
  trayText: { fontSize: 38 },
  row: { flexDirection: 'row', justifyContent: 'space-around', padding: 8, gap: 8 },
  arrow: { flex: 1, height: 64, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 30, color: '#fff', fontWeight: '900' },
  card: { width: '22%', aspectRatio: 0.8, borderRadius: 12, backgroundColor: '#FFCC80', alignItems: 'center', justifyContent: 'center' },
  cardOpen: { backgroundColor: '#FFFFFF' },
  bowl: { position: 'absolute', width: BOWL_W, textAlign: 'center', fontSize: 40 },
  spotRow: { flex: 1, flexDirection: 'row', gap: 6, padding: 6 },
  spotGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 2 },
  spotRight: { borderWidth: 2, borderColor: colors.primary },
  spotCell: { width: '33.3%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  spotText: { fontSize: 26 },
  question: { fontSize: 19, fontWeight: '900', color: colors.text, textAlign: 'center', paddingHorizontal: 10, marginVertical: 8 },
  list: { gap: 8, paddingHorizontal: 12 },
  answer: { borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#EBDDC6', paddingVertical: 12, paddingHorizontal: 12 },
  answerText: { fontSize: 17, fontWeight: '700', color: colors.text },
  lanes: { flexDirection: 'row', marginHorizontal: 8, overflow: 'hidden' },
  lane: { flex: 1, borderLeftWidth: 1, borderColor: '#EBDDC6' },
  note: { position: 'absolute', width: '100%', textAlign: 'center', fontSize: 34 },
  hitLine: { position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: '#F9A825' },
  laneBtn: { flex: 1, height: 60, borderRadius: 14, backgroundColor: '#FFE0B2', alignItems: 'center', justifyContent: 'center' },
});
