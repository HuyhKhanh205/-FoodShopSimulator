import { useMemo, useRef } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Group, Mesh, MeshStandardMaterial } from 'three';
import { useFrame } from '../../three/fiber';
import { useProp } from '../../three/models';
import { BURN_FACTOR } from '../../game/data';
import type { CookJob, Dish } from '../../game/types';
import { FOOD_COLOR } from './looks';

/** KayKit dùng ô lưới 2 đơn vị; game dùng ô 1 đơn vị. */
export const KAY = 0.5;

type Vec3 = [number, number, number];

/** Một đồ vật KayKit; chưa nạp xong / lỗi thì vẽ `fallback`. */
export function Prop({
  name,
  position = [0, 0, 0],
  rotation = 0,
  scale = KAY,
  fallback = null,
}: {
  name: string;
  position?: Vec3;
  rotation?: number;
  scale?: number | Vec3;
  fallback?: React.ReactNode;
}) {
  const obj = useProp(name);
  if (!obj) return <>{fallback}</>;
  return <primitive object={obj} position={position} rotation-y={rotation} scale={scale} />;
}

// ---------------- Hiệu ứng ----------------

/** Lửa bếp: các lưỡi lửa nhấp nháy quanh họng bếp. */
export function Flames({ y = 0.62, radius = 0.16, on = true }: { y?: number; radius?: number; on?: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => {
      if (!on) {
        c.scale.setScalar(0.001);
        return;
      }
      c.scale.set(1, 0.7 + Math.sin(clock.elapsedTime * 22 + i * 1.9) * 0.3, 1);
    });
  });
  return (
    <group ref={ref} position={[0, y, 0]}>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * radius, 0.04, Math.sin(a) * radius]}>
            <coneGeometry args={[0.03, 0.1, 8]} />
            <meshBasicMaterial color={i % 2 ? '#FF7043' : '#FFCA28'} transparent opacity={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Hơi nước / khói bốc lên. */
export function Puffs({ color, y, count = 4, spread = 0.12, active = true }: { color: string; y: number; count?: number; spread?: number; active?: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.55 + i / count) % 1;
      c.position.set(Math.sin((t + i) * 5) * spread, y + t * 0.7, Math.cos(i * 2.3) * spread * 0.6);
      c.scale.setScalar(active ? 0.4 + t * 1.3 : 0.001);
      ((c as Mesh).material as MeshStandardMaterial).opacity = active ? 0.5 * (1 - t) : 0;
    });
  });
  return (
    <group ref={ref}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color={color} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Vòng sáng lấp lánh khi món đã chín. */
export function DoneGlow({ y, color = '#FFEE58' }: { y: number; color?: string }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    m.scale.setScalar(1 + Math.sin(t * 6) * 0.12);
    m.rotation.z = t * 1.5;
    (m.material as MeshStandardMaterial).opacity = 0.55 + Math.sin(t * 6) * 0.25;
  });
  return (
    <mesh ref={ref} position={[0, y, 0]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.28, 0.34, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} depthWrite={false} />
    </mesh>
  );
}

// ---------------- Đồ vật trạm làm việc ----------------

function jobState(job: CookJob | null) {
  if (!job) return { done: false, warn: false };
  const done = job.progress >= job.cookTime;
  const warn = job.progress >= job.cookTime + (job.cookTime * (BURN_FACTOR - 1)) / 2;
  return { done, warn };
}

export function KayStove({ job, blocked, fallback }: { job: CookJob | null; blocked: boolean; fallback: React.ReactNode }) {
  const { done, warn } = jobState(job);
  const top = 1.21 * KAY;
  return (
    <group>
      <Prop name="stove_single" fallback={fallback} />
      <Prop name="extractorhood" position={[0, 0.05, -0.2]} scale={KAY * 0.9} />
      {job && (
        <group>
          <Flames y={top - 0.02} on={!blocked} />
          <Prop name={job.recipeId === 'banh_mi_trung' ? 'pan_A' : 'pot_A_stew'} position={[0, top, 0.02]} scale={KAY * 0.7} />
          <mesh position={[0, top + 0.22, 0.02]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.2, 20]} />
            <meshStandardMaterial color={warn ? '#2B1B12' : FOOD_COLOR[job.recipeId]} roughness={0.5} />
          </mesh>
          <Puffs color={warn ? '#212121' : '#FFFFFF'} y={top + 0.3} count={warn ? 6 : 4} active={!blocked} />
          {done && !warn && <DoneGlow y={top + 0.5} />}
        </group>
      )}
    </group>
  );
}

export function KayCounter({ job, fallback }: { job: CookJob | null; fallback: React.ReactNode }) {
  const { done } = jobState(job);
  const top = KAY;
  return (
    <group>
      <Prop name="kitchencounter_straight_B" fallback={fallback} />
      <Prop name="jar_B_small" position={[0.28, top, -0.25]} scale={KAY * 0.8} />
      <Prop name="jar_A_medium" position={[0.1, top, -0.3]} scale={KAY * 0.8} />
      {job ? (
        <group position={[-0.12, top, 0.1]}>
          <mesh position={[0, 0.13, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.08, 0.26, 20, 1, true]} />
            <meshStandardMaterial color="#E3F2FD" transparent opacity={0.35} roughness={0.05} />
          </mesh>
          <mesh position={[0, 0.02 + Math.min(1, job.progress / job.cookTime) * 0.1, 0]}>
            <cylinderGeometry args={[0.085, 0.075, 0.02 + Math.min(1, job.progress / job.cookTime) * 0.2, 20]} />
            <meshStandardMaterial color={FOOD_COLOR[job.recipeId]} roughness={0.2} />
          </mesh>
          {done && <DoneGlow y={0.4} color="#80DEEA" />}
        </group>
      ) : (
        <Prop name="ketchup" position={[-0.25, top, 0.1]} scale={KAY * 0.8} />
      )}
    </group>
  );
}

export function KayBoard({ prepping, fallback }: { prepping: boolean; fallback: React.ReactNode }) {
  const knife = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (knife.current) knife.current.position.y = KAY + 0.06 + (prepping ? Math.abs(Math.sin(clock.elapsedTime * 14)) * 0.1 : 0);
  });
  return (
    <group>
      <Prop name="kitchencounter_straight_A" fallback={fallback} />
      <Prop name="cuttingboard" position={[0, KAY, 0.05]} scale={KAY * 0.8} />
      <Prop name="food_ingredient_steak" position={[-0.18, KAY + 0.06, 0.05]} scale={KAY * 0.55} />
      <Prop name="food_ingredient_onion" position={[0.35, KAY, -0.3]} scale={KAY * 0.5} />
      <group ref={knife} position={[0.15, KAY + 0.06, 0.05]} rotation={[0, 0.4, Math.PI / 2]}>
        <Prop name="knife" scale={KAY * 0.8} />
      </group>
    </group>
  );
}

export function KayFridge({ fallback }: { fallback: React.ReactNode }) {
  return <Prop name="fridge_A" position={[0, 0, -0.05]} scale={KAY * 0.9} fallback={fallback} />;
}

export function KaySink({ fallback }: { fallback: React.ReactNode }) {
  return (
    <group>
      <Prop name="kitchencounter_sink" fallback={fallback} />
      <Prop name="dishrack_plates" position={[0.25, KAY, -0.2]} scale={KAY * 0.6} />
    </group>
  );
}

export function KayPass({ width, dishes, fallback }: { width: number; dishes: Dish[]; fallback: React.ReactNode }) {
  const probe = useProp('kitchencounter_straight_A');
  if (!probe) return <>{fallback}</>;
  const counters = Array.from({ length: width }, (_, i) => i - (width - 1) / 2);
  return (
    <group>
      {counters.map((x, i) => (
        <Prop key={x} name={i % 2 ? 'kitchencounter_straight_B' : 'kitchencounter_straight_A'} position={[x, 0, 0]} rotation={Math.PI} />
      ))}
      {dishes.slice(0, 10).map((d, i) => (
        <group key={d.id} position={[-width / 2 + 0.45 + i * 0.55, KAY, 0]}>
          <Prop name="plate" scale={KAY * 0.8} />
          <mesh position={[0, 0.07, 0]}>
            <sphereGeometry args={[0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={d.quality === 'burnt' ? '#212121' : FOOD_COLOR[d.recipeId]} roughness={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function KayTable({ seats, served, fallback }: { seats: [number, number][]; served: string[]; fallback: React.ReactNode }) {
  return (
    <group>
      <Prop name="table_round_A" scale={[0.3, KAY, 0.3]} fallback={fallback} />
      {seats.map(([sx, sz], i) => (
        <Prop key={i} name="chair_A" position={[sx * 1.1, 0, sz * 1.1]} rotation={Math.atan2(-sx, -sz)} />
      ))}
      <Prop name="menu" position={[0.12, KAY, -0.1]} scale={KAY * 0.6} />
      {served.slice(0, 4).map((color, i) => (
        <group key={i} position={[seats[i][0] * 0.38, KAY, seats[i][1] * 0.38]}>
          <Prop name="plate" scale={KAY * 0.6} />
          <mesh position={[0, 0.05, 0]}>
            <sphereGeometry args={[0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} roughness={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function KayDoor({ fallback }: { fallback: React.ReactNode }) {
  return <Prop name="door_A" position={[0, 0, 0.42]} rotation={Math.PI} fallback={fallback} />;
}

// ---------------- Trang trí ----------------

/** Biển hiệu tên quán (chữ vẽ bằng canvas trên web; trên app chỉ là bảng màu). */
export function ShopSign({ name, position, rotation = 0 }: { name: string; position: Vec3; rotation?: number }) {
  const tex = useMemo(() => {
    if (typeof document === 'undefined') return null;
    try {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 128;
      const g = c.getContext('2d');
      if (!g) return null;
      g.fillStyle = '#BF360C';
      g.fillRect(0, 0, 512, 128);
      g.strokeStyle = '#FFD54F';
      g.lineWidth = 8;
      g.strokeRect(6, 6, 500, 116);
      g.fillStyle = '#FFF8E1';
      let size = 64;
      g.font = `900 ${size}px system-ui, sans-serif`;
      while (g.measureText(name).width > 470 && size > 24) {
        size -= 2;
        g.font = `900 ${size}px system-ui, sans-serif`;
      }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(name, 256, 68);
      const t = new CanvasTexture(c);
      t.colorSpace = SRGBColorSpace;
      return t;
    } catch {
      return null;
    }
  }, [name]);
  return (
    <group position={position} rotation-y={rotation}>
      <mesh castShadow>
        <boxGeometry args={[3.2, 0.8, 0.08]} />
        <meshStandardMaterial color="#5D4037" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[3.05, 0.68]} />
        {tex ? <meshBasicMaterial map={tex} toneMapped={false} /> : <meshStandardMaterial color="#BF360C" />}
      </mesh>
    </group>
  );
}

/** Đèn thả trần: chao đèn + bóng phát sáng + ánh sáng ấm (tuỳ chọn). */
export function HangingLamp({ position, light = true }: { position: Vec3; light?: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 1, 4]} />
        <meshBasicMaterial color="#3E2723" />
      </mesh>
      <mesh>
        <coneGeometry args={[0.2, 0.16, 20, 1, true]} />
        <meshStandardMaterial color="#E65100" roughness={0.4} side={2} />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <sphereGeometry args={[0.06, 12, 8]} />
        <meshBasicMaterial color="#FFF3C4" toneMapped={false} />
      </mesh>
      {light && <pointLight position={[0, -0.15, 0]} color="#FFD8A0" intensity={2.2} distance={3.2} decay={1.6} />}
    </group>
  );
}

/** Đồ trang trí quanh quán (đặt trên các ô đã chặn trong bố cục). */
export function Decor() {
  return (
    <group>
      {/* Bếp: thùng nguyên liệu, kệ, quầy gia vị */}
      <Prop name="crate_steak" position={[0.5, 0, 1.5]} scale={KAY * 0.85} />
      <Prop name="crate_onions" position={[11.5, 0, 1.5]} scale={KAY * 0.85} />
      <Prop name="crate_lettuce" position={[11.5, 0.45, 1.5]} scale={KAY * 0.7} rotation={0.4} />
      <Prop name="kitchencounter_straight_A" position={[5.5, 0, 1.5]} />
      <Prop name="jar_A_medium" position={[5.3, KAY, 1.3]} scale={KAY * 0.9} />
      <Prop name="jar_C_medium" position={[5.55, KAY, 1.3]} scale={KAY * 0.9} />
      <Prop name="mustard" position={[5.75, KAY, 1.6]} scale={KAY * 0.9} />
      <Prop name="ketchup" position={[5.55, KAY, 1.7]} scale={KAY * 0.9} />
      <Prop name="kitchencounter_straight_B" position={[8.5, 0, 1.5]} />
      <Prop name="crate_tomatoes" position={[8.5, KAY, 1.5]} scale={KAY * 0.55} />
      <Prop name="shelf_papertowel_decorated" position={[5.5, 1.35, 0.5]} scale={KAY} />
      {/* Phòng ăn: cây cảnh, đèn cây, thảm */}
      <Prop name="cactus_medium_A" position={[0.5, 0, 9.5]} scale={KAY * 1.2} />
      <Prop name="lamp_standing" position={[11.5, 0, 5.5]} scale={KAY * 0.9} />
      <Prop name="cactus_small_B" position={[11.5, 0, 6.5]} scale={KAY * 1.4} />
      <Prop name="rug_rectangle_stripes_A" position={[10.5, 0.005, 8.9]} scale={KAY * 0.55} rotation={Math.PI / 2} />
    </group>
  );
}
