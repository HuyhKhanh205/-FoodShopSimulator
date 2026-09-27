import { useRef } from 'react';
import { DoubleSide } from 'three';
import type { Group } from 'three';
import { useFrame } from '../../three/fiber';
import type { Look } from './looks';

/** Vật liệu mịn, hơi mờ như vải/da (đổ bóng mềm thay vì mặt phẳng). */
function Mat({ color, rough = 0.78, opacity }: { color: string; rough?: number; opacity?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={rough}
      metalness={0}
      transparent={opacity !== undefined}
      opacity={opacity ?? 1}
    />
  );
}

/**
 * Nhân vật bo tròn (cao ~1 ô). Gốc toạ độ ở giữa hai bàn chân, mặt hướng +z.
 * `isMoving` được đọc mỗi khung hình để vung tay chân khi đi.
 */
export default function Character({
  look,
  isMoving,
  seated = false,
  carrying = [],
  shadows = true,
}: {
  look: Look;
  isMoving?: () => boolean;
  seated?: boolean;
  /** Màu thức ăn của các món đang cầm (tối đa 2). */
  carrying?: string[];
  shadows?: boolean;
}) {
  const body = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const head = useRef<Group>(null);
  const phase = useRef(Math.random() * 10);
  const holding = carrying.length > 0;

  useFrame((_, dt) => {
    const moving = isMoving ? isMoving() : false;
    phase.current += dt * (moving ? 11 : 2);
    const swing = moving ? Math.sin(phase.current) * 0.65 : 0;
    const breathe = Math.sin(phase.current) * 0.012;
    if (body.current) {
      body.current.position.y = (seated ? 0.1 : 0) + (moving ? Math.abs(Math.sin(phase.current)) * 0.035 : breathe);
      body.current.rotation.z = moving ? Math.sin(phase.current) * 0.04 : 0;
    }
    if (head.current) head.current.rotation.y = moving ? 0 : Math.sin(phase.current * 0.35) * 0.18;
    if (!seated) {
      if (legL.current) legL.current.rotation.x = swing;
      if (legR.current) legR.current.rotation.x = -swing;
    }
    const armBase = holding ? -1.25 : seated ? -0.5 : 0;
    if (armL.current) {
      armL.current.rotation.x = armBase + (holding ? 0 : -swing * 0.8);
      armL.current.rotation.z = holding ? 0.15 : -0.08;
    }
    if (armR.current) {
      armR.current.rotation.x = armBase + (holding ? 0 : swing * 0.8);
      armR.current.rotation.z = holding ? -0.15 : 0.08;
    }
  });

  const cast = shadows;
  const f = look.female;
  const shoulder = f ? 0.18 : 0.2;
  return (
    <group ref={body}>
      {/* Chân + giày */}
      {[
        [legL, -0.075],
        [legR, 0.075],
      ].map(([ref, x], i) => (
        <group key={i} ref={ref as React.RefObject<Group>} position={[x as number, 0.36, 0]} rotation={[seated ? -1.45 : 0, 0, 0]}>
          <mesh position={[0, -0.14, 0]} castShadow={cast}>
            <capsuleGeometry args={[0.058, 0.2, 6, 12]} />
            <Mat color={look.pants} />
          </mesh>
          <mesh position={[0, -0.31, 0.035]} rotation-x={Math.PI / 2} castShadow={cast}>
            <capsuleGeometry args={[0.052, 0.07, 6, 12]} />
            <Mat color="#3E2723" rough={0.5} />
          </mesh>
        </group>
      ))}
      {/* Hông */}
      <mesh position={[0, 0.38, 0]} scale={[f ? 1.12 : 1, 0.62, 0.8]} castShadow={cast}>
        <sphereGeometry args={[0.16, 20, 14]} />
        <Mat color={look.pants} />
      </mesh>
      {/* Thân */}
      <mesh position={[0, 0.55, 0]} scale={[f ? 0.95 : 1.05, 1, 0.8]} castShadow={cast}>
        <capsuleGeometry args={[0.15, 0.17, 8, 18]} />
        <Mat color={look.shirt} />
      </mesh>
      {look.apron && (
        <mesh position={[0, 0.49, 0]} scale={[f ? 0.98 : 1.08, 1, 0.84]}>
          <cylinderGeometry args={[0.158, 0.172, 0.34, 20, 1, true, -0.95, 1.9]} />
          <meshStandardMaterial color={look.apron} roughness={0.8} side={DoubleSide} />
        </mesh>
      )}
      {/* Tay */}
      {[
        [armL, -shoulder],
        [armR, shoulder],
      ].map(([ref, x], i) => (
        <group key={i} ref={ref as React.RefObject<Group>} position={[x as number, 0.66, 0]}>
          <mesh position={[0, -0.13, 0]} castShadow={cast}>
            <capsuleGeometry args={[0.048, 0.2, 6, 12]} />
            <Mat color={look.shirt} />
          </mesh>
          <mesh position={[0, -0.29, 0]}>
            <sphereGeometry args={[0.05, 14, 10]} />
            <Mat color={look.skin} rough={0.6} />
          </mesh>
        </group>
      ))}
      {/* Món đang cầm */}
      {carrying.slice(0, 2).map((color, i) => (
        <group key={i} position={[carrying.length > 1 ? (i === 0 ? -0.16 : 0.16) : 0, 0.62, 0.36]}>
          <mesh castShadow={cast}>
            <cylinderGeometry args={[0.15, 0.12, 0.03, 20]} />
            <Mat color="#FFFFFF" rough={0.3} />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <sphereGeometry args={[0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Mat color={color} rough={0.6} />
          </mesh>
        </group>
      ))}
      {/* Cổ + đầu */}
      <mesh position={[0, 0.715, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.07, 12]} />
        <Mat color={look.skin} rough={0.6} />
      </mesh>
      <group ref={head}>
        <mesh position={[0, 0.87, 0]} scale={[1, 1.02, 0.96]} castShadow={cast}>
          <sphereGeometry args={[0.17, 28, 20]} />
          <Mat color={look.skin} rough={0.6} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={`ear${sx}`} position={[sx * 0.168, 0.865, 0]} scale={[0.6, 1, 0.8]}>
            <sphereGeometry args={[0.035, 12, 8]} />
            <Mat color={look.skin} rough={0.6} />
          </mesh>
        ))}
        {/* Mắt: lòng trắng + con ngươi + lông mày */}
        {[-0.058, 0.058].map((x) => (
          <group key={`eye${x}`} position={[x, 0.885, 0.148]}>
            <mesh scale={[1, 1.15, 0.5]}>
              <sphereGeometry args={[0.03, 14, 10]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.002, 0.012]}>
              <sphereGeometry args={[0.018, 12, 8]} />
              <meshStandardMaterial color="#1B1B1B" roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.042, 0.008]} rotation-z={Math.PI / 2 + (x > 0 ? -0.15 : 0.15)}>
              <capsuleGeometry args={[0.008, 0.035, 4, 6]} />
              <Mat color={look.hair} />
            </mesh>
          </group>
        ))}
        {[-0.098, 0.098].map((x) => (
          <mesh key={`cheek${x}`} position={[x, 0.835, 0.13]} scale={[1, 0.7, 0.4]}>
            <sphereGeometry args={[0.028, 10, 8]} />
            <Mat color="#F48FB1" opacity={0.55} />
          </mesh>
        ))}
        <mesh position={[0, 0.815, 0.16]} rotation={[0.2, 0, Math.PI]}>
          <torusGeometry args={[0.028, 0.006, 6, 14, Math.PI]} />
          <meshStandardMaterial color="#8D4B3B" roughness={0.5} />
        </mesh>
        <Hair style={look.hairStyle ?? 'short'} color={look.hair} cast={cast} />
        {look.glasses && (
          <group position={[0, 0.885, 0.165]}>
            {[-0.058, 0.058].map((x) => (
              <mesh key={x} position={[x, 0, 0]}>
                <torusGeometry args={[0.042, 0.008, 8, 20]} />
                <meshStandardMaterial color="#212121" roughness={0.3} />
              </mesh>
            ))}
            <mesh>
              <capsuleGeometry args={[0.006, 0.03, 4, 6]} />
              <meshStandardMaterial color="#212121" />
            </mesh>
          </group>
        )}
        <Hat look={look} cast={cast} />
      </group>
    </group>
  );
}

export function Hat({ look, cast }: { look: Look; cast: boolean }) {
  const color = look.hatColor;
  switch (look.hat) {
    case 'chef':
      return (
        <group position={[0, 1.03, 0]}>
          <mesh castShadow={cast}>
            <cylinderGeometry args={[0.135, 0.135, 0.11, 24]} />
            <Mat color={color ?? '#FFFFFF'} />
          </mesh>
          {[
            [0, 0.11, 0, 0.14],
            [-0.08, 0.09, 0, 0.1],
            [0.08, 0.09, 0, 0.1],
          ].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]} castShadow={cast}>
              <sphereGeometry args={[r, 20, 14]} />
              <Mat color={color ?? '#FFFFFF'} />
            </mesh>
          ))}
        </group>
      );
    case 'helmet':
      return (
        <mesh position={[0, 0.93, 0]} castShadow={cast}>
          <sphereGeometry args={[0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Mat color={color ?? '#2E7D32'} rough={0.35} />
        </mesh>
      );
    case 'conical':
      return (
        <mesh position={[0, 1.08, 0]} castShadow={cast}>
          <coneGeometry args={[0.36, 0.22, 32]} />
          <Mat color={color ?? '#E6C98A'} />
        </mesh>
      );
    case 'bandana':
      return (
        <group position={[0, 0.96, 0]}>
          <mesh rotation={[-0.2, 0, 0]}>
            <sphereGeometry args={[0.185, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.3]} />
            <Mat color={color ?? '#C62828'} />
          </mesh>
          <mesh position={[0, -0.02, -0.18]} rotation={[0.6, 0, 0]}>
            <coneGeometry args={[0.055, 0.13, 10]} />
            <Mat color={color ?? '#C62828'} />
          </mesh>
        </group>
      );
    case 'cap':
      return (
        <group position={[0, 0.98, 0]}>
          <mesh>
            <sphereGeometry args={[0.178, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Mat color={color ?? '#FFB300'} />
          </mesh>
          <mesh position={[0, 0, 0.16]} scale={[1, 0.15, 0.8]}>
            <cylinderGeometry args={[0.12, 0.12, 0.1, 20, 1, false, -Math.PI / 2, Math.PI]} />
            <Mat color={color ?? '#FFB300'} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

/** Các kiểu tóc bo tròn. */
function Hair({ style, color, cast }: { style: string; color: string; cast: boolean }) {
  if (style === 'bald') return null;
  const cap = (
    <mesh position={[0, 0.9, -0.012]} rotation={[-0.3, 0, 0]} castShadow={cast}>
      <sphereGeometry args={[0.18, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2.05]} />
      <Mat color={color} rough={0.9} />
    </mesh>
  );
  if (style === 'spiky') {
    return (
      <group>
        {cap}
        {[
          [0, 0.13, 0.02],
          [-0.08, 0.1, 0.03],
          [0.08, 0.1, 0.03],
          [-0.05, 0.1, -0.08],
          [0.05, 0.1, -0.08],
          [0, 0.08, 0.1],
        ].map(([x, y, z], i) => (
          <mesh key={i} position={[x, 0.92 + y, z - 0.02]} rotation={[z * 4, 0, -x * 5]}>
            <coneGeometry args={[0.045, 0.12, 10]} />
            <Mat color={color} rough={0.9} />
          </mesh>
        ))}
      </group>
    );
  }
  if (style === 'long') {
    return (
      <group>
        {cap}
        <mesh position={[0, 0.77, -0.1]} scale={[1.15, 1, 0.55]} castShadow={cast}>
          <capsuleGeometry args={[0.14, 0.2, 8, 16]} />
          <Mat color={color} rough={0.9} />
        </mesh>
      </group>
    );
  }
  if (style === 'bun') {
    return (
      <group>
        {cap}
        <mesh position={[0, 1.0, -0.16]} castShadow={cast}>
          <sphereGeometry args={[0.078, 18, 12]} />
          <Mat color={color} rough={0.9} />
        </mesh>
      </group>
    );
  }
  return cap;
}
