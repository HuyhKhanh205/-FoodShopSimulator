import { useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { useFrame } from '../../three/fiber';
import type { Incident } from '../../game/types';
import DishModel from './Dish';
import { foodColor } from './looks';

/**
 * Hoạt ảnh sự cố của phục vụ, chạy khoảng 2,5 giây kể từ lúc gắn:
 * - trip: đĩa bay vòng cung về phía trước rồi vỡ — mảnh đĩa văng, vệt thức ăn loang trên sàn;
 * - spill: chùm thức ăn bắn tung lên người khách, vệt bẩn trên áo;
 * - wrong: không có hiệu ứng 3D (khách hiện bong bóng 🤨).
 * `from` = chỗ nhân viên, `to` = chỗ khách (toạ độ ô, tâm ô).
 */
export default function IncidentFx({ incident, from, to }: { incident: Incident; from: [number, number]; to: [number, number] }) {
  const t0 = useRef<number | null>(null);
  const dish = useRef<Group>(null);
  const shards = useRef<Group>(null);
  const splat = useRef<Mesh>(null);
  const splash = useRef<Group>(null);
  const color = foodColor(incident.dish);
  // Hướng bay: từ nhân viên về phía khách.
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.max(0.01, Math.hypot(dx, dz));
  const ux = dx / len;
  const uz = dz / len;

  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current;
    if (incident.kind === 'trip') {
      const fly = Math.min(1, t / 0.55);
      const d = dish.current;
      if (d) {
        // Vòng cung bay 0,9 ô về trước, xoay lộn nhào, chạm đất thì biến mất.
        d.visible = fly < 1;
        d.position.set(from[0] + ux * 0.9 * fly, 0.55 + Math.sin(fly * Math.PI) * 0.45 - fly * 0.5, from[1] + uz * 0.9 * fly);
        d.rotation.set(fly * 5, 0, fly * 3);
      }
      const hit = Math.max(0, t - 0.55);
      const g = shards.current;
      if (g) {
        g.visible = t > 0.55 && t < 2.4;
        g.position.set(from[0] + ux * 0.9, 0, from[1] + uz * 0.9);
        g.children.forEach((c, i) => {
          const a = i * 1.26;
          const r = Math.min(1, hit * 3) * (0.18 + (i % 3) * 0.06);
          c.position.set(Math.cos(a) * r, 0.02 + Math.max(0, Math.sin(Math.min(1, hit * 3) * Math.PI) * 0.12), Math.sin(a) * r);
          c.rotation.set(i, hit * 6 * (i % 2 ? 1 : -1), 0);
        });
      }
      const s = splat.current;
      if (s) {
        s.visible = t > 0.55;
        s.position.set(from[0] + ux * 0.9, 0.012, from[1] + uz * 0.9);
        s.scale.setScalar(Math.min(1, hit * 4));
        (s.material as MeshBasicMaterial).opacity = t > 2 ? Math.max(0, 1 - (t - 2) * 2) : 0.9;
      }
    }
    if (incident.kind === 'spill') {
      const g = splash.current;
      if (g) {
        g.visible = t < 1.6;
        g.position.set(to[0], 0, to[1]);
        g.children.forEach((c, i) => {
          const a = i * 0.9;
          const p = Math.min(1, t / 0.7);
          // Hạt bay từ phía nhân viên tới người khách, rơi xuống.
          c.position.set(-ux * 0.5 * (1 - p) + Math.cos(a) * 0.12 * p, 0.6 + Math.sin(p * Math.PI) * 0.4 - p * 0.15 + (i % 3) * 0.04, -uz * 0.5 * (1 - p) + Math.sin(a) * 0.12 * p);
        });
      }
      const s = splat.current;
      if (s) {
        // Vệt bẩn trên áo khách.
        s.visible = t > 0.6 && t < 3;
        s.position.set(to[0], 0.6, to[1]);
        s.rotation.set(0, Math.atan2(-ux, -uz), 0);
        s.scale.setScalar(0.5);
      }
    }
  });

  if (incident.kind === 'wrong') return null;
  return (
    <group>
      {incident.kind === 'trip' && (
        <>
          <group ref={dish}>
            <DishModel dish={incident.dish} scale={0.9} />
          </group>
          <group ref={shards} visible={false}>
            {Array.from({ length: 7 }, (_, i) => (
              <mesh key={i}>
                <boxGeometry args={[0.07, 0.012, 0.05]} />
                <meshStandardMaterial color={i % 3 === 0 ? color : '#FFFFFF'} roughness={0.3} />
              </mesh>
            ))}
          </group>
          <mesh ref={splat} rotation-x={-Math.PI / 2} visible={false}>
            <circleGeometry args={[0.28, 18]} />
            <meshBasicMaterial color={color} transparent opacity={0.9} />
          </mesh>
        </>
      )}
      {incident.kind === 'spill' && (
        <>
          <group ref={splash}>
            {Array.from({ length: 12 }, (_, i) => (
              <mesh key={i}>
                <sphereGeometry args={[0.03 + (i % 3) * 0.012, 8, 6]} />
                <meshStandardMaterial color={i % 4 === 0 ? '#E3F2FD' : color} roughness={0.3} />
              </mesh>
            ))}
          </group>
          <mesh ref={splat} visible={false}>
            <circleGeometry args={[0.18, 14]} />
            <meshBasicMaterial color={color} transparent opacity={0.85} />
          </mesh>
        </>
      )}
    </group>
  );
}
