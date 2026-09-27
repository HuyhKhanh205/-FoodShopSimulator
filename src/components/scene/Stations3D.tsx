import { useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';
import { useFrame } from '../../three/fiber';
import { burnGrace } from '../../game/data';
import { MAP_COLS, MAP_ROWS, PASS_ROW } from '../../game/layout';
import type { MapStation } from '../../game/layout';
import type { CookJob, Dish } from '../../game/types';
import { foodColor } from './looks';
import DishModel from './Dish';
import { KayBoard, KayCounter, KayDoor, KayFridge, KayPass, KaySink, KayStove, KayTable } from './KayProps';
import { checkerTileTexture, wallTileTexture, woodTexture } from './textures';

const center = (st: MapStation): [number, number] => [st.x + st.w / 2, st.y + st.h / 2];

// ---------- Sàn và tường ----------

export function Floor() {
  const diningDepth = MAP_ROWS - PASS_ROW - 0.5;
  const kitchenDepth = PASS_ROW + 0.5;
  const tiles = useMemo(() => {
    const t = checkerTileTexture('#F5F5F5', '#37474F').clone();
    t.repeat.set(MAP_COLS / 2, kitchenDepth / 2);
    t.needsUpdate = true;
    return t;
  }, [kitchenDepth]);
  const wood = useMemo(() => {
    const t = woodTexture('#C8914F').clone();
    t.repeat.set(MAP_COLS / 3, diningDepth / 1.5);
    t.needsUpdate = true;
    return t;
  }, [diningDepth]);
  return (
    <group>
      {/* Bếp: gạch men caro đen trắng */}
      <mesh rotation-x={-Math.PI / 2} position={[MAP_COLS / 2, 0, kitchenDepth / 2]} receiveShadow>
        <planeGeometry args={[MAP_COLS, kitchenDepth]} />
        <meshStandardMaterial map={tiles} roughness={0.35} metalness={0.05} />
      </mesh>
      {/* Phòng ăn: sàn gỗ ván */}
      <mesh rotation-x={-Math.PI / 2} position={[MAP_COLS / 2, 0, kitchenDepth + diningDepth / 2]} receiveShadow>
        <planeGeometry args={[MAP_COLS, diningDepth]} />
        <meshStandardMaterial map={wood} roughness={0.7} />
      </mesh>
    </group>
  );
}

export function Walls() {
  const wallTiles = useMemo(() => {
    const t = wallTileTexture('#26A69A', '#1B7F74').clone();
    t.repeat.set(MAP_COLS * 2, 2);
    t.needsUpdate = true;
    return t;
  }, []);
  return (
    <group>
      {/* Tường sau: ốp gạch phía dưới, sơn kem phía trên */}
      <mesh position={[MAP_COLS / 2, 0.4, 0.25]} castShadow receiveShadow>
        <boxGeometry args={[MAP_COLS, 0.8, 0.5]} />
        <meshStandardMaterial map={wallTiles} roughness={0.3} />
      </mesh>
      <mesh position={[MAP_COLS / 2, 1.3, 0.2]} receiveShadow>
        <boxGeometry args={[MAP_COLS, 1.0, 0.4]} />
        <meshLambertMaterial color="#FFE7C7" />
      </mesh>
      {/* Kệ treo + nồi trang trí */}
      <mesh position={[3, 1.35, 0.45]} castShadow>
        <boxGeometry args={[3.5, 0.06, 0.25]} />
        <meshLambertMaterial color="#8D6E63" />
      </mesh>
      {[1.7, 2.5, 3.3, 4.1].map((x, i) => (
        <mesh key={x} position={[x, 1.48, 0.45]} castShadow>
          <cylinderGeometry args={[0.13, 0.11, 0.2, 10]} />
          <meshLambertMaterial color={i % 2 ? '#B0BEC5' : '#E65100'} />
        </mesh>
      ))}
      {/* Cửa sổ */}
      <mesh position={[9, 1.35, 0.41]}>
        <boxGeometry args={[2.2, 0.7, 0.02]} />
        <meshBasicMaterial color="#B3E5FC" />
      </mesh>
      <mesh position={[9, 1.35, 0.42]}>
        <boxGeometry args={[0.05, 0.7, 0.02]} />
        <meshLambertMaterial color="#FFFFFF" />
      </mesh>
      {/* Tường thấp hai bên */}
      {[0.05, MAP_COLS - 0.05].map((x) => (
        <mesh key={x} position={[x, 0.12, MAP_ROWS / 2]} receiveShadow>
          <boxGeometry args={[0.1, 0.24, MAP_ROWS]} />
          <meshLambertMaterial color="#A1887F" />
        </mesh>
      ))}
      <mesh position={[MAP_COLS / 2 - 0.5, 0.12, MAP_ROWS - 0.05]} receiveShadow>
        <boxGeometry args={[MAP_COLS - 1, 0.24, 0.1]} />
        <meshLambertMaterial color="#A1887F" />
      </mesh>
    </group>
  );
}

// ---------- Hiệu ứng ----------

function Flame({ paused }: { paused: boolean }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = paused ? 0.001 : 0.85 + Math.sin(clock.elapsedTime * 22) * 0.12 + Math.sin(clock.elapsedTime * 13) * 0.08;
    ref.current.scale.set(1, s, 1);
  });
  return (
    <mesh ref={ref} position={[0, 0.86, 0]}>
      <coneGeometry args={[0.2, 0.14, 12, 1, true]} />
      <meshBasicMaterial color="#FF7043" transparent opacity={0.85} />
    </mesh>
  );
}

function Smoke() {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.8 + i / 3) % 1;
      c.position.y = 1.05 + t * 0.9;
      c.scale.setScalar(0.6 + t);
      c.position.x = Math.sin((t + i) * 4) * 0.08;
    });
  });
  return (
    <group ref={ref}>
      {[0, 1, 2].map((i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshLambertMaterial color="#616161" transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function Ghost({ st }: { st: MapStation }) {
  const [cx, cz] = center(st);
  return (
    <mesh position={[cx, 0.4, cz]}>
      <boxGeometry args={[st.w * 0.86, 0.8, st.h * 0.86]} />
      <meshLambertMaterial color="#FFFFFF" transparent opacity={0.28} />
    </mesh>
  );
}

// ---------- Đồ vật ----------

function Stove({ job, blocked }: { job: CookJob | null; blocked: boolean }) {
  const warn = Boolean(job && job.progress >= job.cookTime + burnGrace(job.cookTime) / 2);
  return (
    <group>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.88, 0.8, 0.88]} />
        <meshLambertMaterial color="#B0BEC5" />
      </mesh>
      <mesh position={[0, 0.34, 0.445]}>
        <boxGeometry args={[0.62, 0.36, 0.02]} />
        <meshLambertMaterial color="#37474F" />
      </mesh>
      <mesh position={[0, 0.82, 0]} receiveShadow>
        <boxGeometry args={[0.9, 0.04, 0.9]} />
        <meshLambertMaterial color="#263238" />
      </mesh>
      {[-0.25, 0, 0.25].map((x) => (
        <mesh key={x} position={[x, 0.66, 0.45]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.035, 0.035, 0.04, 8]} />
          <meshLambertMaterial color="#ECEFF1" />
        </mesh>
      ))}
      {job ? (
        <group>
          <Flame paused={blocked} />
          <mesh position={[0, 0.96, 0]} castShadow>
            <cylinderGeometry args={[0.27, 0.24, 0.22, 16]} />
            <meshLambertMaterial color="#78909C" />
          </mesh>
          <mesh position={[0, 1.07, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.02, 16]} />
            <meshLambertMaterial color={warn ? '#3E2723' : foodColor(job.recipeId)} />
          </mesh>
          {warn && <Smoke />}
        </group>
      ) : (
        <mesh position={[0, 0.85, 0]} rotation-x={-Math.PI / 2}>
          <torusGeometry args={[0.18, 0.025, 6, 18]} />
          <meshLambertMaterial color="#546E7A" />
        </mesh>
      )}
    </group>
  );
}

function Counter({ job }: { job: CookJob | null }) {
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.88, 0.84, 0.88]} />
        <meshLambertMaterial color="#4DB6AC" />
      </mesh>
      <mesh position={[0, 0.86, 0]} receiveShadow>
        <boxGeometry args={[0.92, 0.04, 0.92]} />
        <meshLambertMaterial color="#E0F2F1" />
      </mesh>
      <mesh position={[0.2, 1.05, -0.2]} castShadow>
        <boxGeometry args={[0.28, 0.36, 0.28]} />
        <meshLambertMaterial color="#B2DFDB" />
      </mesh>
      {job ? (
        <mesh position={[-0.12, 0.98, 0.1]} castShadow>
          <cylinderGeometry args={[0.1, 0.08, 0.22, 12]} />
          <meshLambertMaterial color={foodColor(job.recipeId)} />
        </mesh>
      ) : (
        [-0.25, -0.05].map((x) => (
          <mesh key={x} position={[x, 0.95, 0.15]}>
            <cylinderGeometry args={[0.07, 0.06, 0.14, 10]} />
            <meshLambertMaterial color="#FFFFFF" transparent opacity={0.8} />
          </mesh>
        ))
      )}
    </group>
  );
}

function Fridge() {
  return (
    <group>
      <mesh position={[0, 0.85, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[0.88, 1.7, 0.8]} />
        <meshLambertMaterial color="#E3F2FD" />
      </mesh>
      <mesh position={[0, 1.1, 0.36]}>
        <boxGeometry args={[0.86, 0.02, 0.02]} />
        <meshLambertMaterial color="#90A4AE" />
      </mesh>
      {[1.4, 0.6].map((y) => (
        <mesh key={y} position={[0.32, y, 0.37]}>
          <boxGeometry args={[0.04, 0.3, 0.04]} />
          <meshLambertMaterial color="#78909C" />
        </mesh>
      ))}
    </group>
  );
}

function Board({ prepping }: { prepping: boolean }) {
  const knife = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (knife.current) knife.current.position.y = prepping ? 0.9 + Math.abs(Math.sin(clock.elapsedTime * 14)) * 0.08 : 0.88;
  });
  return (
    <group>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.88, 0.8, 0.88]} />
        <meshLambertMaterial color="#A1887F" />
      </mesh>
      <mesh position={[0, 0.82, 0]} receiveShadow>
        <boxGeometry args={[0.92, 0.04, 0.92]} />
        <meshLambertMaterial color="#EFEBE9" />
      </mesh>
      <mesh position={[0, 0.855, 0.05]} castShadow>
        <boxGeometry args={[0.55, 0.03, 0.38]} />
        <meshLambertMaterial color="#C8A27A" />
      </mesh>
      <group ref={knife} position={[0.1, 0.88, 0.05]} rotation-y={0.5}>
        <mesh>
          <boxGeometry args={[0.04, 0.012, 0.26]} />
          <meshLambertMaterial color="#CFD8DC" />
        </mesh>
        <mesh position={[0, 0.01, -0.17]}>
          <boxGeometry args={[0.05, 0.03, 0.1]} />
          <meshLambertMaterial color="#3E2723" />
        </mesh>
      </group>
      {[
        [-0.15, '#66BB6A'],
        [-0.05, '#EF5350'],
        [-0.22, '#9CCC65'],
      ].map(([x, c], i) => (
        <mesh key={i} position={[x as number, 0.9, -0.05 + i * 0.07]}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshLambertMaterial color={c as string} />
        </mesh>
      ))}
    </group>
  );
}

function Trash() {
  return (
    <group>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.24, 0.7, 14]} />
        <meshLambertMaterial color="#78909C" />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.05, 14]} />
        <meshLambertMaterial color="#546E7A" />
      </mesh>
    </group>
  );
}

function Mop() {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.2, 0.32, 14]} />
        <meshLambertMaterial color="#42A5F5" />
      </mesh>
      <mesh position={[0.05, 0.7, -0.05]} rotation={[0.2, 0, -0.15]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 1.1, 6]} />
        <meshLambertMaterial color="#FFCA28" />
      </mesh>
    </group>
  );
}

function Pass({ st, dishes }: { st: MapStation; dishes: Dish[] }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[st.w - 0.05, 0.9, 0.8]} />
        <meshLambertMaterial color="#8D6E63" />
      </mesh>
      <mesh position={[0, 0.92, 0]} receiveShadow>
        <boxGeometry args={[st.w, 0.05, 0.92]} />
        <meshLambertMaterial color="#ECEFF1" />
      </mesh>
      {/* Đèn giữ nóng */}
      {[-2, 0, 2].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 1.75, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.5, 4]} />
            <meshBasicMaterial color="#424242" />
          </mesh>
          <mesh position={[0, 1.48, 0]}>
            <coneGeometry args={[0.18, 0.14, 12, 1, true]} />
            <meshLambertMaterial color="#FF8F00" />
          </mesh>
        </group>
      ))}
      <mesh position={[st.w / 2 - 0.25, 0.99, 0.2]}>
        <sphereGeometry args={[0.08, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshLambertMaterial color="#FFD54F" />
      </mesh>
      {dishes.slice(0, 10).map((d, i) => (
        <group key={d.id} position={[-st.w / 2 + 0.45 + i * 0.55, 0.96, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.2, 0.16, 0.03, 14]} />
            <meshLambertMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <sphereGeometry args={[0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshLambertMaterial color={d.quality === 'burnt' ? '#212121' : foodColor(d.recipeId)} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export const SEATS: [number, number][] = [
  [0, -0.66],
  [0, 0.66],
  [-0.66, 0],
  [0.66, 0],
];

function Table({ served }: { served: string[] }) {
  return (
    <group>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.06, 20]} />
        <meshLambertMaterial color="#8D6E63" />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.7, 8]} />
        <meshLambertMaterial color="#5D4037" />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.04, 14]} />
        <meshLambertMaterial color="#5D4037" />
      </mesh>
      {SEATS.map(([sx, sz], i) => (
        <group key={i} position={[sx * 1.1, 0, sz * 1.1]} rotation-y={Math.atan2(-sx, -sz)}>
          <mesh position={[0, 0.42, 0]} castShadow>
            <boxGeometry args={[0.34, 0.05, 0.34]} />
            <meshLambertMaterial color="#6D4C41" />
          </mesh>
          <mesh position={[0, 0.66, -0.16]} castShadow>
            <boxGeometry args={[0.34, 0.45, 0.04]} />
            <meshLambertMaterial color="#6D4C41" />
          </mesh>
          {[
            [-0.14, -0.14],
            [0.14, -0.14],
            [-0.14, 0.14],
            [0.14, 0.14],
          ].map(([lx, lz], j) => (
            <mesh key={j} position={[lx, 0.2, lz]}>
              <boxGeometry args={[0.04, 0.4, 0.04]} />
              <meshLambertMaterial color="#4E342E" />
            </mesh>
          ))}
        </group>
      ))}
      {served.slice(0, 4).map((dish, i) => (
        <group key={i} position={[SEATS[i][0] * 0.4, 0.77, SEATS[i][1] * 0.4]}>
          <DishModel dish={dish} scale={0.8} />
        </group>
      ))}
    </group>
  );
}

function Door() {
  return (
    <group>
      <mesh position={[0, 0.005, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.9, 0.7]} />
        <meshLambertMaterial color="#C62828" />
      </mesh>
      <mesh position={[0, 0.8, 0.45]} castShadow>
        <boxGeometry args={[0.8, 1.6, 0.06]} />
        <meshLambertMaterial color="#6D4C41" />
      </mesh>
      <mesh position={[0.28, 0.8, 0.5]}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <meshLambertMaterial color="#FFD54F" />
      </mesh>
    </group>
  );
}

/** Vẽ một đồ vật tại vị trí của nó trên lưới. */
export function StationMesh({
  st,
  job,
  blocked,
  prepping,
  dishes,
  served,
}: {
  st: MapStation;
  job?: CookJob | null;
  blocked?: boolean;
  prepping?: boolean;
  dishes?: Dish[];
  served?: string[];
}) {
  if (!st.active) return <Ghost st={st} />;
  const [cx, cz] = center(st);
  let body: React.ReactNode = null;
  switch (st.kind) {
    case 'stove':
      body = <KayStove job={job ?? null} blocked={Boolean(blocked)} fallback={<Stove job={job ?? null} blocked={Boolean(blocked)} />} />;
      break;
    case 'counter':
      body = <KayCounter job={job ?? null} fallback={<Counter job={job ?? null} />} />;
      break;
    case 'fridge':
      body = <KayFridge fallback={<Fridge />} />;
      break;
    case 'board':
      body = <KayBoard prepping={Boolean(prepping)} fallback={<Board prepping={Boolean(prepping)} />} />;
      break;
    case 'trash':
      body = <Trash />;
      break;
    case 'mop':
      body = (
        <group>
          <KaySink fallback={<Mop />} />
          <group position={[-0.3, 0, 0.3]} scale={0.7}>
            <Mop />
          </group>
        </group>
      );
      break;
    case 'pass':
      body = <KayPass width={st.w} dishes={dishes ?? []} fallback={<Pass st={st} dishes={dishes ?? []} />} />;
      break;
    case 'table':
      body = <KayTable seats={SEATS} served={served ?? []} fallback={<Table served={served ?? []} />} />;
      break;
    case 'door':
      body = <KayDoor fallback={<Door />} />;
      break;
  }
  return <group position={[cx, 0, cz]}>{body}</group>;
}

/** Vệt sáng dưới chân đồ vật đang đứng cạnh / đang đi tới / khách chờ món đang cầm. */
export function Highlight({ st, color }: { st: MapStation; color: string }) {
  const [cx, cz] = center(st);
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current?.material as { opacity: number } | undefined;
    if (m) m.opacity = 0.35 + Math.sin(clock.elapsedTime * 5) * 0.15;
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position={[cx, 0.01, cz]}>
      <planeGeometry args={[st.w + 0.25, st.h + 0.25]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} />
    </mesh>
  );
}
