import { useRef } from 'react';
import type { Group } from 'three';
import { useFrame } from '../../three/fiber';
import type { Look } from './looks';

/**
 * Nhân vật low-poly (cao ~1 ô). Gốc toạ độ ở giữa hai bàn chân, mặt hướng +z.
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
  const phase = useRef(Math.random() * 10);
  const holding = carrying.length > 0;

  useFrame((_, dt) => {
    const moving = isMoving ? isMoving() : false;
    phase.current += dt * (moving ? 11 : 2);
    const swing = moving ? Math.sin(phase.current) * 0.7 : 0;
    const idle = Math.sin(phase.current) * 0.015;
    if (body.current) body.current.position.y = (seated ? 0.1 : 0) + (moving ? Math.abs(Math.sin(phase.current)) * 0.04 : idle);
    if (!seated) {
      if (legL.current) legL.current.rotation.x = swing;
      if (legR.current) legR.current.rotation.x = -swing;
    }
    const armBase = holding ? -1.25 : seated ? -0.5 : 0;
    if (armL.current) armL.current.rotation.x = armBase + (holding ? 0 : -swing * 0.8);
    if (armR.current) armR.current.rotation.x = armBase + (holding ? 0 : swing * 0.8);
  });

  const cast = shadows;
  return (
    <group ref={body}>
      {/* Chân */}
      {[
        [legL, -0.085],
        [legR, 0.085],
      ].map(([ref, x], i) => (
        <group key={i} ref={ref as React.RefObject<Group>} position={[x as number, 0.34, 0]} rotation={[seated ? -1.45 : 0, 0, 0]}>
          <mesh position={[0, -0.16, 0]} castShadow={cast}>
            <boxGeometry args={[0.12, 0.34, 0.14]} />
            <meshLambertMaterial color={look.pants} />
          </mesh>
          <mesh position={[0, -0.32, 0.03]} castShadow={cast}>
            <boxGeometry args={[0.13, 0.06, 0.19]} />
            <meshLambertMaterial color="#3E2723" />
          </mesh>
        </group>
      ))}
      {/* Thân */}
      <mesh position={[0, 0.52, 0]} castShadow={cast}>
        <cylinderGeometry args={[0.17, 0.2, 0.38, 10]} />
        <meshLambertMaterial color={look.shirt} />
      </mesh>
      {look.apron && (
        <mesh position={[0, 0.47, 0.17]} rotation={[-0.08, 0, 0]} castShadow={cast}>
          <boxGeometry args={[0.28, 0.34, 0.03]} />
          <meshLambertMaterial color={look.apron} />
        </mesh>
      )}
      {/* Tay */}
      {[
        [armL, -0.24],
        [armR, 0.24],
      ].map(([ref, x], i) => (
        <group key={i} ref={ref as React.RefObject<Group>} position={[x as number, 0.68, 0]}>
          <mesh position={[0, -0.14, 0]} castShadow={cast}>
            <boxGeometry args={[0.09, 0.3, 0.1]} />
            <meshLambertMaterial color={look.shirt} />
          </mesh>
          <mesh position={[0, -0.31, 0]}>
            <sphereGeometry args={[0.055, 8, 6]} />
            <meshLambertMaterial color={look.skin} />
          </mesh>
        </group>
      ))}
      {/* Món đang cầm */}
      {carrying.slice(0, 2).map((color, i) => (
        <group key={i} position={[carrying.length > 1 ? (i === 0 ? -0.16 : 0.16) : 0, 0.62, 0.36]}>
          <mesh castShadow={cast}>
            <cylinderGeometry args={[0.15, 0.12, 0.03, 14]} />
            <meshLambertMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <sphereGeometry args={[0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshLambertMaterial color={color} />
          </mesh>
        </group>
      ))}
      {/* Đầu */}
      <mesh position={[0, 0.88, 0]} castShadow={cast}>
        <sphereGeometry args={[0.175, 14, 10]} />
        <meshLambertMaterial color={look.skin} />
      </mesh>
      <mesh position={[0, 0.94, -0.02]} rotation={[-0.25, 0, 0]}>
        <sphereGeometry args={[0.185, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
        <meshLambertMaterial color={look.hair} />
      </mesh>
      {[-0.065, 0.065].map((x) => (
        <mesh key={x} position={[x, 0.9, 0.158]}>
          <sphereGeometry args={[0.028, 6, 5]} />
          <meshBasicMaterial color="#1B1B1B" />
        </mesh>
      ))}
      <mesh position={[0, 0.83, 0.17]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.08, 5]} />
        <meshBasicMaterial color="#8D4B3B" />
      </mesh>
      {/* Mũ */}
      {look.hat === 'chef' && (
        <group position={[0, 1.04, 0]}>
          <mesh castShadow={cast}>
            <cylinderGeometry args={[0.13, 0.13, 0.12, 12]} />
            <meshLambertMaterial color={look.hatColor ?? '#FFFFFF'} />
          </mesh>
          <mesh position={[0, 0.1, 0]} castShadow={cast}>
            <sphereGeometry args={[0.16, 12, 8]} />
            <meshLambertMaterial color={look.hatColor ?? '#FFFFFF'} />
          </mesh>
        </group>
      )}
      {look.hat === 'helmet' && (
        <mesh position={[0, 0.95, 0]} castShadow={cast}>
          <sphereGeometry args={[0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshLambertMaterial color={look.hatColor ?? '#2E7D32'} />
        </mesh>
      )}
      {look.hat === 'cap' && (
        <group position={[0, 0.99, 0]}>
          <mesh>
            <sphereGeometry args={[0.18, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshLambertMaterial color={look.hatColor ?? '#FFB300'} />
          </mesh>
          <mesh position={[0, 0, 0.17]}>
            <boxGeometry args={[0.22, 0.02, 0.14]} />
            <meshLambertMaterial color={look.hatColor ?? '#FFB300'} />
          </mesh>
        </group>
      )}
    </group>
  );
}
