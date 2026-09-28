import { useMemo, useRef } from 'react';
import { DataTexture, NearestFilter, Plane, RGBAFormat, Raycaster, RepeatWrapping, Vector2, Vector3 } from 'three';
import type { Group } from 'three';
import { useFrame, useThree } from '../../three/fiber';
import { ELEVATION } from './camera';
import { viewRadius } from './cull';
import { ShopSign } from './KayProps';
import { MProp, Mini } from './SceneryProps';
import type { PropSpot, ViewFocus } from './SceneryProps';
import { checkerTileTexture } from './textures';

/**
 * Bộ phong cảnh dùng chung cho quán, chợ và khu phố (mô hình Kenney CC0 trong market.glb):
 * mặt đất / vỉa hè / đường, sông có ghe, xe chạy, người đi bộ, chó mèo gà, nhà phố nhuộm màu.
 * Vật tĩnh vẽ theo lô bằng `PropInstances` (ẩn / "bật" theo khoảng cách như Farm Together).
 */

export const SKY = '#CFE8F0';

/** Màu nhuộm nhà (nhà Kenney gốc trắng + mái xanh). */
export const HOUSE_TINTS = ['#FFD9E3', '#FFF0B3', '#D6F0FF', '#E3F5CF', '#FFE0CC', '#E8DDF7', '#FFF7C2', '#D4F2EC'];
/** Nhà Kenney dùng làm nhà phố (thứ tự xoay vòng cho khỏi lặp). */
export const HOUSE_MODELS = ['s_building_type_a', 's_building_type_d', 's_building_type_h', 's_building_type_k', 's_building_type_n', 's_building_type_t', 'c_building_c', 'c_building_e'];

/** Một căn nhà phố: mặt tiền quay về `face` (+1 = nam, −1 = bắc), rộng khoảng `size` ô. */
export function house(i: number, x: number, z: number, face: 1 | -1, size = 4, model?: string): PropSpot {
  return { name: model ?? HOUSE_MODELS[i % HOUSE_MODELS.length], x, z, size, rot: face === 1 ? 0 : Math.PI, tint: HOUSE_TINTS[i % HOUSE_TINTS.length] };
}

/**
 * Tâm nhìn cho việc ẩn vật xa (~4 lần / giây): điểm mặt đất giữa màn hình + bán kính nhìn.
 * `__noCull` (chỉ để đo) thì hiện hết.
 */
export function useViewFocus(saver: boolean) {
  const { camera, gl, scene } = useThree();
  const focus = useRef<ViewFocus>({ x: 6, z: 5, R: 999, valid: false });
  const ray = useMemo(() => new Raycaster(), []);
  const ground = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new Vector3(), []);
  const center = useMemo(() => new Vector2(0, 0), []);
  const acc = useRef(1);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const g = globalThis as { __noCull?: boolean; __drawCalls?: number; __scene?: unknown };
    g.__drawCalls = gl.info.render.calls;
    g.__scene = scene;
    ray.setFromCamera(center, camera);
    const p = ray.ray.intersectPlane(ground, hit);
    const cam = camera as unknown as { left: number; right: number; top: number; bottom: number; zoom: number };
    const halfW = (cam.right - cam.left) / 2 / (cam.zoom || 1);
    const halfH = (cam.top - cam.bottom) / 2 / (cam.zoom || 1);
    focus.current = { x: p?.x ?? 6, z: p?.z ?? 5, R: viewRadius(halfW, halfH, ELEVATION, saver), valid: Boolean(p) && !g.__noCull };
  });
  return focus;
}

/** Vạch đứt giữa đường: một ảnh lặp (1 lần vẽ). */
function dashTexture(repeat: number) {
  const d = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const t = new DataTexture(d, 5, 1, RGBAFormat);
  t.wrapS = RepeatWrapping;
  t.magFilter = NearestFilter;
  t.repeat.set(repeat, 1);
  t.needsUpdate = true;
  return t;
}

/** Mặt phẳng nằm (cỏ, nước…). */
export function Flat({ x, z, w, d, color, y = -0.02 }: { x: number; z: number; w: number; d: number; color: string; y?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, y, z]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

/** Vỉa hè lát gạch chạy theo trục x. */
export function Sidewalk({ x, z, w, d }: { x: number; z: number; w: number; d: number }) {
  const tex = useMemo(() => {
    const t = checkerTileTexture('#E8DCCB', '#D9CAB3').clone();
    t.repeat.set(w / 2, d / 2);
    t.needsUpdate = true;
    return t;
  }, [w, d]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, -0.015, z]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshLambertMaterial map={tex} />
    </mesh>
  );
}

/** Đường nhựa theo trục x (tâm z, rộng d) có vạch đứt giữa. */
export function Road({ x, z, w, d = 4 }: { x: number; z: number; w: number; d?: number }) {
  const dash = useMemo(() => dashTexture(w / 4), [w]);
  return (
    <group>
      <Flat x={x} z={z} w={w} d={d} color="#5F6368" y={-0.012} />
      <mesh rotation-x={-Math.PI / 2} position={[x, -0.005, z]}>
        <planeGeometry args={[w, 0.14]} />
        <meshBasicMaterial map={dash} transparent />
      </mesh>
    </group>
  );
}

/** Sông theo trục x (tâm z, rộng d) + bờ kè phía `bankZ`; ghe, xuồng trôi chậm, bèo. */
export function River({ x, z, w, d, bankZ, lite, boats = 3 }: { x: number; z: number; w: number; d: number; bankZ?: number; lite: boolean; boats?: number }) {
  const g = useRef<Group>(null);
  const x0 = x - w / 2 + 2;
  const x1 = x + w / 2 - 2;
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => {
      c.position.y = Math.sin(clock.elapsedTime * 1.4 + i * 1.7) * 0.03 - 0.12;
      c.position.x += (i % 2 ? -1 : 1) * 0.004;
      if (c.position.x > x1) c.position.x = x0;
      if (c.position.x < x0) c.position.x = x1;
    });
  });
  const models = ['p_boat_row_small', 'p_boat_row_large', 'n_canoe'];
  const n = lite ? Math.min(2, boats) : boats;
  return (
    <group>
      <Flat x={x} z={z} w={w} d={d} color="#4FB3D9" y={-0.1} />
      {bankZ !== undefined && (
        <mesh position={[x, 0.1, bankZ]} receiveShadow>
          <boxGeometry args={[w, 0.3, 0.5]} />
          <meshLambertMaterial color="#A1887F" />
        </mesh>
      )}
      <group ref={g}>
        {Array.from({ length: n }, (_, i) => (
          <group key={i} position={[x0 + ((i * 0.37 + 0.2) % 1) * (x1 - x0), -0.12, z + (i % 2 ? 1 : -1) * d * 0.2]} rotation-y={i % 2 ? -Math.PI / 2 : Math.PI / 2}>
            <MProp name={models[i % models.length]} size={1.6} position={[0, 0, 0]} />
          </group>
        ))}
      </group>
    </group>
  );
}

/** Xe Kenney chạy vòng trên làn (trục x). */
export function Car({ model, lane, dir, speed, offset, from = -26, to = 38 }: { model: string; lane: number; dir: 1 | -1; speed: number; offset: number; from?: number; to?: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const span = to - from;
    const t = (((clock.elapsedTime * speed + offset) % span) + span) % span;
    g.position.set(dir === 1 ? from + t : to - t, 0, lane);
  });
  return (
    <group ref={ref} rotation-y={dir === 1 ? Math.PI / 2 : -Math.PI / 2}>
      <MProp name={model} size={1.9} position={[0, 0, 0]} />
    </group>
  );
}

/** Người đi bộ trên vỉa hè (đi tới rồi quay lại). */
export function Walker({ model, z, from, to, speed, offset }: { model: string; z: number; from: number; to: number; speed: number; offset: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const len = to - from;
    const t = (((clock.elapsedTime * speed + offset) % (2 * len)) + 2 * len) % (2 * len);
    const fwd = t < len;
    g.position.set(fwd ? from + t : to - (t - len), 0, z);
    g.rotation.y = fwd ? Math.PI / 2 : -Math.PI / 2;
  });
  return (
    <group ref={ref}>
      <Mini model={model} height={0.9} walking={() => true} />
    </group>
  );
}

/** Chó / mèo / gà con đi tới lui, nảy nhẹ; thỉnh thoảng đứng lại. */
export function Pet({ model, z, from, to, speed, offset, size = 0.45 }: { model: string; z: number; from: number; to: number; speed: number; offset: number; size?: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const len = to - from;
    const cycle = 2 * len + 4; // 2 giây nghỉ mỗi đầu
    const t = (((clock.elapsedTime * speed + offset) % cycle) + cycle) % cycle;
    let x: number;
    let fwd: boolean;
    let moving = true;
    if (t < len) [x, fwd] = [from + t, true];
    else if (t < len + 2) [x, fwd, moving] = [to, true, false];
    else if (t < 2 * len + 2) [x, fwd] = [to - (t - len - 2), false];
    else [x, fwd, moving] = [from, false, false];
    g.position.set(x, moving ? Math.abs(Math.sin(clock.elapsedTime * 10)) * 0.05 : 0, z);
    g.rotation.y = fwd ? Math.PI / 2 : -Math.PI / 2;
  });
  return (
    <group ref={ref}>
      <MProp name={model} size={size} position={[0, 0, 0]} />
    </group>
  );
}

/** Bảng hiệu chữ trên mặt tiền vài căn (canvas; không vẽ theo lô được nên chỉ dùng ít). */
export function Signs({ signs }: { signs: { x: number; z: number; y: number; face: 1 | -1; text: string; scale?: number }[] }) {
  return (
    <group>
      {signs.map((sg, i) => (
        <group key={i} position={[sg.x, 0, sg.z]} rotation-y={sg.face === 1 ? 0 : Math.PI} scale={sg.scale ?? 0.7}>
          <ShopSign name={sg.text} position={[0, sg.y / (sg.scale ?? 0.7), 0]} />
        </group>
      ))}
    </group>
  );
}
