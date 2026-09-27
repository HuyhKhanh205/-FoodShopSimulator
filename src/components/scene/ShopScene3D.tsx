import { useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type { DirectionalLight, Group } from 'three';
import { Canvas, useFrame, useThree } from '../../three/fiber';
import type { ThreeEvent } from '../../three/fiber';
import { MAP_COLS, MAP_ROWS } from '../../game/layout';
import type { MapLayout, MapStation, Tile } from '../../game/layout';
import { staffTarget } from '../../game/staffTarget';
import type { Customer, GameState, Staff } from '../../game/types';
import type { WalkerState } from '../../screens/views/useWalker';
import type { CameraCam } from './camera';
import Character from './Character';
import { FOOD_COLOR, PLAYER_LOOK, customerLook, staffLook } from './looks';
import { Floor, Highlight, SEATS, StationMesh, Walls } from './Stations3D';

const SHADOWS = Platform.OS === 'web';

/** Dùng camera tự quản lý (đã căn khung sẵn) làm camera mặc định của cảnh. */
function UseCamera({ cam }: { cam: CameraCam }) {
  const set = useThree((s) => s.set);
  useLayoutEffect(() => {
    set({ camera: cam });
  }, [cam, set]);
  return null;
}

/** Nắng chiều chiếu chéo, đổ bóng xuống sàn. */
function Sun() {
  const ref = useRef<DirectionalLight>(null);
  useLayoutEffect(() => {
    const l = ref.current;
    if (!l) return;
    l.target.position.set(MAP_COLS / 2, 0, MAP_ROWS / 2);
    l.target.updateMatrixWorld();
  }, []);
  return (
    <directionalLight
      ref={ref}
      position={[MAP_COLS / 2 + 4, 14, MAP_ROWS / 2 + 7]}
      intensity={1.6}
      castShadow={SHADOWS}
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
      shadow-camera-left={-9}
      shadow-camera-right={9}
      shadow-camera-top={9}
      shadow-camera-bottom={-9}
      shadow-camera-near={1}
      shadow-camera-far={40}
      shadow-bias={-0.0015}
    />
  );
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function Player({ walker, carrying }: { walker: React.MutableRefObject<WalkerState>; carrying: string[] }) {
  const ref = useRef<Group>(null);
  const ring = useRef<Group>(null);
  useFrame(({ clock }, dt) => {
    const w = walker.current;
    const g = ref.current;
    if (!g) return;
    g.position.set(w.x + 0.5, 0, w.y + 0.5);
    const want = Math.atan2(w.facing.x, w.facing.y);
    g.rotation.y = lerpAngle(g.rotation.y, want, Math.min(1, dt * 14));
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.08);
  });
  return (
    <group ref={ref}>
      <group ref={ring}>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.3, 0.4, 24]} />
          <meshBasicMaterial color="#FFB300" transparent opacity={0.9} />
        </mesh>
      </group>
      <Character look={PLAYER_LOOK} isMoving={() => walker.current.moving} carrying={carrying} shadows={SHADOWS} />
    </group>
  );
}

function StaffPerson({ staff, to, carrying }: { staff: Staff; to: Tile; carrying: string[] }) {
  const ref = useRef<Group>(null);
  const moving = useRef(false);
  const target = useRef(to);
  target.current = to;
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const tx = target.current.x + 0.5;
    const tz = target.current.y + 0.5;
    const dx = tx - g.position.x;
    const dz = tz - g.position.z;
    const d = Math.hypot(dx, dz);
    const step = 4.2 * dt;
    moving.current = d > 0.03;
    if (d <= step) {
      g.position.x = tx;
      g.position.z = tz;
    } else {
      g.position.x += (dx / d) * step;
      g.position.z += (dz / d) * step;
      g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 12));
    }
  });
  return (
    <group ref={ref} position={[to.x + 0.5, 0, to.y + 0.5]}>
      <Character look={staffLook(staff.role, staff.id)} isMoving={() => moving.current} carrying={carrying} shadows={SHADOWS} />
    </group>
  );
}

function SeatedCustomers({ st, customer }: { st: MapStation; customer: Customer }) {
  const n = Math.min(4, customer.size);
  return (
    <group position={[st.x + 0.5, 0, st.y + 0.5]}>
      {SEATS.slice(0, n).map(([sx, sz], i) => (
        <group key={i} position={[sx * 1.1, 0, sz * 1.1]} rotation-y={Math.atan2(-sx, -sz)}>
          <group position={[0, 0, -0.05]}>
            <Character look={customerLook(customer, i)} seated shadows={SHADOWS} />
          </group>
        </group>
      ))}
    </group>
  );
}

const DOOR_QUEUE: [number, number][] = [
  [11.5, 8.5],
  [10.5, 7.6],
  [11.5, 7.5],
  [10.5, 8.6],
];

export interface SceneProps {
  game: GameState;
  layout: MapLayout;
  walker: React.MutableRefObject<WalkerState>;
  cam: CameraCam;
  hereId: string | null;
  walkingTo: string | null;
  wanted: Set<string>;
  onTapTile: (t: Tile) => void;
}

export default function ShopScene3D({ game, layout, walker, cam, hereId, walkingTo, wanted, onTapTile }: SceneProps) {
  const run = game.run!;
  const dishColor = (id: string) => {
    const d = run.pass.find((x) => x.id === id);
    return d ? (d.quality === 'burnt' ? '#212121' : FOOD_COLOR[d.recipeId]) : '#FFFFFF';
  };
  const carried = run.carrying.map(dishColor);
  const blocked = run.elapsed < run.powerOutUntil || run.elapsed < run.gasOutUntil;
  const onPassDishes = run.pass.filter((d) => !run.carrying.includes(d.id));
  const doorCustomers = run.customers.filter((c) => c.tableIndex === undefined);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const x = Math.floor(e.point.x);
    const y = Math.floor(e.point.z);
    if (x >= 0 && y >= 0 && x < MAP_COLS && y < MAP_ROWS) onTapTile({ x, y });
  };

  return (
    <Canvas shadows={SHADOWS ? 'percentage' : false} dpr={[1, 2]} gl={{ antialias: true }} style={{ flex: 1 }}>
      <UseCamera cam={cam} />
      <color attach="background" args={['#FBE3C6']} />
      <hemisphereLight args={['#FFF6E5', '#8D6E63', 1.1]} />
      <Sun />

      <group onClick={onClick}>
        <Floor />
        <Walls />
        {layout.stations.map((st) => {
          const slot = st.slotId ? run.slots.find((s) => s.id === st.slotId) : undefined;
          const customer = st.kind === 'table' ? run.customers.find((c) => c.tableIndex === st.tableIndex) : undefined;
          return (
            <StationMesh
              key={st.id}
              st={st}
              job={slot?.job ?? null}
              blocked={st.kind === 'stove' && blocked}
              prepping={st.kind === 'board' && Boolean(run.playerPrep)}
              dishes={st.kind === 'pass' ? onPassDishes : undefined}
              served={customer?.items.filter((i) => i.served).map((i) => FOOD_COLOR[i.recipeId])}
            />
          );
        })}
      </group>

      {layout.stations.map((st) => {
        if (st.id === hereId) return <Highlight key={st.id} st={st} color="#FFEB3B" />;
        if (st.id === walkingTo) return <Highlight key={st.id} st={st} color="#FFF59D" />;
        if (wanted.has(st.id)) return <Highlight key={st.id} st={st} color="#66BB6A" />;
        return null;
      })}

      {layout.stations
        .filter((st) => st.kind === 'table')
        .map((st) => {
          const c = run.customers.find((x) => x.tableIndex === st.tableIndex);
          return c ? <SeatedCustomers key={c.id} st={st} customer={c} /> : null;
        })}

      {doorCustomers.slice(0, DOOR_QUEUE.length).map((c, i) => (
        <group key={c.id} position={[DOOR_QUEUE[i][0], 0, DOOR_QUEUE[i][1]]} rotation-y={Math.PI}>
          <Character look={customerLook(c)} shadows={SHADOWS} />
        </group>
      ))}

      {game.staff.map((st) => {
        const to = staffTarget(st, game, layout);
        if (!to) return null;
        const holding = st.task?.kind === 'serve' && st.task.dishId ? [dishColor(st.task.dishId)] : [];
        return <StaffPerson key={st.id} staff={st} to={to} carrying={holding} />;
      })}

      <Player walker={walker} carrying={carried} />
    </Canvas>
  );
}
