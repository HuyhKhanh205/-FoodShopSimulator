import { useLayoutEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import type { DirectionalLight, Group } from 'three';
import { Canvas, useFrame, useThree } from '../../three/fiber';
import type { ThreeEvent } from '../../three/fiber';
import { MAP_COLS, MAP_ROWS } from '../../game/layout';
import type { MapLayout, MapStation, Tile } from '../../game/layout';
import { staffTarget } from '../../game/staffTarget';
import type { Customer, GameState, PlayerProfile, Staff } from '../../game/types';
import type { WalkerState } from '../../screens/views/useWalker';
import { followCamera } from './camera';
import type { CameraCam, CameraFrame } from './camera';
import Character from './Character';
import ModelCharacter from './ModelCharacter';
import { dishKey } from './Dish';
import { Decor, HangingLamp, ShopSign } from './KayProps';
import { STAFF_MODEL, customerLook, customerModel, profileLook, staffLook } from './looks';
import type { Look } from './looks';
import { Floor, Highlight, SEATS, StationMesh, Walls } from './Stations3D';

const SHADOWS = Platform.OS === 'web';
/** Màn nhỏ (điện thoại): bớt đèn treo và giảm độ phân giải bóng / điểm ảnh cho nhẹ (Safari iPhone dễ đơ). */
const LITE = Platform.OS !== 'web' || (typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700);

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
      shadow-mapSize-width={LITE ? 1024 : 2048}
      shadow-mapSize-height={LITE ? 1024 : 2048}
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

/** Camera đi theo chủ quán (khi phóng to), đồng thời dời lớp chữ nổi theo cùng độ dời. */
function FollowCam({ cam, frame, walker, overlayPan }: { cam: CameraCam; frame: CameraFrame; walker: React.MutableRefObject<WalkerState>; overlayPan: Animated.ValueXY }) {
  const first = useRef(true);
  useFrame((_, dt) => {
    const w = walker.current;
    const t = first.current ? 1 : Math.min(1, dt * 4);
    first.current = false;
    const off = followCamera(cam, frame, w.x + 0.5, w.y + 0.5, t);
    overlayPan.setValue(off);
  });
  return null;
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function Player({ walker, carrying, profile }: { walker: React.MutableRefObject<WalkerState>; carrying: string[]; profile: PlayerProfile }) {
  const look: Look = profileLook(profile);
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
      {profile.model === 'custom' ? (
        <Character look={look} isMoving={() => walker.current.moving} carrying={carrying} shadows={SHADOWS} />
      ) : (
        <ModelCharacter
          model={profile.model}
          fallback={look}
          hat={profile.hat !== 'none' ? look : undefined}
          isMoving={() => walker.current.moving}
          carrying={carrying}
          shadows={SHADOWS}
        />
      )}
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
      <ModelCharacter
        model={STAFF_MODEL[staff.role]}
        fallback={staffLook(staff.role, staff.id)}
        hat={staff.role === 'waiter' ? undefined : staffLook(staff.role, staff.id)}
        isMoving={() => moving.current}
        carrying={carrying}
        shadows={SHADOWS}
      />
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
            <ModelCharacter model={customerModel(customer, i)} fallback={customerLook(customer, i)} hat={customerLook(customer, i)} seated shadows={SHADOWS} />
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
  frame: CameraFrame;
  overlayPan: Animated.ValueXY;
  hereId: string | null;
  walkingTo: string | null;
  wanted: Set<string>;
  onTapTile: (t: Tile) => void;
}

export default function ShopScene3D({ game, layout, walker, cam, frame, overlayPan, hereId, walkingTo, wanted, onTapTile }: SceneProps) {
  const run = game.run!;
  const dishColor = (id: string) => {
    const d = run.pass.find((x) => x.id === id);
    return d ? dishKey(d.recipeId, d.quality === 'burnt') : 'unknown';
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
    <Canvas shadows={SHADOWS ? 'percentage' : false} dpr={LITE ? [1, 1.5] : [1, 2]} gl={{ antialias: true }} style={{ flex: 1 }}>
      <UseCamera cam={cam} />
      <FollowCam cam={cam} frame={frame} walker={walker} overlayPan={overlayPan} />
      <color attach="background" args={['#FBE3C6']} />
      <fog attach="fog" args={['#FBE3C6', 45, 80]} />
      <hemisphereLight args={['#FFF6E5', '#6D4C41', 0.9]} />
      <ambientLight intensity={LITE ? 0.45 : 0.15} color="#FFE0B2" />
      <Sun />
      {/* Đèn thả trần ấm trên bếp và phòng ăn */}
      {[2.5, 6, 9.5].map((x) => (
        <HangingLamp key={`k${x}`} position={[x, 2.1, 2.6]} light={SHADOWS && !LITE} />
      ))}
      {[2, 6, 10].map((x) => (
        <HangingLamp key={`d${x}`} position={[x, 2.0, 7]} light={SHADOWS && !LITE} />
      ))}

      <group onClick={onClick}>
        <Floor />
        <Walls />
        <Decor />
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
              served={customer?.items.filter((i) => i.served).map((i) => dishKey(i.recipeId))}
            />
          );
        })}
      </group>

      <ShopSign name={game.profile.shopName} position={[10.2, 1.75, 9.9]} rotation={0} />
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
          <ModelCharacter model={customerModel(c)} fallback={customerLook(c)} hat={customerLook(c)} shadows={SHADOWS} />
        </group>
      ))}

      {game.staff.map((st) => {
        const to = staffTarget(st, game, layout);
        if (!to) return null;
        const holding = st.task?.kind === 'serve' && st.task.dishId ? [dishColor(st.task.dishId)] : [];
        return <StaffPerson key={st.id} staff={st} to={to} carrying={holding} />;
      })}

      <Player walker={walker} carrying={carried} profile={game.profile} />
    </Canvas>
  );
}
