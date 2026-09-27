import { DoubleSide } from 'three';
import type { RecipeId } from '../../game/types';

/**
 * Mã món để vẽ: id món, thêm "!" ở cuối nếu món bị cháy.
 * Dùng chuỗi để truyền gọn qua các component (món trên tay, trên bàn, trên quầy).
 */
export type DishKey = string;
export const dishKey = (recipeId: RecipeId, burnt = false): DishKey => (burnt ? `${recipeId}!` : recipeId);
export function parseDish(key: DishKey): { recipeId: RecipeId; burnt: boolean } {
  const burnt = key.endsWith('!');
  return { recipeId: (burnt ? key.slice(0, -1) : key) as RecipeId, burnt };
}

const BURNT = '#2B1B12';

function M({ c, r = 0.6, o, burnt }: { c: string; r?: number; o?: number; burnt?: boolean }) {
  return (
    <meshStandardMaterial
      color={burnt ? BURNT : c}
      roughness={r}
      transparent={o !== undefined}
      opacity={o ?? 1}
      side={o !== undefined ? DoubleSide : undefined}
    />
  );
}

/** Bát sứ trắng viền xanh (miệng bát ở y = 0.09). */
function Bowl({ rim = '#1E88E5' }: { rim?: string }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} castShadow>
        <sphereGeometry args={[0.14, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2.6]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.25} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.094, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.137, 0.006, 6, 28]} />
        <M c={rim} r={0.3} />
      </mesh>
      <mesh position={[0, 0.005, 0]}>
        <cylinderGeometry args={[0.06, 0.065, 0.012, 20]} />
        <M c="#FAFAFA" r={0.3} />
      </mesh>
    </group>
  );
}

function Plate({ r = 0.17 }: { r?: number }) {
  return (
    <group>
      <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r * 0.8, 0.022, 28]} />
        <M c="#FFFFFF" r={0.25} />
      </mesh>
      <mesh position={[0, 0.024, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[r * 0.93, 0.004, 6, 28]} />
        <M c="#EF9A9A" r={0.3} />
      </mesh>
    </group>
  );
}

/** Hành lá thái nhỏ rắc lên món. */
function Scallion({ n = 7, spread = 0.09, y = 0 }: { n?: number; spread?: number; y?: number }) {
  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[Math.cos(i * 2.39) * spread * ((i % 3) / 3 + 0.35), 0, Math.sin(i * 2.39) * spread * ((i % 3) / 3 + 0.35)]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.009, 0.004, 5, 10]} />
          <M c={i % 3 ? '#43A047' : '#9CCC65'} />
        </mesh>
      ))}
    </group>
  );
}

function Ice({ n = 3, y, spread = 0.035 }: { n?: number; y: number; spread?: number }) {
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[Math.cos(i * 2.1) * spread, y, Math.sin(i * 2.1) * spread]} rotation={[i, i * 2, 0.3]}>
          <boxGeometry args={[0.035, 0.035, 0.035]} />
          <meshStandardMaterial color="#E1F5FE" roughness={0.05} transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  );
}

function Glass({ fill, cream, burnt }: { fill: string; cream?: string; burnt?: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.075, 0.062, 0.2, 24, 1, true]} />
        <meshStandardMaterial color="#E3F2FD" roughness={0.05} transparent opacity={0.35} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.075, 0]}>
        <cylinderGeometry args={[0.07, 0.062, 0.14, 24]} />
        <M c={fill} r={0.15} o={0.9} burnt={burnt} />
      </mesh>
      {cream && (
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.063, 0.062, 0.03, 24]} />
          <M c={cream} r={0.3} />
        </mesh>
      )}
      <Ice y={0.15} />
      <mesh position={[0.03, 0.17, 0]} rotation-z={-0.2}>
        <cylinderGeometry args={[0.006, 0.006, 0.22, 6]} />
        <M c="#E53935" r={0.4} />
      </mesh>
    </group>
  );
}

/** Ổ bánh mì kẹp nhân (màu nhân tuỳ món). */
function Baguette({ fill, greens = true, burnt }: { fill: string; greens?: boolean; burnt?: boolean }) {
  return (
    <group>
      <Plate r={0.15} />
      <mesh position={[0, 0.06, 0]} rotation-z={Math.PI / 2} scale={[1, 1, 0.8]} castShadow>
        <capsuleGeometry args={[0.04, 0.16, 8, 14]} />
        <M c="#D9A25F" r={0.7} burnt={burnt} />
      </mesh>
      <mesh position={[0, 0.09, 0.012]} rotation-z={Math.PI / 2}>
        <capsuleGeometry args={[0.018, 0.14, 6, 10]} />
        <M c={fill} r={0.5} burnt={burnt} />
      </mesh>
      {greens &&
        [-0.05, 0, 0.05].map((x) => (
          <mesh key={x} position={[x, 0.1, 0.02]} rotation={[0.5, 0, 0.3]}>
            <circleGeometry args={[0.014, 8]} />
            <M c="#43A047" />
          </mesh>
        ))}
    </group>
  );
}

/** Đĩa cơm (màu cơm tuỳ món: trắng, cơm chiên vàng) + phần ăn kèm. */
function RicePlate({ rice, burnt, children }: { rice: string; burnt?: boolean; children?: React.ReactNode }) {
  return (
    <group>
      <Plate />
      <mesh position={[-0.03, 0.025, 0]} scale={[1, 0.6, 1]} castShadow>
        <sphereGeometry args={[0.09, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <M c={rice} r={0.9} burnt={burnt} />
      </mesh>
      {children}
    </group>
  );
}

function FriedEgg({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.04, 16]} />
        <M c="#FFFFFF" r={0.4} />
      </mesh>
      <mesh position={[0, 0.006, 0]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[0.016, 10, 8]} />
        <M c="#FFB300" r={0.3} />
      </mesh>
    </group>
  );
}

/** Mô hình món ăn chi tiết, rộng khoảng 0.3 đơn vị, đặt trên mặt phẳng y = 0. */
export default function DishModel({ dish, scale = 1 }: { dish: DishKey; scale?: number }) {
  const { recipeId, burnt } = parseDish(dish);
  let body: React.ReactNode;
  switch (recipeId) {
    case 'pho_bo':
      body = (
        <group>
          <Bowl />
          <mesh position={[0, 0.075, 0]}>
            <cylinderGeometry args={[0.125, 0.1, 0.01, 24]} />
            <M c="#E8C27A" r={0.15} o={0.92} burnt={burnt} />
          </mesh>
          {/* Sợi phở */}
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[Math.cos(i * 1.6) * 0.03, 0.082, Math.sin(i * 1.6) * 0.03]} rotation={[Math.PI / 2, 0, i]}>
              <torusGeometry args={[0.05 + i * 0.008, 0.006, 5, 18, Math.PI * 1.2]} />
              <M c="#FFF8E7" r={0.4} burnt={burnt} />
            </mesh>
          ))}
          {/* Thịt bò tái */}
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.cos(i * 2.1 + 0.4) * 0.06, 0.088, Math.sin(i * 2.1 + 0.4) * 0.06]} rotation={[-Math.PI / 2 + 0.15, 0, i]} scale={[1, 0.7, 1]}>
              <circleGeometry args={[0.035, 12]} />
              <M c="#8D4A3A" r={0.55} burnt={burnt} />
            </mesh>
          ))}
          <Scallion y={0.092} />
          <mesh position={[0.07, 0.095, -0.04]} rotation={[-Math.PI / 2, 0, 0.6]} scale={[1, 0.45, 1]}>
            <circleGeometry args={[0.03, 10]} />
            <M c="#2E7D32" burnt={burnt} />
          </mesh>
        </group>
      );
      break;
    case 'com_ga':
      body = (
        <group>
          <Plate />
          <mesh position={[-0.04, 0.025, 0]} scale={[1, 0.65, 1]} castShadow>
            <sphereGeometry args={[0.085, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <M c="#FFFBEF" r={0.9} burnt={burnt} />
          </mesh>
          {[0, 1].map((i) => (
            <mesh key={i} position={[0.075, 0.045, -0.035 + i * 0.07]} rotation={[0, 0.3 + i, Math.PI / 2]} castShadow>
              <capsuleGeometry args={[0.022, 0.06, 6, 10]} />
              <M c="#D98E3A" r={0.45} burnt={burnt} />
            </mesh>
          ))}
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[-0.1 + i * 0.03, 0.03, 0.1]} rotation={[-Math.PI / 2 + 0.3, 0, 0]}>
              <circleGeometry args={[0.018, 12]} />
              <M c={i === 1 ? '#E53935' : '#7CB342'} r={0.4} />
            </mesh>
          ))}
          <Scallion n={4} spread={0.05} y={0.06} />
        </group>
      );
      break;
    case 'bun_cha':
      body = (
        <group>
          <Bowl rim="#E53935" />
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.12, 0.1, 0.01, 24]} />
            <M c="#D9A066" r={0.2} o={0.92} burnt={burnt} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.cos(i * 2.1) * 0.055, 0.082, Math.sin(i * 2.1) * 0.055]} scale={[1, 0.5, 1]} castShadow>
              <sphereGeometry args={[0.03, 12, 8]} />
              <M c="#6D3B1F" r={0.7} burnt={burnt} />
            </mesh>
          ))}
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.cos(i * 2.1 + 1) * 0.08, 0.078, Math.sin(i * 2.1 + 1) * 0.08]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.014, 10]} />
              <M c={i % 2 ? '#FF8A65' : '#FFF59D'} r={0.4} />
            </mesh>
          ))}
        </group>
      );
      break;
    case 'banh_mi_trung':
      body = (
        <group>
          <Plate r={0.15} />
          <mesh position={[0, 0.06, 0]} rotation-z={Math.PI / 2} scale={[1, 1, 0.8]} castShadow>
            <capsuleGeometry args={[0.04, 0.16, 8, 14]} />
            <M c="#D9A25F" r={0.7} burnt={burnt} />
          </mesh>
          {/* Nhân: trứng + rau thơm lộ ra ở khe bánh */}
          <mesh position={[0, 0.09, 0.012]} rotation-z={Math.PI / 2}>
            <capsuleGeometry args={[0.018, 0.14, 6, 10]} />
            <M c="#FFD54F" r={0.5} burnt={burnt} />
          </mesh>
          {[-0.05, 0, 0.05].map((x) => (
            <mesh key={x} position={[x, 0.1, 0.02]} rotation={[0.5, 0, 0.3]}>
              <circleGeometry args={[0.014, 8]} />
              <M c="#43A047" />
            </mesh>
          ))}
          <mesh position={[0.07, 0.1, 0.018]} rotation={[0.4, 0, 0]}>
            <circleGeometry args={[0.012, 8]} />
            <M c="#E53935" />
          </mesh>
        </group>
      );
      break;
    case 'goi_cuon':
      body = (
        <group>
          <Plate />
          {[-0.06, 0, 0.06].map((x) => (
            <group key={x} position={[x, 0.045, -0.02]}>
              <mesh rotation-x={Math.PI / 2} castShadow>
                <capsuleGeometry args={[0.024, 0.11, 8, 12]} />
                <meshStandardMaterial color="#F5F5F0" roughness={0.2} transparent opacity={0.72} />
              </mesh>
              <mesh position={[0, 0.008, 0]} rotation-x={Math.PI / 2} scale={[0.75, 0.6, 1]}>
                <capsuleGeometry args={[0.02, 0.09, 6, 10]} />
                <M c="#81C784" />
              </mesh>
              <mesh position={[0, 0.016, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.013, 0.006, 6, 10, Math.PI]} />
                <M c="#FF8A65" r={0.4} />
              </mesh>
            </group>
          ))}
          <mesh position={[0.02, 0.035, 0.1]}>
            <cylinderGeometry args={[0.035, 0.028, 0.025, 16]} />
            <M c="#FFFFFF" r={0.3} />
          </mesh>
          <mesh position={[0.02, 0.045, 0.1]}>
            <cylinderGeometry args={[0.03, 0.03, 0.006, 16]} />
            <M c="#8D5524" r={0.3} />
          </mesh>
        </group>
      );
      break;
    case 'tra_da':
      body = <Glass fill="#C8812F" burnt={burnt} />;
      break;
    case 'ca_phe_sua':
      body = <Glass fill="#5D3A26" cream="#E9D3AE" burnt={burnt} />;
      break;
    case 'banh_mi_pate':
      body = <Baguette fill="#8D5A3B" greens={false} burnt={burnt} />;
      break;
    case 'banh_mi_bo':
      body = <Baguette fill="#7B4A3A" burnt={burnt} />;
      break;
    case 'banh_mi_thit':
      body = <Baguette fill="#E39A8A" burnt={burnt} />;
      break;
    case 'com_chien_trung':
      body = (
        <RicePlate rice="#F2C94C" burnt={burnt}>
          <Scallion n={6} spread={0.06} y={0.06} />
          <FriedEgg position={[0.08, 0.03, 0.05]} />
        </RicePlate>
      );
      break;
    case 'com_chien_tom':
      body = (
        <RicePlate rice="#F2C94C" burnt={burnt}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0.07, 0.05, -0.05 + i * 0.05]} rotation={[Math.PI / 2, 0, i]}>
              <torusGeometry args={[0.018, 0.009, 6, 12, Math.PI * 1.3]} />
              <M c="#FF7043" r={0.4} burnt={burnt} />
            </mesh>
          ))}
          <Scallion n={5} spread={0.05} y={0.06} />
        </RicePlate>
      );
      break;
    case 'com_tam':
      body = (
        <RicePlate rice="#FFFBEF" burnt={burnt}>
          <mesh position={[0.07, 0.035, -0.02]} rotation-y={0.4} scale={[1.3, 0.35, 0.8]} castShadow>
            <sphereGeometry args={[0.05, 14, 10]} />
            <M c="#A0522D" r={0.6} burnt={burnt} />
          </mesh>
          <FriedEgg position={[0.02, 0.04, 0.08]} />
          {[0, 1].map((i) => (
            <mesh key={i} position={[-0.1 + i * 0.03, 0.03, 0.1]} rotation-x={-Math.PI / 2 + 0.3}>
              <circleGeometry args={[0.016, 12]} />
              <M c="#7CB342" r={0.4} />
            </mesh>
          ))}
        </RicePlate>
      );
      break;
    case 'tra_sua':
      body = (
        <group>
          <Glass fill="#D7B899" burnt={burnt} />
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos(i * 1.3) * 0.035, 0.018, Math.sin(i * 1.3) * 0.035]}>
              <sphereGeometry args={[0.011, 8, 6]} />
              <M c="#2B1B12" r={0.2} />
            </mesh>
          ))}
        </group>
      );
      break;
    default:
      body = (
        <group>
          <Plate />
          <mesh position={[0, 0.03, 0]}>
            <sphereGeometry args={[0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <M c="#BCAAA4" burnt={burnt} />
          </mesh>
        </group>
      );
  }
  return <group scale={scale}>{body}</group>;
}
