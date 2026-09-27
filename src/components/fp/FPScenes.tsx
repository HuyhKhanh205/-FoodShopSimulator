import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, DoubleSide, Vector3 } from 'three';
import type { Group, Mesh, MeshStandardMaterial, PerspectiveCamera } from 'three';
import { useFrame, useThree } from '../../three/fiber';
import type { IngredientId, RecipeId } from '../../game/types';
import { FOOD_COLOR } from '../scene/looks';

/** Thời điểm (ms, performance.now) của lần chạm gần nhất — cảnh đọc để chạy hoạt ảnh thái/khuấy. */
export type PulseRef = React.MutableRefObject<number>;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function Std({ color, rough = 0.7, metal = 0, opacity }: { color: string; rough?: number; metal?: number; opacity?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={metal} transparent={opacity !== undefined} opacity={opacity ?? 1} />;
}

/**
 * Camera ngang tầm mắt nhìn xuống mặt bàn. Lùi xa hơn khi màn hình hẹp (điện thoại dọc)
 * để luôn thấy trọn thớt / nồi và hai tay.
 */
export function EyeCamera() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const vfov = 50;
    const hfov = 2 * Math.atan(Math.tan((vfov * Math.PI) / 360) * aspect);
    const dist = Math.max(1.9, 0.8 / Math.tan(hfov / 2));
    const target = new Vector3(0, 0.95, -0.28);
    const dir = new Vector3(0, 0.95, 0.75).normalize();
    camera.fov = vfov;
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

/** Mặt bếp, tường ốp gạch và ánh sáng chung cho mọi cảnh góc nhìn thứ nhất. */
export function Kitchen({ top = '#ECEFF1', body = '#8D6E63' }: { top?: string; body?: string }) {
  const tiles = useMemo(() => {
    const out: [number, number][] = [];
    for (let x = -4; x <= 4; x += 1) for (let y = 0; y < 5; y += 1) out.push([x * 0.32, 1.0 + y * 0.32]);
    return out;
  }, []);
  return (
    <group>
      <hemisphereLight args={['#FFF6E5', '#6D4C41', 1.0]} />
      <directionalLight position={[1.5, 3, 2]} intensity={1.6} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[0, 1.8, -0.2]} intensity={0.6} color="#FFE0B2" />
      <mesh position={[0, 0.45, -0.3]} receiveShadow>
        <boxGeometry args={[3.2, 0.9, 1.5]} />
        <Std color={body} />
      </mesh>
      <mesh position={[0, 0.915, -0.3]} receiveShadow>
        <boxGeometry args={[3.24, 0.03, 1.54]} />
        <Std color={top} rough={0.35} />
      </mesh>
      <mesh position={[0, 1.6, -1.06]}>
        <planeGeometry args={[3.2, 1.6]} />
        <Std color="#FFF8E1" />
      </mesh>
      {tiles.map(([x, y]) => (
        <mesh key={`${x},${y}`} position={[x, y, -1.05]}>
          <planeGeometry args={[0.3, 0.3]} />
          <Std color="#E0F2F1" rough={0.25} />
        </mesh>
      ))}
    </group>
  );
}

/** Cẳng tay + bàn tay ló từ dưới màn hình (góc nhìn của chủ quán). */
export function Hand({
  skin,
  sleeve,
  position,
  rotation = [0, 0, 0],
  children,
  handRef,
}: {
  skin: string;
  sleeve: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  children?: React.ReactNode;
  handRef?: React.Ref<Group>;
}) {
  return (
    <group ref={handRef} position={position} rotation={rotation}>
      {/* Cẳng tay kéo dài về phía người nhìn */}
      <mesh position={[0, 0.03, 0.2]} rotation-x={Math.PI / 2 - 0.3} castShadow>
        <capsuleGeometry args={[0.045, 0.28, 8, 16]} />
        <Std color={skin} rough={0.6} />
      </mesh>
      <mesh position={[0, 0.1, 0.42]} rotation-x={Math.PI / 2 - 0.3} castShadow>
        <cylinderGeometry args={[0.065, 0.07, 0.2, 20]} />
        <Std color={sleeve} />
      </mesh>
      {/* Bàn tay */}
      <mesh scale={[1.05, 0.62, 1.2]} castShadow>
        <sphereGeometry args={[0.07, 20, 14]} />
        <Std color={skin} rough={0.6} />
      </mesh>
      {[-0.04, -0.013, 0.013, 0.04].map((x) => (
        <mesh key={x} position={[x, -0.012, -0.075]} rotation-x={Math.PI / 2 + 0.5}>
          <capsuleGeometry args={[0.014, 0.045, 4, 8]} />
          <Std color={skin} rough={0.6} />
        </mesh>
      ))}
      {children}
    </group>
  );
}

// ---------------- Thớt ----------------

const INGREDIENT_LOOK: Partial<Record<IngredientId, { color: string; shape: 'slab' | 'log' | 'leaf' | 'stalk' | 'shrimp' }>> = {
  thit_bo: { color: '#A63D2F', shape: 'slab' },
  thit_heo: { color: '#E59A8A', shape: 'slab' },
  ga: { color: '#EAC28C', shape: 'slab' },
  tom: { color: '#FF8A65', shape: 'shrimp' },
  rau: { color: '#66BB6A', shape: 'leaf' },
  hanh: { color: '#7CB342', shape: 'stalk' },
};

function Piece({ id, length }: { id: IngredientId; length: number }) {
  const look = INGREDIENT_LOOK[id] ?? { color: '#BCAAA4', shape: 'slab' as const };
  if (length <= 0.01) return null;
  switch (look.shape) {
    case 'stalk':
      return (
        <group>
          {[-0.03, 0, 0.03].map((z) => (
            <mesh key={z} position={[length / 2, 0.02, z]} rotation-z={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.012, 0.014, length, 10]} />
              <Std color={look.color} />
            </mesh>
          ))}
        </group>
      );
    case 'leaf':
      return (
        <group>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[(length * (i + 0.5)) / 4, 0.02 + i * 0.006, (i % 2 ? 0.03 : -0.03)]} scale={[1, 0.25, 0.8]} castShadow>
              <sphereGeometry args={[Math.max(0.03, length / 4), 14, 10]} />
              <Std color={i % 2 ? '#81C784' : look.color} />
            </mesh>
          ))}
        </group>
      );
    case 'shrimp':
      return (
        <mesh position={[length / 2, 0.035, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[Math.max(0.03, length / 2.2), 0.028, 10, 20, Math.PI * 1.3]} />
          <Std color={look.color} rough={0.5} />
        </mesh>
      );
    default:
      return (
        <mesh position={[length / 2, 0.035, 0]} scale={[1, 0.55, 1]} castShadow>
          <capsuleGeometry args={[0.065, Math.max(0.01, length - 0.13), 8, 16]} />
          <Std color={look.color} rough={0.55} />
        </mesh>
      );
  }
}

/**
 * Cảnh thớt: tay trái giữ nguyên liệu, tay phải cầm dao bổ xuống mỗi lần chạm;
 * lát cắt rời ra dồn sang phải theo tiến độ, thái xong thì vào bát.
 */
export function BoardScene({
  ingredient,
  progress,
  bowl,
  pulse,
  skin,
  sleeve,
}: {
  ingredient: IngredientId | null;
  /** 0..1 khi đang sơ chế, null khi rảnh. */
  progress: number | null;
  /** Số phần đã sơ chế của nguyên liệu vừa thái (hiện trong bát). */
  bowl: { id: IngredientId; count: number } | null;
  pulse: PulseRef;
  skin: string;
  sleeve: string;
}) {
  const knife = useRef<Group>(null);
  const FULL = 0.5;
  const START = -0.38;
  const remain = progress === null ? 0 : FULL * (1 - progress);
  const slices = progress === null ? 0 : Math.floor(progress * 10);
  const cutX = START + remain;

  useFrame(() => {
    const k = knife.current;
    if (!k) return;
    const since = now() - pulse.current;
    // Chạm: dao bổ xuống rồi nhấc lên; đang thái mà không chạm: tự thái chậm.
    let down = Math.max(0, 1 - since / 160);
    if (progress !== null && since > 400) down = Math.max(0, Math.sin(now() / 140)) * 0.6;
    k.position.set(progress === null ? 0.25 : cutX + 0.1, 1.12 - down * 0.15, -0.2);
    k.rotation.z = progress === null ? -0.3 : 0.15 - down * 0.15;
  });

  const look = ingredient ? INGREDIENT_LOOK[ingredient] : undefined;
  return (
    <group>
      <Kitchen />
      {/* Thớt gỗ */}
      <mesh position={[0, 0.945, -0.25]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.035, 0.6]} />
        <Std color="#C8A27A" rough={0.8} />
      </mesh>
      <mesh position={[0.43, 0.965, -0.48]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.02, 0.035, 16]} />
        <Std color="#8D6E63" />
      </mesh>
      {/* Nguyên liệu đang thái */}
      {ingredient && progress !== null && (
        <group position={[START, 0.965, -0.22]}>
          <Piece id={ingredient} length={remain} />
        </group>
      )}
      {/* Lát đã cắt */}
      {ingredient &&
        progress !== null &&
        Array.from({ length: slices }, (_, i) => (
          <mesh
            key={i}
            position={[cutX + 0.08 + (i % 5) * 0.045, 0.975 + Math.floor(i / 5) * 0.012, -0.22 + ((i * 37) % 7) * 0.015 - 0.045]}
            rotation={[0.2, (i * 0.7) % 1, 0.3]}
            castShadow
          >
            <boxGeometry args={[0.018, 0.04, 0.06]} />
            <Std color={look?.color ?? '#BCAAA4'} rough={0.55} />
          </mesh>
        ))}
      {/* Bát đựng đồ đã sơ chế */}
      <group position={[0.62, 0.93, -0.12]}>
        <mesh castShadow>
          <sphereGeometry args={[0.14, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.25} side={DoubleSide} />
        </mesh>
        {bowl &&
          Array.from({ length: Math.min(12, bowl.count * 3) }, (_, i) => (
            <mesh key={i} position={[Math.cos(i * 2.4) * 0.06, -0.03 + (i % 3) * 0.012, Math.sin(i * 2.4) * 0.06]} castShadow>
              <boxGeometry args={[0.03, 0.02, 0.05]} />
              <Std color={INGREDIENT_LOOK[bowl.id]?.color ?? '#BCAAA4'} />
            </mesh>
          ))}
      </group>
      {/* Tay trái giữ nguyên liệu */}
      <Hand skin={skin} sleeve={sleeve} position={[progress === null ? -0.45 : START + 0.04, 1.0, -0.22]} rotation={[0, 0.5, 0]} />
      {/* Tay phải cầm dao */}
      <group ref={knife}>
        <Hand skin={skin} sleeve={sleeve} position={[0.02, 0, 0.05]} rotation={[0, -0.4, 0]} />
        <mesh position={[-0.02, -0.03, -0.16]} castShadow>
          <boxGeometry args={[0.012, 0.09, 0.26]} />
          <Std color="#CFD8DC" rough={0.15} metal={0.85} />
        </mesh>
        <mesh position={[-0.02, 0.0, 0.0]} rotation-x={Math.PI / 2}>
          <capsuleGeometry args={[0.02, 0.1, 4, 10]} />
          <Std color="#3E2723" />
        </mesh>
      </group>
    </group>
  );
}

// ---------------- Bếp ----------------

function Flames({ on }: { on: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => {
      if (!on) {
        c.scale.setScalar(0.001);
        return;
      }
      c.scale.set(1, 0.8 + Math.sin(clock.elapsedTime * 20 + i * 1.7) * 0.25, 1);
    });
  });
  return (
    <group ref={ref} position={[0, 0.95, -0.3]}>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.17, 0.03, Math.sin(a) * 0.17]}>
            <coneGeometry args={[0.025, 0.08, 8]} />
            <meshBasicMaterial color={i % 2 ? '#FF7043' : '#42A5F5'} transparent opacity={0.85} />
          </mesh>
        );
      })}
    </group>
  );
}

function Puffs({ color, active, count = 5, y = 1.2 }: { color: string; active: boolean; count?: number; y?: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.5 + i / count) % 1;
      c.position.set(Math.sin((t + i) * 5) * 0.08, y + t * 0.5, -0.3 + Math.cos(i * 2) * 0.05);
      c.scale.setScalar(active ? 0.5 + t * 1.2 : 0.001);
      const m = (c as Mesh).material as MeshStandardMaterial;
      m.opacity = active ? 0.45 * (1 - t) : 0;
    });
  });
  return (
    <group ref={ref}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.06, 12, 8]} />
          <meshStandardMaterial color={color} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Bubbles({ color, active }: { color: string; active: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 1.3 + i * 0.37) % 1;
      c.scale.setScalar(active ? Math.sin(t * Math.PI) : 0.001);
    });
  });
  return (
    <group ref={ref} position={[0, 1.13, -0.3]}>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[Math.cos(i * 2.1) * 0.13 * ((i % 3) / 2 + 0.3), 0, Math.sin(i * 2.1) * 0.13 * ((i % 3) / 2 + 0.3)]}>
          <sphereGeometry args={[0.022, 10, 8]} />
          <Std color={color} rough={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Cảnh bếp: nồi trên lửa, thức ăn sủi bọt, tay phải cầm muôi khuấy vòng (nhanh hơn khi chạm).
 * Sắp cháy: thức ăn sẫm lại và bốc khói đen.
 */
export function StoveScene({
  recipeId,
  cooking,
  burnRatio,
  blocked,
  pulse,
  skin,
  sleeve,
}: {
  recipeId: RecipeId | null;
  cooking: boolean;
  /** 0 = vừa chín, 1 = cháy (âm khi chưa chín). */
  burnRatio: number;
  blocked: boolean;
  pulse: PulseRef;
  skin: string;
  sleeve: string;
}) {
  const ladle = useRef<Group>(null);
  const angle = useRef(0);
  const food = useMemo(() => new Color(), []);
  if (recipeId) food.set(FOOD_COLOR[recipeId]).lerp(new Color('#2B1B12'), Math.max(0, Math.min(1, burnRatio * 1.2)));
  const burning = burnRatio > 0.45;

  useFrame((_, dt) => {
    const since = now() - pulse.current;
    const boost = Math.max(0, 1 - since / 500) * 7;
    angle.current += dt * ((recipeId ? 1.2 : 0.3) + boost);
    const l = ladle.current;
    if (l) {
      l.position.set(Math.cos(angle.current) * 0.1, 1.2, -0.3 + Math.sin(angle.current) * 0.08);
      l.rotation.y = -angle.current * 0.3;
    }
  });

  return (
    <group>
      <Kitchen top="#37474F" body="#B0BEC5" />
      {/* Mặt bếp + họng lửa */}
      <mesh position={[0, 0.94, -0.3]} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[0.18, 0.02, 10, 32]} />
        <Std color="#212121" rough={0.4} metal={0.5} />
      </mesh>
      <Flames on={Boolean(recipeId) && !blocked} />
      {/* Nồi */}
      <group position={[0, 0.98, -0.3]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.3, 0.27, 0.24, 36, 1, true]} />
          <meshStandardMaterial color="#90A4AE" roughness={0.3} metalness={0.7} side={DoubleSide} />
        </mesh>
        <mesh position={[0, -0.115, 0]}>
          <cylinderGeometry args={[0.27, 0.27, 0.01, 36]} />
          <Std color="#78909C" rough={0.3} metal={0.7} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.33, 0.07, 0]} rotation-z={Math.PI / 2}>
            <torusGeometry args={[0.04, 0.012, 8, 16, Math.PI]} />
            <Std color="#455A64" rough={0.4} metal={0.6} />
          </mesh>
        ))}
        {recipeId && (
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.285, 0.285, 0.02, 36]} />
            <meshStandardMaterial color={'#' + food.getHexString()} roughness={0.45} />
          </mesh>
        )}
      </group>
      <Bubbles color={recipeId ? '#' + food.getHexString() : '#FFFFFF'} active={cooking && !blocked} />
      <Puffs color="#FFFFFF" active={Boolean(recipeId) && !burning && !blocked} />
      <Puffs color="#212121" active={burning} count={7} />
      {/* Tay trái giữ quai nồi */}
      <Hand skin={skin} sleeve={sleeve} position={[-0.42, 1.03, -0.28]} rotation={[0, 0.9, 0]} />
      {/* Tay phải cầm muôi */}
      <group ref={ladle}>
        <mesh position={[0, -0.08, 0]}>
          <sphereGeometry args={[0.05, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color="#CFD8DC" roughness={0.2} metalness={0.8} side={DoubleSide} />
        </mesh>
        <mesh position={[0.08, 0.04, 0.14]} rotation={[0.9, 0, -0.3]}>
          <cylinderGeometry args={[0.01, 0.01, 0.4, 8]} />
          <Std color="#CFD8DC" rough={0.2} metal={0.8} />
        </mesh>
        <Hand skin={skin} sleeve={sleeve} position={[0.16, 0.14, 0.3]} rotation={[0.3, -0.5, 0]} />
      </group>
    </group>
  );
}

// ---------------- Quầy pha chế ----------------

/** Cảnh quầy: ly thuỷ tinh đầy dần (đồ uống) hoặc đĩa cuốn gỏi; tay cầm bình rót, lắc khi chạm. */
export function CounterScene({
  recipeId,
  drink,
  progress,
  pulse,
  skin,
  sleeve,
}: {
  recipeId: RecipeId | null;
  drink: boolean;
  progress: number;
  pulse: PulseRef;
  skin: string;
  sleeve: string;
}) {
  const jug = useRef<Group>(null);
  useFrame(() => {
    const since = now() - pulse.current;
    const shake = Math.max(0, 1 - since / 300) * Math.sin(now() / 25) * 0.08;
    if (jug.current) {
      jug.current.rotation.z = (recipeId && progress < 1 ? 0.9 : 0.2) + shake;
      jug.current.position.x = 0.2 + shake * 0.3;
    }
  });
  const color = recipeId ? FOOD_COLOR[recipeId] : '#FFFFFF';
  const level = Math.max(0.005, Math.min(1, progress)) * 0.24;
  return (
    <group>
      <Kitchen top="#E0F2F1" body="#4DB6AC" />
      {drink || !recipeId ? (
        <group position={[0, 0.93, -0.25]}>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.12, 0.1, 0.3, 32, 1, true]} />
            <meshStandardMaterial color="#E3F2FD" roughness={0.05} transparent opacity={0.35} side={DoubleSide} />
          </mesh>
          {recipeId && (
            <mesh position={[0, level / 2 + 0.01, 0]}>
              <cylinderGeometry args={[0.1 + level * 0.07, 0.1, level, 32]} />
              <Std color={color} rough={0.2} opacity={0.9} />
            </mesh>
          )}
          {recipeId &&
            [0, 1, 2].map((i) => (
              <mesh key={i} position={[Math.cos(i * 2.1) * 0.05, level + 0.01, Math.sin(i * 2.1) * 0.05]} rotation={[i, i * 2, 0]}>
                <boxGeometry args={[0.045, 0.045, 0.045]} />
                <meshStandardMaterial color="#E1F5FE" roughness={0.05} transparent opacity={0.7} />
              </mesh>
            ))}
          {recipeId && progress < 1 && (
            <mesh position={[0.02, 0.33, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.3, 8]} />
              <Std color={color} opacity={0.8} />
            </mesh>
          )}
        </group>
      ) : (
        <group position={[0, 0.94, -0.25]}>
          <mesh>
            <cylinderGeometry args={[0.28, 0.24, 0.025, 32]} />
            <Std color="#FFFFFF" rough={0.25} />
          </mesh>
          {Array.from({ length: Math.max(1, Math.round(progress * 4)) }, (_, i) => (
            <mesh key={i} position={[-0.15 + i * 0.1, 0.045, 0]} rotation-x={Math.PI / 2} castShadow>
              <capsuleGeometry args={[0.035, 0.16, 8, 14]} />
              <meshStandardMaterial color="#F1F8E9" roughness={0.3} transparent opacity={0.9} />
            </mesh>
          ))}
        </group>
      )}
      {/* Bình rót trong tay phải */}
      <group ref={jug} position={[0.2, 1.38, -0.25]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.07, 0.08, 0.2, 24]} />
          <Std color="#B0BEC5" rough={0.25} metal={0.6} />
        </mesh>
        <Hand skin={skin} sleeve={sleeve} position={[0.1, -0.02, 0.15]} rotation={[0.2, -0.6, 0]} />
      </group>
      <Hand skin={skin} sleeve={sleeve} position={[-0.3, 1.0, -0.2]} rotation={[0, 0.6, 0]} />
    </group>
  );
}
