import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, DataTexture, Matrix4, NearestFilter, Object3D, Plane, RGBAFormat, Raycaster, RepeatWrapping, Vector2, Vector3 } from 'three';
import type { Group, InstancedMesh } from 'three';
import { useSettings } from '../../game/settings';
import { useFrame, useThree } from '../../three/fiber';
import { ELEVATION } from './camera';
import { viewRadius } from './cull';
import { ShopSign } from './KayProps';
import { MProp, Mini, PropInstances } from './SceneryProps';
import type { PropSpot, ViewFocus } from './SceneryProps';
import { checkerTileTexture } from './textures';

/**
 * Phong cảnh phố bên sông quanh quán (quán ở x 0–12, z 0–10; cửa phía nam):
 * – nam: vỉa hè có ghế đẩu, đèn đường, cây dừa → đường nhựa có xe máy chạy → dãy nhà bên kia đường;
 * – bắc (sau bếp): bờ kè, sông có ghe, bèo, bến; bờ bên kia trồng dừa;
 * – hai bên: dãy nhà hàng xóm mái hiên nhiều màu.
 * Vật tĩnh chia khối; khối xa tầm nhìn thì ẩn, lại gần thì "bật" lên (kiểu Farm Together).
 */

export const SKY = '#CFE8F0';

type Item =
  | { kind: 'prop'; x: number; z: number; name: string; size: number; rot?: number; detail?: boolean }
  | { kind: 'house'; x: number; z: number; w: number; d: number; h: number; color: string; roof: string; face: 1 | -1; sign?: string }
  | { kind: 'lamp'; x: number; z: number };

const PASTEL = ['#F8BBD0', '#FFE082', '#B3E5FC', '#C5E1A5', '#FFCCBC', '#D1C4E9', '#FFF59D', '#B2DFDB'];
const ROOF = ['#E6A57E', '#A1887F', '#80CBC4', '#EF9A9A', '#BCAAA4', '#FFCC80'];
const SIGNS = ['Tạp hoá Cô Ba', 'Cà phê Mây', 'Tiệm bánh mì', 'Sửa xe Tám', 'Hoa tươi Lan', 'Nhà thuốc', 'Chè Bà Tư', 'Tiệm may', 'Kem dừa', 'Sách báo'];

/** Danh sách vật tĩnh (cố định, không ngẫu nhiên để lần nào mở cũng giống nhau). */
function buildItems(): Item[] {
  const items: Item[] = [];
  let n = 0;
  const house = (x: number, z: number, w: number, d: number, face: 1 | -1, sign = true) => {
    items.push({ kind: 'house', x, z, w, d, h: 2.4 + ((n * 7) % 5) * 0.25, color: PASTEL[n % PASTEL.length], roof: ROOF[n % ROOF.length], face, sign: sign ? SIGNS[n % SIGNS.length] : undefined });
    n += 1;
  };
  // Hàng xóm hai bên quán (mặt quay ra đường phía nam).
  // Chừa hẻm 2–3 ô giữa quán và nhà bên (nhà không che bàn ghế ở mọi góc xoay); chỉ 2 nhà gần quán có bảng hiệu.
  for (const [i, x] of [-5, -9.4, -13.8, -18.2, -22.6].entries()) house(x, 5, 4, 9, 1, i === 0);
  for (const [i, x] of [17, 21.4, 25.8, 30.2, 34.6].entries()) house(x, 5, 4, 9, 1, i === 0);
  // Dãy nhà bên kia đường (mặt quay về phía quán); 2 căn đối diện quán có bảng hiệu.
  for (let x = -20; x <= 34; x += 4.5) house(x, 20.8, 4.2, 5, -1, Math.abs(x - 7) < 5);

  // Vỉa hè trước quán: ghế đẩu chỗ nhân viên nghỉ, cây dừa, đèn đường, chậu hoa.
  for (const x of [8.7, 9.5, 10.3]) items.push({ kind: 'prop', x, z: 10.95, name: 'u_stoolbar', size: 0.35 });
  for (const x of [-9, -4.5, 13.6, 18, 22.5, 27]) items.push({ kind: 'prop', x, z: 11.9, name: x % 2 ? 'n_tree_palmbend' : 'n_tree_palm', size: 1.3, rot: x });
  for (const x of [-2, 6, 15.5, 25]) items.push({ kind: 'lamp', x, z: 12.1 });
  for (const x of [1, 4, 7.2]) items.push({ kind: 'prop', x, z: 10.7, name: 'n_pot_large', size: 0.4, detail: true });
  for (const x of [1.4, 4.4, 7.6]) items.push({ kind: 'prop', x, z: 10.7, name: 'n_flower_reda', size: 0.22, detail: true });
  // Bên kia đường: cây bóng mát, ghế đá.
  for (const x of [-12, -3, 6, 15, 24, 33]) items.push({ kind: 'prop', x, z: 17.6, name: 'n_tree_default', size: 1.6, rot: x });
  for (const x of [1.5, 19.5]) items.push({ kind: 'prop', x, z: 17.3, name: 'u_bench', size: 1, detail: true });
  // Bờ sông sau quán: bụi cây, hoa, đá; bờ bên kia trồng dừa.
  for (let x = -18; x <= 30; x += 3) {
    items.push({ kind: 'prop', x, z: -0.9, name: x % 2 ? 'n_plant_bush' : 'n_plant_bushlarge', size: 0.7, detail: x % 6 !== 0 });
    items.push({ kind: 'prop', x: x + 1.3, z: -0.8, name: ['n_flower_yellowa', 'n_flower_purplea', 'n_flower_reda'][Math.abs(x) % 3], size: 0.25, detail: true });
  }
  for (let x = -20; x <= 32; x += 4) items.push({ kind: 'prop', x, z: -10.8, name: ['n_tree_palm', 'n_tree_palmshort', 'n_tree_palmbend'][Math.abs(x) % 3], size: 1.4, rot: x });
  for (const x of [-14, 2, 20]) items.push({ kind: 'prop', x, z: -11.6, name: 'n_rock_smalla', size: 0.6, detail: true });
  // Hẻm hai bên quán: cây, chậu, thùng.
  for (const z of [2, 5.5, 8.5]) {
    items.push({ kind: 'prop', x: -1.6, z, name: z === 5.5 ? 'n_tree_palmshort' : 'n_plant_bushlarge', size: z === 5.5 ? 1.2 : 0.8 });
    items.push({ kind: 'prop', x: 13.6, z, name: z === 5.5 ? 'n_tree_palmshort' : 'n_plant_bushlarge', size: z === 5.5 ? 1.2 : 0.8 });
  }
  items.push({ kind: 'prop', x: 13.5, z: 3.6, name: 'p_crate', size: 0.5, detail: true });
  // Cờ đuôi nheo, cỏ bên hông quán.
  items.push({ kind: 'prop', x: -0.7, z: 10.6, name: 'p_flag_pennant', size: 1, detail: true });
  items.push({ kind: 'prop', x: 12.7, z: 10.6, name: 'p_flag_pennant', size: 1, detail: true });
  for (const [x, z] of [[-0.6, 3], [12.6, 6], [-0.5, 8], [12.5, 2]]) items.push({ kind: 'prop', x, z, name: 'n_grass_large', size: 0.5, detail: true });
  return items;
}

type HouseItem = Extract<Item, { kind: 'house' }>;

/**
 * Mọi căn nhà vẽ bằng vài InstancedMesh (thân, mái, cửa, cửa sổ, mái hiên): ~5 lần vẽ cho cả dãy phố
 * thay vì ~8 lần mỗi căn. Bảng hiệu (chữ vẽ canvas) chỉ gắn cho vài căn gần quán.
 */
function Houses({ houses }: { houses: HouseItem[] }) {
  const refs = useRef<(InstancedMesh | null)[]>([]);
  const parts = useMemo(() => {
    const dummy = new Object3D();
    const out: { matrices: Matrix4[]; colors: Color[] }[] = [0, 1, 2, 3, 4].map(() => ({ matrices: [], colors: [] }));
    const put = (i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, rotX = 0) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(rotX, 0, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      out[i].matrices.push(dummy.matrix.clone());
      out[i].colors.push(new Color(color));
    };
    for (const h of houses) {
      const fz = h.z + h.face * (h.d / 2 + 0.01);
      put(0, h.x, h.h / 2, h.z, h.w, h.h, h.d, h.color);
      put(1, h.x, h.h + 0.12, h.z, h.w + 0.3, 0.24, h.d + 0.3, h.roof);
      put(2, h.x, 0.75, fz, h.w * 0.55, 1.5, 0.02, '#8D6E63');
      for (const wx of [-h.w * 0.28, h.w * 0.28]) put(3, h.x + wx, h.h - 0.6, fz, 0.7, 0.55, 0.02, '#E1F5FE');
      put(4, h.x, 1.75, h.z + h.face * (h.d / 2 + 0.45), h.w * 0.9, 0.05, 0.95, h.roof, 0.35 * h.face);
    }
    return out;
  }, [houses]);
  useLayoutEffect(() => {
    parts.forEach((p, i) => {
      const m = refs.current[i];
      if (!m) return;
      p.matrices.forEach((mx, j) => {
        m.setMatrixAt(j, mx);
        m.setColorAt(j, p.colors[j]);
      });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    });
  }, [parts]);
  return (
    <group>
      {parts.map((p, i) => (
        <instancedMesh
          key={i}
          ref={(m) => {
            refs.current[i] = m;
          }}
          args={[undefined, undefined, p.matrices.length]}
          receiveShadow={i === 0}
        >
          <boxGeometry args={[1, 1, 1]} />
          {i === 3 ? <meshBasicMaterial color="#FFFFFF" /> : <meshLambertMaterial color="#FFFFFF" />}
        </instancedMesh>
      ))}
      {houses
        .filter((h) => h.sign)
        .map((h, i) => (
          <group key={i} position={[h.x, 0, h.z]} rotation-y={h.face === 1 ? 0 : Math.PI} scale={0.8}>
            <ShopSign name={h.sign!} position={[0, 2.55 / 0.8, (h.d / 2 + 0.06) / 0.8]} />
          </group>
        ))}
    </group>
  );
}

function Lamp() {
  return (
    <group>
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 2.6, 8]} />
        <meshLambertMaterial color="#37474F" />
      </mesh>
      <mesh position={[0, 2.6, 0.2]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshBasicMaterial color="#FFF3C4" />
      </mesh>
    </group>
  );
}

/** Vạch đứt giữa đường: một ảnh lặp (1 lần vẽ thay vì 20). */
function dashTexture() {
  const d = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const t = new DataTexture(d, 5, 1, RGBAFormat);
  t.wrapS = RepeatWrapping;
  t.magFilter = NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** Mặt đất lớn: cỏ, vỉa hè, đường nhựa có vạch, sông + bờ kè. Luôn hiện (vài mặt phẳng, rất nhẹ). */
function Ground() {
  const walk = useMemo(() => {
    const t = checkerTileTexture('#E8DCCB', '#D9CAB3').clone();
    t.repeat.set(36, 1.2);
    t.needsUpdate = true;
    return t;
  }, []);
  const dash = useMemo(() => {
    const t = dashTexture();
    t.repeat.set(20, 1);
    return t;
  }, []);
  const plane = (x: number, z: number, w: number, d: number, color: string, y = -0.02, map?: typeof walk) => (
    <mesh rotation-x={-Math.PI / 2} position={[x, y, z]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshLambertMaterial color={map ? '#FFFFFF' : color} map={map} />
    </mesh>
  );
  return (
    <group>
      {plane(6, 5, 160, 160, '#9CCC65', -0.05)}
      {plane(6, 11.2, 80, 2.4, '#E0D6C8', -0.015, walk)}
      {plane(6, 14.4, 80, 4, '#5F6368', -0.012)}
      {plane(6, 17.2, 80, 1.6, '#E0D6C8', -0.015, walk)}
      {/* Vạch giữa đường */}
      <mesh rotation-x={-Math.PI / 2} position={[6, -0.005, 14.4]}>
        <planeGeometry args={[80, 0.14]} />
        <meshBasicMaterial map={dash} transparent />
      </mesh>
      {/* Bờ kè + sông */}
      <mesh position={[6, 0.1, -0.55]} receiveShadow>
        <boxGeometry args={[80, 0.3, 0.5]} />
        <meshLambertMaterial color="#A1887F" />
      </mesh>
      {plane(6, -5.6, 80, 9.6, '#4FB3D9', -0.1)}
    </group>
  );
}

/** Ghe, xuồng, bèo, bến trên sông (nhấp nhô nhẹ). */
function River({ lite }: { lite: boolean }) {
  const boats = useRef<Group>(null);
  useFrame(({ clock }) => {
    boats.current?.children.forEach((c, i) => {
      c.position.y = Math.sin(clock.elapsedTime * 1.4 + i * 1.7) * 0.03 - 0.12;
      c.position.x += (i % 2 ? -1 : 1) * 0.002;
      if (c.position.x > 34) c.position.x = -22;
      if (c.position.x < -22) c.position.x = 34;
    });
  });
  return (
    <group>
      <group ref={boats}>
        <group position={[2, -0.12, -3.4]} rotation-y={Math.PI / 2}>
          <MProp name="p_boat_row_small" size={1.6} position={[0, 0, 0]} />
        </group>
        <group position={[10, -0.12, -6.2]} rotation-y={-Math.PI / 2}>
          <MProp name="p_boat_row_large" size={1.8} position={[0, 0, 0]} />
        </group>
        {!lite && (
          <group position={[-6, -0.12, -5]} rotation-y={Math.PI / 2}>
            <MProp name="n_canoe" size={1.2} position={[0, 0, 0]} />
          </group>
        )}
      </group>
      <MProp name="p_structure_platform_dock_small" size={1.6} position={[6, -0.15, -1.6]} />
      {!lite &&
        [
          [-3, -2.4],
          [4, -7.5],
          [15, -3],
          [21, -6.5],
        ].map(([x, z]) => <MProp key={`${x}`} name="n_lily_large" size={0.45} position={[x, -0.08, z]} />)}
    </group>
  );
}

/** Xe máy đơn giản (khối) chạy qua lại trên đường. */
function Bike({ lane, dir, speed, color, offset }: { lane: number; dir: 1 | -1; speed: number; color: string; offset: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const span = 64;
    const t = ((clock.elapsedTime * speed + offset) % span + span) % span;
    g.position.set(dir === 1 ? -26 + t : 38 - t, 0, lane);
  });
  return (
    <group ref={ref} rotation-y={dir === 1 ? Math.PI / 2 : -Math.PI / 2}>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.28, 0.3, 0.95]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {[-0.36, 0.36].map((z) => (
        <mesh key={z} position={[0, 0.16, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.16, 0.16, 0.08, 10]} />
          <meshLambertMaterial color="#212121" />
        </mesh>
      ))}
      <mesh position={[0, 0.72, -0.08]}>
        <boxGeometry args={[0.3, 0.45, 0.25]} />
        <meshLambertMaterial color="#1E88E5" />
      </mesh>
      <mesh position={[0, 1.05, -0.08]}>
        <sphereGeometry args={[0.15, 10, 8]} />
        <meshLambertMaterial color={color} />
      </mesh>
    </group>
  );
}

/** Người đi bộ trên vỉa hè (đi tới rồi quay lại). */
function Walker({ model, z, from, to, speed, offset }: { model: string; z: number; from: number; to: number; speed: number; offset: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const len = to - from;
    const t = ((clock.elapsedTime * speed + offset) % (2 * len) + 2 * len) % (2 * len);
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

/**
 * Tâm nhìn cho việc ẩn vật xa (~4 lần / giây): điểm mặt đất giữa màn hình + bán kính nhìn.
 * `__noCull` (chỉ để đo) thì hiện hết.
 */
function useViewFocus(saver: boolean) {
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

export default function Surroundings() {
  const { quality } = useSettings();
  const saver = quality === 'saver';
  const all = useMemo(() => buildItems(), []);
  const houses = useMemo(() => all.filter((it): it is HouseItem => it.kind === 'house'), [all]);
  const spots = useMemo(
    () => all.flatMap((it): PropSpot[] => (it.kind === 'prop' && !(saver && it.detail) ? [{ name: it.name, x: it.x, z: it.z, size: it.size, rot: it.rot }] : [])),
    [all, saver]
  );
  const lamps = useMemo(() => all.filter((it) => it.kind === 'lamp'), [all]);
  const focus = useViewFocus(saver);
  return (
    <group name="surroundings">
      <Ground />
      <River lite={saver} />
      <Houses houses={houses} />
      <PropInstances spots={spots} focus={focus} />
      {lamps.map((it, i) => (
        <group key={i} position={[it.x, 0, it.z]}>
          <Lamp />
        </group>
      ))}
      {!saver && (
        <>
          <Bike lane={13.4} dir={1} speed={3.2} color="#E53935" offset={0} />
          <Bike lane={15.4} dir={-1} speed={2.6} color="#FDD835" offset={20} />
          <Bike lane={13.4} dir={1} speed={2.8} color="#43A047" offset={35} />
          <Walker model="mini_female_a" z={11.4} from={-10} to={24} speed={0.7} offset={3} />
          <Walker model="mini_male_b" z={17.1} from={-12} to={26} speed={0.6} offset={12} />
        </>
      )}
    </group>
  );
}
