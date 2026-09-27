import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, DoubleSide, Vector3 } from 'three';
import type { Group, Mesh, MeshStandardMaterial, PerspectiveCamera } from 'three';
import { useFrame, useThree } from '../../three/fiber';
import type { IngredientId, RecipeId } from '../../game/types';
import { foodColor } from '../scene/looks';
import { RECIPES } from '../../game/data';
import { wallTileTexture } from '../scene/textures';
import { Prop } from '../scene/KayProps';

/** Thời điểm (ms, performance.now) của lần chạm gần nhất — cảnh đọc để chạy hoạt ảnh thái/khuấy. */
export type PulseRef = React.MutableRefObject<number>;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function Std({ color, rough = 0.7, metal = 0, opacity }: { color: string; rough?: number; metal?: number; opacity?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={metal} transparent={opacity !== undefined} opacity={opacity ?? 1} />;
}

/** Khoảng cách giữa các bếp trên dãy bếp chung. */
export const STOVE_GAP = 0.82;
/** Bếp trong cảnh chung thu nhỏ lại để vừa nhiều bếp. */
export const STOVE_SCALE = 0.62;
/** Mặt bếp (y) và vị trí hàng bếp (z, phía xa) / thớt (z, phía gần). */
export const TOP_Y = 0.93;
export const STOVE_Z = -0.72;
export const BOARD_Z = 0.36;

/**
 * Camera ngang tầm mắt nhìn chếch xuống mặt bếp; tự lùi xa cho vừa bề rộng `width` và sâu `depth`
 * (điện thoại dọc lùi xa hơn). Chỉ một đèn chính có bóng — nhẹ cho điện thoại.
 */
export function EyeRig({
  width,
  depth = 1.2,
  target = [0, 0.93, -0.28],
  tilt = [0, 0.95, 0.75],
  shadows = true,
}: {
  width: number;
  depth?: number;
  target?: [number, number, number];
  tilt?: [number, number, number];
  shadows?: boolean;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const vfov = 50;
    const hfov = 2 * Math.atan(Math.tan((vfov * Math.PI) / 360) * aspect);
    const dist = Math.max(1.6, (width / 2) / Math.tan(hfov / 2), (depth / 2) / Math.tan((vfov * Math.PI) / 360));
    const t = new Vector3(...target);
    const dir = new Vector3(...tilt).normalize();
    camera.fov = vfov;
    camera.position.copy(t).addScaledVector(dir, dist);
    camera.lookAt(t);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, width, depth, target[0], target[1], target[2], tilt[0], tilt[1], tilt[2]]);
  return (
    <group>
      <hemisphereLight args={['#FFF6E5', '#6D4C41', 1.1]} />
      <directionalLight
        position={[1.2, 3.2, 2]}
        intensity={1.5}
        castShadow={shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
    </group>
  );
}

/** Mặt bếp chung: phía xa là dải inox đặt bếp, phía gần là mặt gỗ đặt thớt. */
export function KitchenCounter({ width }: { width: number }) {
  const w = width + 0.6;
  return (
    <group>
      <mesh position={[0, 0.45, -0.25]} receiveShadow>
        <boxGeometry args={[w, 0.9, 1.9]} />
        <Std color="#8D6E63" />
      </mesh>
      {/* Dải inox phía xa */}
      <mesh position={[0, TOP_Y - 0.005, -0.72]} receiveShadow>
        <boxGeometry args={[w + 0.02, 0.03, 0.9]} />
        <Std color="#B0BEC5" rough={0.3} metal={0.6} />
      </mesh>
      {/* Mặt đá phía gần */}
      <mesh position={[0, TOP_Y - 0.005, 0.2]} receiveShadow>
        <boxGeometry args={[w + 0.02, 0.03, 0.96]} />
        <Std color="#ECEFF1" rough={0.35} />
      </mesh>
      {/* Gờ ngăn hai phần */}
      <mesh position={[0, TOP_Y + 0.012, -0.27]}>
        <boxGeometry args={[w + 0.02, 0.02, 0.03]} />
        <Std color="#78909C" rough={0.3} metal={0.6} />
      </mesh>
    </group>
  );
}

/** Tường ốp gạch phía sau cả dãy bếp. */
export function Backdrop({ from, to, z = 0 }: { from: number; to: number; z?: number }) {
  const width = to - from;
  const wallTex = useMemo(() => {
    const t = wallTileTexture('#E0F2F1', '#B0BEC5').clone();
    t.repeat.set(Math.round(width * 1.6), 3);
    t.needsUpdate = true;
    return t;
  }, [width]);
  return (
    <group position={[(from + to) / 2, 0, z]}>
      <mesh position={[0, 1.8, -1.04]}>
        <planeGeometry args={[width, 1.8]} />
        <meshStandardMaterial map={wallTex} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.45, -1.2]}>
        <planeGeometry args={[width, 0.9]} />
        <Std color="#FFF8E1" />
      </mesh>
    </group>
  );
}

/** Mặt bếp cho màn quầy pha chế. */
export function Kitchen({ top = '#ECEFF1', body = '#8D6E63' }: { top?: string; body?: string }) {
  return (
    <group>
      <mesh position={[0, 0.45, -0.3]} receiveShadow>
        <boxGeometry args={[3.2, 0.9, 1.5]} />
        <Std color={body} />
      </mesh>
      <mesh position={[0, 0.915, -0.3]} receiveShadow>
        <boxGeometry args={[3.24, 0.03, 1.54]} />
        <Std color={top} rough={0.35} />
      </mesh>
      {/* Tay nắm tủ dưới */}
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, 0.75, 0.46]}>
          <boxGeometry args={[0.18, 0.02, 0.02]} />
          <Std color="#CFD8DC" rough={0.2} metal={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------- Hạt bắn ----------------

/** Vụn thức ăn văng ra mỗi nhát dao. */
function Crumbs({ pulse, color, origin, active }: { pulse: PulseRef; color: string; origin: [number, number, number]; active: boolean }) {
  const ref = useRef<Group>(null);
  const seen = useRef(0);
  const vel = useRef<number[][]>([]);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    if (active && pulse.current !== seen.current) {
      seen.current = pulse.current;
      vel.current = g.children.map((_, i) => [Math.cos(i * 1.7) * 0.6, 0.9 + (i % 3) * 0.3, Math.sin(i * 2.3) * 0.4]);
      g.children.forEach((c) => c.position.set(0, 0, 0));
    }
    g.children.forEach((c, i) => {
      const v = vel.current[i];
      if (!v) {
        c.visible = false;
        return;
      }
      c.visible = c.position.y > -0.05;
      v[1] -= 4 * dt;
      c.position.x += v[0] * dt;
      c.position.y += v[1] * dt;
      c.position.z += v[2] * dt;
      c.rotation.x += dt * 8;
    });
  });
  return (
    <group ref={ref} position={origin}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} visible={false}>
          <boxGeometry args={[0.02, 0.02, 0.02]} />
          <Std color={color} />
        </mesh>
      ))}
    </group>
  );
}

/** Giọt dầu / nước dùng bắn lên từ nồi đang sôi. */
function OilSplash({ y = 1.12 }: { y?: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 1.6 + i * 0.29) % 1;
      const a = i * 2.1;
      c.position.set(Math.cos(a) * (0.08 + t * 0.2), y + Math.sin(t * Math.PI) * 0.22, -0.3 + Math.sin(a) * (0.06 + t * 0.15));
      c.scale.setScalar(t < 0.95 ? 1 : 0.001);
    });
  });
  return (
    <group ref={ref}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.012, 6, 5]} />
          <meshBasicMaterial color="#FFE082" />
        </mesh>
      ))}
    </group>
  );
}

// ---------------- Thớt ----------------

/** Màu chủ đạo của nguyên liệu (dùng cho vụn văng khi thái). */
const INGREDIENT_COLOR: Partial<Record<IngredientId, string>> = {
  thit_bo: '#A63D2F',
  thit_heo: '#E8998A',
  ga: '#F3CFA0',
  tom: '#FF8A65',
  rau: '#9CCC65',
  hanh: '#66BB6A',
};

const FULL = 0.5;

/** Ba chỉ heo: các lớp nạc – mỡ – bì xếp chồng. */
function PorkBelly({ length }: { length: number }) {
  const layers: [string, number][] = [
    ['#D9786A', 0.025],
    ['#FFF3E6', 0.012],
    ['#E8998A', 0.02],
    ['#FFF6EC', 0.01],
    ['#F0D2A8', 0.007],
  ];
  let y = 0;
  return (
    <group>
      {layers.map(([c, h], i) => {
        const cy = y + h / 2;
        y += h;
        return (
          <mesh key={i} position={[length / 2, cy, 0]} castShadow receiveShadow>
            <boxGeometry args={[length, h, 0.2 - i * 0.004]} />
            <Std color={c} rough={i % 2 ? 0.35 : 0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Một cọng hành lá: gốc trắng có rễ, thân xanh nhạt, lá xanh đậm. */
function ScallionStalk({ length, z, tilt = 0 }: { length: number; z: number; tilt?: number }) {
  const white = Math.min(length, 0.1);
  const light = Math.min(Math.max(0, length - white), 0.12);
  const dark = Math.max(0, length - white - light);
  return (
    <group position={[0, 0.016, z]} rotation-y={tilt}>
      {/* Rễ */}
      {[-1, 0, 1].map((k) => (
        <mesh key={k} position={[-0.012, 0, k * 0.006]} rotation-z={Math.PI / 2 + k * 0.4}>
          <cylinderGeometry args={[0.0015, 0.001, 0.025, 4]} />
          <Std color="#EFEBE9" />
        </mesh>
      ))}
      <mesh position={[white / 2, 0, 0]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.013, 0.015, white, 10]} />
        <Std color="#F5F5F0" rough={0.4} />
      </mesh>
      {light > 0 && (
        <mesh position={[white + light / 2, 0, 0]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.011, 0.013, light, 10]} />
          <Std color="#9CCC65" rough={0.45} />
        </mesh>
      )}
      {dark > 0 && (
        <mesh position={[white + light + dark / 2, 0, 0]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.007, 0.011, dark, 10]} />
          <Std color="#388E3C" rough={0.5} />
        </mesh>
      )}
    </group>
  );
}

/** Con tôm: thân cong nhiều đốt, đuôi xoè, râu dài. Bóc vỏ thì nhạt màu, không râu. */
function Shrimp({ peeled = false, scale = 1 }: { peeled?: boolean; scale?: number }) {
  const shell = peeled ? '#FFCCBC' : '#FF7043';
  return (
    <group scale={scale}>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 1.1;
        const r = 0.018 - i * 0.0018;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.045, r, Math.sin(a) * 0.045]} scale={[1, 0.85, 1.25]} castShadow>
            <sphereGeometry args={[r, 10, 8]} />
            <Std color={i % 2 ? shell : peeled ? '#FFE0D6' : '#FF8A65'} rough={0.35} />
          </mesh>
        );
      })}
      {/* Đuôi */}
      {[-1, 1].map((k) => (
        <mesh key={k} position={[Math.cos(Math.PI * 1.15) * 0.045, 0.006, Math.sin(Math.PI * 1.15) * 0.045 + k * 0.008]} rotation={[Math.PI / 2, 0, k * 0.5]} scale={[1, 1, 0.3]}>
          <coneGeometry args={[0.012, 0.03, 6]} />
          <Std color={peeled ? '#FF8A65' : '#E64A19'} rough={0.4} />
        </mesh>
      ))}
      {!peeled && (
        <group position={[0.05, 0.02, -0.004]}>
          <mesh position={[0.012, 0, 0]} scale={[1.3, 0.9, 1]}>
            <sphereGeometry args={[0.02, 10, 8]} />
            <Std color="#F4511E" rough={0.4} />
          </mesh>
          <mesh position={[0.02, 0.012, 0.012]}>
            <sphereGeometry args={[0.004, 6, 5]} />
            <Std color="#212121" />
          </mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[0.07, 0.01, k * 0.01]} rotation={[k * 0.2, 0, Math.PI / 2 - 0.2]}>
              <cylinderGeometry args={[0.0012, 0.0012, 0.12, 4]} />
              <Std color="#BF360C" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/** Mô hình KayKit chưa nạp được thì dùng khối tự vẽ đơn giản. */
function Blob({ color, size = 0.12 }: { color: string; size?: number }) {
  return (
    <mesh position={[0, size * 0.35, 0]} scale={[1, 0.5, 0.8]} castShadow>
      <sphereGeometry args={[size, 14, 10]} />
      <Std color={color} rough={0.55} />
    </mesh>
  );
}

/**
 * Nguyên liệu nguyên (chưa thái) trên thớt; `remain` = độ dài còn lại (0..FULL), mép trái cố định ở x = 0.
 */
function WholeIngredient({ id, remain }: { id: IngredientId; remain: number }) {
  if (remain <= 0.01) return null;
  const k = remain / FULL;
  switch (id) {
    case 'thit_bo':
      return (
        <group scale={[k, 1, 1]}>
          <Prop name="food_ingredient_steak" scale={0.46} position={[FULL / 2, 0.017, 0]} fallback={<group position={[FULL / 2, 0, 0]}><Blob color="#A63D2F" size={0.24} /></group>} />
        </group>
      );
    case 'thit_heo':
      return <PorkBelly length={remain} />;
    case 'ga':
      return (
        <group scale={[k, 1, 1]}>
          <Prop name="food_ingredient_ham" scale={0.34} position={[FULL / 2, 0.14, 0]} fallback={<group position={[FULL / 2, 0, 0]}><Blob color="#F3CFA0" size={0.2} /></group>} />
        </group>
      );
    case 'rau':
      return (
        <group scale={[k, 1, 1]}>
          <Prop name="food_ingredient_lettuce" scale={0.3} position={[FULL / 2, 0.005, 0]} fallback={<group position={[FULL / 2, 0, 0]}><Blob color="#9CCC65" size={0.22} /></group>} />
        </group>
      );
    case 'hanh':
      return (
        <group>
          {[-0.05, -0.025, 0, 0.025, 0.05].map((z, i) => (
            <ScallionStalk key={z} length={remain} z={z} tilt={(i - 2) * 0.03} />
          ))}
        </group>
      );
    case 'tom': {
      const n = Math.max(1, Math.ceil(k * 3));
      return (
        <group>
          {Array.from({ length: n }, (_, i) => (
            <group key={i} position={[0.08 + i * 0.13, 0, (i % 2) * 0.05 - 0.02]} rotation-y={i * 0.6}>
              <Shrimp scale={1.3} />
            </group>
          ))}
        </group>
      );
    }
    default:
      return (
        <mesh position={[remain / 2, 0.035, 0]} rotation-z={Math.PI / 2} scale={[0.55, 1, 1]} castShadow>
          <capsuleGeometry args={[0.065, Math.max(0.01, remain - 0.13), 8, 16]} />
          <Std color="#BCAAA4" rough={0.55} />
        </mesh>
      );
  }
}

/** Đống nguyên liệu đã thái; `amount` 0..1 quyết định độ to của đống. */
function ChoppedPile({ id, amount }: { id: IngredientId; amount: number }) {
  if (amount <= 0.01) return null;
  const a = Math.min(1, amount);
  switch (id) {
    case 'thit_bo':
      return <Prop name="food_ingredient_steak_pieces" scale={0.12 + a * 0.2} fallback={<Blob color="#A63D2F" size={0.04 + a * 0.06} />} />;
    case 'rau':
      return <Prop name="food_ingredient_lettuce_chopped" scale={0.07 + a * 0.12} fallback={<Blob color="#9CCC65" size={0.04 + a * 0.08} />} />;
    case 'thit_heo':
    case 'ga': {
      const n = Math.max(1, Math.round(a * 10));
      return (
        <group>
          {Array.from({ length: n }, (_, i) => (
            <group key={i} position={[Math.cos(i * 2.4) * 0.05 * ((i % 4) / 4 + 0.3), 0.015 + Math.floor(i / 5) * 0.02, Math.sin(i * 2.4) * 0.05 * ((i % 4) / 4 + 0.3)]} rotation={[0.2 * i, i * 0.9, 0.1]}>
              {id === 'thit_heo' ? (
                <>
                  <mesh castShadow>
                    <boxGeometry args={[0.035, 0.012, 0.03]} />
                    <Std color="#D9786A" />
                  </mesh>
                  <mesh position={[0, 0.01, 0]}>
                    <boxGeometry args={[0.035, 0.008, 0.03]} />
                    <Std color="#FFF3E6" rough={0.35} />
                  </mesh>
                </>
              ) : (
                <mesh castShadow scale={[1, 0.7, 0.9]}>
                  <sphereGeometry args={[0.02, 8, 6]} />
                  <Std color="#F3CFA0" rough={0.5} />
                </mesh>
              )}
            </group>
          ))}
        </group>
      );
    }
    case 'hanh': {
      const n = Math.max(2, Math.round(a * 16));
      return (
        <group>
          {Array.from({ length: n }, (_, i) => (
            <mesh
              key={i}
              position={[Math.cos(i * 2.4) * 0.05 * ((i % 5) / 5 + 0.2), 0.006 + Math.floor(i / 8) * 0.008, Math.sin(i * 2.4) * 0.05 * ((i % 5) / 5 + 0.2)]}
              rotation={[Math.PI / 2 + (i % 3) * 0.3, 0, i]}
            >
              <torusGeometry args={[0.01, 0.004, 5, 10]} />
              <Std color={i % 4 === 0 ? '#F5F5F0' : i % 2 ? '#43A047' : '#9CCC65'} />
            </mesh>
          ))}
        </group>
      );
    }
    case 'tom': {
      const n = Math.max(1, Math.round(a * 3));
      return (
        <group>
          {Array.from({ length: n }, (_, i) => (
            <group key={i} position={[(i - 1) * 0.05, i * 0.01, (i % 2) * 0.03]} rotation-y={i * 1.3}>
              <Shrimp peeled scale={0.9} />
            </group>
          ))}
        </group>
      );
    }
    default:
      return <Blob color="#BCAAA4" size={0.03 + a * 0.05} />;
  }
}

/**
 * Cảnh thớt: chỉ có con dao bổ xuống mỗi lần chạm; nguyên liệu nguyên ngắn dần,
 * đống đã thái to dần bên phải; thái xong thì vào bát.
 */
export function BoardScene({
  ingredient,
  progress,
  bowl,
  pulse,
  active = true,
}: {
  ingredient: IngredientId | null;
  /** 0..1 khi đang sơ chế, null khi rảnh. */
  progress: number | null;
  /** Số phần đã sơ chế của nguyên liệu vừa thái (hiện trong bát). */
  bowl: { id: IngredientId; count: number } | null;
  pulse: PulseRef;
  /** Trạm đang được chọn (mới phản ứng khi chạm). */
  active?: boolean;
}) {
  const knife = useRef<Group>(null);
  const START = -0.38;
  const remain = progress === null ? 0 : FULL * (1 - progress);
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

  const color = (ingredient && INGREDIENT_COLOR[ingredient]) ?? '#BCAAA4';
  return (
    <group>
      {/* Thớt gỗ có vân */}
      <mesh position={[0, 0.945, -0.25]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.035, 0.6]} />
        <Std color="#C8A27A" rough={0.8} />
      </mesh>
      {[-0.18, -0.05, 0.1, 0.22].map((z) => (
        <mesh key={z} position={[0, 0.9635, -0.25 + z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.98, 0.006]} />
          <Std color="#B08A62" />
        </mesh>
      ))}
      <mesh position={[0.43, 0.965, -0.48]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.02, 0.035, 16]} />
        <Std color="#8D6E63" />
      </mesh>
      {/* Nguyên liệu đang thái */}
      {ingredient && progress !== null && (
        <group position={[START, 0.963, -0.22]}>
          <WholeIngredient id={ingredient} remain={remain} />
        </group>
      )}
      {/* Đống đã thái */}
      {ingredient && progress !== null && (
        <group position={[Math.min(0.38, cutX + 0.2), 0.963, -0.2]}>
          <ChoppedPile id={ingredient} amount={progress} />
        </group>
      )}
      {/* Bát đựng đồ đã sơ chế */}
      <group position={[0.66, 0.93, -0.12]}>
        <mesh castShadow>
          <sphereGeometry args={[0.14, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.25} side={DoubleSide} />
        </mesh>
        {bowl && bowl.count > 0 && (
          <group position={[0, -0.06, 0]}>
            <ChoppedPile id={bowl.id} amount={Math.min(1, 0.35 + bowl.count * 0.15)} />
          </group>
        )}
      </group>
      {/* Chỉ có con dao (không vẽ tay) */}
      <group ref={knife}>
        <group position={[0, 0.02, -0.2]} rotation={[0, Math.PI / 2, Math.PI]}>
          <Prop
            name="knife"
            scale={0.3}
            position={[0, 0.06, 0]}
            fallback={
              <group>
                <mesh position={[0, -0.03, 0]} castShadow>
                  <boxGeometry args={[0.26, 0.09, 0.012]} />
                  <Std color="#CFD8DC" rough={0.15} metal={0.85} />
                </mesh>
                <mesh position={[0.18, 0.0, 0]} rotation-z={Math.PI / 2}>
                  <capsuleGeometry args={[0.02, 0.1, 4, 10]} />
                  <Std color="#3E2723" />
                </mesh>
              </group>
            }
          />
        </group>
      </group>
      <Crumbs pulse={pulse} color={color} origin={[cutX + 0.05, 0.99, -0.22]} active={active && progress !== null} />
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

function Bubbles({ color, active, y = 1.13 }: { color: string; active: boolean; y?: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 1.3 + i * 0.37) % 1;
      c.scale.setScalar(active ? Math.sin(t * Math.PI) : 0.001);
    });
  });
  return (
    <group ref={ref} position={[0, y, -0.3]}>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[Math.cos(i * 2.1) * 0.13 * ((i % 3) / 2 + 0.3), 0, Math.sin(i * 2.1) * 0.13 * ((i % 3) / 2 + 0.3)]}>
          <sphereGeometry args={[0.022, 10, 8]} />
          <Std color={color} rough={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/** Món chiên / nướng dùng chảo, còn lại dùng nồi. */
const PAN_RECIPES: RecipeId[] = ['bun_cha', 'banh_mi_trung', 'com_chien_trung', 'com_chien_tom', 'banh_mi_bo', 'banh_mi_thit', 'com_tam'];

const tmp = new Color();
/** Màu chuyển dần: sống → chín (cook 0..1) → cháy (burn 0..1). */
function cookColor(raw: string, cooked: string, cook: number, burn: number) {
  tmp.set(raw).lerp(new Color(cooked), Math.max(0, Math.min(1, cook)));
  tmp.lerp(new Color('#2B1B12'), Math.max(0, Math.min(1, burn * 1.2)));
  return '#' + tmp.getHexString();
}

/** Thức ăn trong nồi / chảo, đổi màu theo độ chín. Mặt thức ăn ở y = 0. */
function PotFood({ recipeId, cook, burn }: { recipeId: RecipeId; cook: number; burn: number }) {
  switch (recipeId) {
    case 'pho_bo':
      return (
        <group>
          <mesh>
            <cylinderGeometry args={[0.285, 0.285, 0.02, 36]} />
            <meshStandardMaterial color={cookColor('#C9A36A', '#E8C27A', cook, burn)} roughness={0.12} transparent opacity={0.93} />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} position={[Math.cos(i * 1.1) * 0.06, 0.012, Math.sin(i * 1.1) * 0.06]} rotation={[Math.PI / 2, 0, i]}>
              <torusGeometry args={[0.09 + (i % 3) * 0.03, 0.008, 5, 22, Math.PI * 1.1]} />
              <Std color={cookColor('#FFFDF5', '#FFF3DA', cook, burn)} rough={0.4} />
            </mesh>
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[Math.cos(i * 1.05 + 0.3) * 0.15, 0.018, Math.sin(i * 1.05 + 0.3) * 0.15]} rotation={[-Math.PI / 2 + 0.1, 0, i]} scale={[1, 0.65, 1]}>
              <circleGeometry args={[0.055, 14]} />
              <Std color={cookColor('#B8342A', '#7B4A3A', cook, burn)} rough={0.55} />
            </mesh>
          ))}
          {cook > 0.75 &&
            Array.from({ length: 14 }, (_, i) => (
              <mesh key={i} position={[Math.cos(i * 2.39) * 0.2 * ((i % 4) / 4 + 0.2), 0.024, Math.sin(i * 2.39) * 0.2 * ((i % 4) / 4 + 0.2)]} rotation-x={Math.PI / 2}>
                <torusGeometry args={[0.012, 0.005, 5, 10]} />
                <Std color={i % 3 ? '#43A047' : '#9CCC65'} />
              </mesh>
            ))}
        </group>
      );
    case 'com_ga':
      return (
        <group>
          <mesh scale={[1, 0.25, 1]}>
            <sphereGeometry args={[0.28, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Std color={cookColor('#EDE7D9', '#FFFBEF', cook, burn)} rough={0.95} />
          </mesh>
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} position={[Math.cos(i * 1.26) * 0.13, 0.06, Math.sin(i * 1.26) * 0.13]} rotation={[0, i * 1.26, Math.PI / 2]} castShadow>
              <capsuleGeometry args={[0.035, 0.08, 6, 12]} />
              <Std color={cookColor('#F2B8A0', '#D98E3A', cook, burn)} rough={0.45} />
            </mesh>
          ))}
        </group>
      );
    case 'bun_cha':
      return (
        <group>
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2;
            const col = cookColor('#D98C8C', '#6D3B1F', cook, burn);
            return (
              <group key={i} position={[Math.cos(a) * 0.12, 0.02, Math.sin(a) * 0.12]}>
                <mesh scale={[1, 0.45, 1]} castShadow>
                  <sphereGeometry args={[0.055, 14, 10]} />
                  <Std color={col} rough={0.7} />
                </mesh>
                {/* Vệt nướng */}
                {cook > 0.4 &&
                  [-0.02, 0.02].map((z) => (
                    <mesh key={z} position={[0, 0.024, z]} rotation={[-Math.PI / 2, 0, 0.5]}>
                      <planeGeometry args={[0.08, 0.008]} />
                      <Std color="#2B1B12" />
                    </mesh>
                  ))}
              </group>
            );
          })}
        </group>
      );
    case 'banh_mi_trung':
      return (
        <group>
          {[-0.09, 0.09].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh scale={[1, 0.12, 1]}>
                <sphereGeometry args={[0.1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial
                  color={cookColor('#F2F2EE', '#FFFFFF', cook, burn)}
                  roughness={0.4}
                  transparent
                  opacity={0.55 + Math.min(1, cook) * 0.45}
                />
              </mesh>
              <mesh position={[0.01, 0.015, 0]} scale={[1, 0.6, 1]}>
                <sphereGeometry args={[0.035, 14, 10]} />
                <Std color={cookColor('#FFB300', '#FFA000', cook, burn)} rough={0.2} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case 'com_chien_trung':
    case 'com_chien_tom':
      // Cơm chiên đảo trong chảo: cơm vàng dần, hành xanh, tôm cam.
      return (
        <group>
          <mesh scale={[1, 0.2, 1]}>
            <sphereGeometry args={[0.24, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Std color={cookColor('#F4F1E8', '#F2C94C', cook, burn)} rough={0.9} />
          </mesh>
          {Array.from({ length: 10 }, (_, i) => (
            <mesh key={i} position={[Math.cos(i * 2.4) * 0.14 * ((i % 3) / 3 + 0.4), 0.045, Math.sin(i * 2.4) * 0.14 * ((i % 3) / 3 + 0.4)]}>
              {recipeId === 'com_chien_tom' && i % 3 === 0 ? <torusGeometry args={[0.025, 0.012, 6, 12, Math.PI * 1.3]} /> : <sphereGeometry args={[0.012, 6, 5]} />}
              <Std color={recipeId === 'com_chien_tom' && i % 3 === 0 ? cookColor('#FFCCBC', '#FF7043', cook, burn) : '#43A047'} />
            </mesh>
          ))}
        </group>
      );
    case 'banh_mi_bo':
    case 'banh_mi_thit':
    case 'com_tam':
      // Thịt áp chảo: miếng thịt sống hồng chuyển nâu.
      return (
        <group>
          {Array.from({ length: 4 }, (_, i) => (
            <mesh key={i} position={[Math.cos(i * 1.6) * 0.11, 0.015, Math.sin(i * 1.6) * 0.11]} rotation-y={i} scale={[1.4, 0.3, 0.9]} castShadow>
              <sphereGeometry args={[0.05, 14, 10]} />
              <Std color={cookColor(recipeId === 'banh_mi_bo' ? '#B8342A' : '#E8998A', recipeId === 'banh_mi_bo' ? '#6D3B1F' : '#A0522D', cook, burn)} rough={0.6} />
            </mesh>
          ))}
        </group>
      );
    default:
      if (RECIPES[recipeId]?.kind === 'quai_di')
        // Món quái dị sôi sùng sục màu xanh tím.
        return (
          <group>
            <mesh>
              <cylinderGeometry args={[0.285, 0.285, 0.02, 36]} />
              <Std color={cookColor('#9C27B0', '#8BC34A', cook, burn)} rough={0.2} />
            </mesh>
            {Array.from({ length: 8 }, (_, i) => (
              <mesh key={i} position={[Math.cos(i * 2.4) * 0.15 * ((i % 3) / 3 + 0.3), 0.02, Math.sin(i * 2.4) * 0.15 * ((i % 3) / 3 + 0.3)]}>
                <sphereGeometry args={[0.02 + (i % 3) * 0.01, 10, 8]} />
                <Std color={i % 2 ? '#CDDC39' : '#7E57C2'} rough={0.2} />
              </mesh>
            ))}
          </group>
        );
      return (
        <mesh>
          <cylinderGeometry args={[0.285, 0.285, 0.02, 36]} />
          <Std color={cookColor(foodColor(recipeId), foodColor(recipeId), cook, burn)} rough={0.45} />
        </mesh>
      );
  }
}

/**
 * Cảnh bếp: nồi hoặc chảo trên lửa, thức ăn chín dần đổi màu, muôi tự khuấy (nhanh hơn khi chạm).
 * Sắp cháy: thức ăn sẫm lại và bốc khói đen.
 */
export function StoveScene({
  recipeId,
  cooking,
  cookRatio = 0,
  burnRatio,
  blocked,
  pulse,
}: {
  recipeId: RecipeId | null;
  cooking: boolean;
  /** 0..1 tiến độ chín. */
  cookRatio?: number;
  /** 0 = vừa chín, 1 = cháy (âm khi chưa chín). */
  burnRatio: number;
  blocked: boolean;
  pulse: PulseRef;
}) {
  const ladle = useRef<Group>(null);
  const angle = useRef(0);
  const pan = recipeId ? PAN_RECIPES.includes(recipeId) : false;
  const surface = pan ? 0.99 : 1.07;
  const burning = burnRatio > 0.45;
  const steamColor = recipeId ? cookColor(foodColor(recipeId), foodColor(recipeId), 1, burnRatio) : '#FFFFFF';

  useFrame((_, dt) => {
    const since = now() - pulse.current;
    const boost = Math.max(0, 1 - since / 500) * 7;
    angle.current += dt * ((recipeId ? 1.2 : 0.3) + boost);
    const l = ladle.current;
    if (l) {
      l.position.set(Math.cos(angle.current) * 0.1, surface + 0.13, -0.3 + Math.sin(angle.current) * 0.08);
      l.rotation.y = -angle.current * 0.3;
    }
  });

  return (
    <group>
      {/* Mặt bếp inox tối + họng lửa + kiềng */}
      <mesh position={[0, 0.932, -0.3]} receiveShadow>
        <boxGeometry args={[0.72, 0.012, 0.72]} />
        <Std color="#37474F" rough={0.35} metal={0.4} />
      </mesh>
      <mesh position={[0, 0.94, -0.3]} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[0.18, 0.02, 10, 32]} />
        <Std color="#212121" rough={0.4} metal={0.5} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI) / 2 + 0.78) * 0.22, 0.95, -0.3 + Math.sin((i * Math.PI) / 2 + 0.78) * 0.22]} rotation-y={-(i * Math.PI) / 2 - 0.78}>
          <boxGeometry args={[0.12, 0.02, 0.02]} />
          <Std color="#263238" rough={0.4} metal={0.6} />
        </mesh>
      ))}
      <Flames on={Boolean(recipeId) && !blocked} />
      {pan ? (
        <group position={[0, 0.96, -0.3]}>
          <Prop
            name="pan_A"
            scale={0.52}
            rotation={Math.PI / 2}
            fallback={
              <mesh castShadow position={[0, 0.03, 0]}>
                <cylinderGeometry args={[0.28, 0.25, 0.06, 36, 1, true]} />
                <meshStandardMaterial color="#546E7A" roughness={0.3} metalness={0.7} side={DoubleSide} />
              </mesh>
            }
          />
          {recipeId && (
            <group position={[0, surface - 0.96, 0]} scale={0.85}>
              <PotFood recipeId={recipeId} cook={cookRatio} burn={burnRatio} />
            </group>
          )}
        </group>
      ) : (
        <group position={[0, 0.98, -0.3]}>
          <Prop
            name="pot_A"
            scale={0.42}
            position={[0, -0.12, 0]}
            fallback={
              <mesh castShadow>
                <cylinderGeometry args={[0.3, 0.27, 0.24, 36, 1, true]} />
                <meshStandardMaterial color="#90A4AE" roughness={0.3} metalness={0.7} side={DoubleSide} />
              </mesh>
            }
          />
          <mesh position={[0, -0.115, 0]}>
            <cylinderGeometry args={[0.27, 0.27, 0.01, 36]} />
            <Std color="#78909C" rough={0.3} metal={0.7} />
          </mesh>
          {recipeId && (
            <group position={[0, surface - 0.98, 0]}>
              <PotFood recipeId={recipeId} cook={cookRatio} burn={burnRatio} />
            </group>
          )}
        </group>
      )}
      <Bubbles color={steamColor} active={cooking && !blocked && !pan} y={surface + 0.02} />
      <Puffs color="#FFFFFF" active={Boolean(recipeId) && !burning && !blocked} y={surface + 0.1} />
      <Puffs color="#212121" active={burning} count={7} y={surface + 0.1} />
      {recipeId && !blocked && cooking && <OilSplash y={surface + 0.03} />}
      {/* Chỉ có cái muôi / xẻng tự đảo (không vẽ tay) */}
      <group ref={ladle}>
        {pan ? (
          <mesh position={[0, -0.1, 0]} rotation-x={-0.3}>
            <boxGeometry args={[0.1, 0.008, 0.08]} />
            <Std color="#CFD8DC" rough={0.2} metal={0.8} />
          </mesh>
        ) : (
          <mesh position={[0, -0.08, 0]}>
            <sphereGeometry args={[0.05, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color="#CFD8DC" roughness={0.2} metalness={0.8} side={DoubleSide} />
          </mesh>
        )}
        <mesh position={[0.08, 0.04, 0.14]} rotation={[0.9, 0, -0.3]}>
          <cylinderGeometry args={[0.01, 0.01, 0.4, 8]} />
          <Std color={pan ? '#5D4037' : '#CFD8DC'} rough={0.2} metal={pan ? 0 : 0.8} />
        </mesh>
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
}: {
  recipeId: RecipeId | null;
  drink: boolean;
  progress: number;
  pulse: PulseRef;
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
  const color = recipeId ? foodColor(recipeId) : '#FFFFFF';
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
          {/* Bánh tráng đang cuốn: thấy rau, bún, tôm bên trong lớp bánh trong */}
          {Array.from({ length: Math.max(1, Math.round(progress * 4)) }, (_, i) => (
            <group key={i} position={[-0.15 + i * 0.1, 0.045, 0]}>
              <mesh rotation-x={Math.PI / 2} castShadow>
                <capsuleGeometry args={[0.035, 0.16, 8, 14]} />
                <meshStandardMaterial color="#F5F5F0" roughness={0.2} transparent opacity={0.65} />
              </mesh>
              <mesh rotation-x={Math.PI / 2} scale={[0.75, 0.6, 1]}>
                <capsuleGeometry args={[0.03, 0.13, 6, 10]} />
                <Std color="#81C784" />
              </mesh>
              <mesh position={[0, -0.012, 0]} rotation-x={Math.PI / 2} scale={[0.7, 0.5, 1]}>
                <capsuleGeometry args={[0.03, 0.12, 6, 10]} />
                <Std color="#FFFDF5" />
              </mesh>
              {[-0.05, 0.03].map((z) => (
                <group key={z} position={[0, 0.02, z]} rotation-y={Math.PI / 2}>
                  <Shrimp peeled scale={0.55} />
                </group>
              ))}
            </group>
          ))}
        </group>
      )}
      {/* Bình rót trong tay phải */}
      <group ref={jug} position={[0.2, 1.38, -0.25]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.07, 0.08, 0.2, 24]} />
          <Std color="#B0BEC5" rough={0.25} metal={0.6} />
        </mesh>
      </group>
    </group>
  );
}
