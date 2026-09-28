import { useRef } from 'react';
import type { Group, Mesh } from 'three';
import { useFrame } from '../../three/fiber';

/**
 * Mũi tên vàng nảy lên xuống + vòng sáng dưới sàn: chỉ chỗ cần tới tiếp theo (theo nút 👉 Làm tiếp).
 * (x, z): tâm chỗ cần chỉ; `r`: bán kính vòng; `h`: độ cao đầu mũi tên.
 */
export default function GuideArrow({ x, z, r = 0.8, h = 2.1 }: { x: number; z: number; r?: number; h?: number }) {
  const arrow = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (arrow.current) {
      arrow.current.position.y = h + Math.abs(Math.sin(t * 3)) * 0.35;
      arrow.current.rotation.y = t * 1.5;
    }
    if (ring.current) {
      const k = 1 + ((t * 0.8) % 1) * 0.25;
      ring.current.scale.set(k, k, k);
    }
  });
  return (
    <group name="guide-arrow" position={[x, 0, z]}>
      <group ref={arrow}>
        {/* Đầu mũi tên chúc xuống + thân */}
        <mesh rotation-x={Math.PI} position={[0, 0.2, 0]}>
          <coneGeometry args={[0.28, 0.45, 16]} />
          <meshBasicMaterial color="#FFC107" />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.45, 12]} />
          <meshBasicMaterial color="#FFC107" />
        </mesh>
        {/* Viền cam cho dễ thấy trên nền sáng */}
        <mesh rotation-x={Math.PI} position={[0, 0.2, 0]} scale={1.12}>
          <coneGeometry args={[0.28, 0.45, 16]} />
          <meshBasicMaterial color="#E65100" side={1} />
        </mesh>
      </group>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[r * 0.82, r, 32]} />
        <meshBasicMaterial color="#FFD54F" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}
