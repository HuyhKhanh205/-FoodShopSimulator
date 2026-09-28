import { useMemo } from 'react';
import { useSettings } from '../../game/settings';
import { PropInstances } from './SceneryProps';
import type { PropSpot } from './SceneryProps';
import { Car, Flat, Pet, River, Road, SKY, Sidewalk, Signs, Walker, house, useViewFocus } from './SceneryKit';

export { SKY };

/**
 * Phong cảnh phố bên sông quanh quán (quán ở x 0–12, z 0–10; cửa phía nam), mô hình Kenney CC0:
 * – nam: vỉa hè (ghế đẩu chỗ nhân viên nghỉ, đèn đường, cây) → đường có xe chạy → dãy nhà bên kia đường;
 * – bắc (sau bếp): bờ kè, sông có ghe; bờ bên kia trồng dừa;
 * – hai bên: nhà hàng xóm nhiều màu, cách quán một con hẻm có cây.
 */
type Spot = PropSpot & { detail?: boolean };

const SIGNS_NEAR = [
  { x: -5, z: 6.9, y: 2.3, face: 1 as const, text: 'Tạp hoá Cô Ba' },
  { x: 17, z: 6.9, y: 2.3, face: 1 as const, text: 'Cà phê Mây' },
  { x: 4.5, z: 18.6, y: 2.3, face: -1 as const, text: 'Tiệm bánh mì' },
  { x: 9, z: 18.6, y: 2.3, face: -1 as const, text: 'Chè Bà Tư' },
];

/** Danh sách vật tĩnh (cố định để lần nào mở cũng giống nhau). */
function buildSpots(): Spot[] {
  const s: Spot[] = [];
  let n = 0;
  // Hàng xóm hai bên quán (mặt quay ra đường), chừa hẻm 2–3 ô để không che bàn ghế ở mọi góc xoay.
  for (const x of [-5, -9.6, -14.2, -18.8, -23.4]) s.push(house(n++, x, 5, 1, 4));
  for (const x of [17, 21.6, 26.2, 30.8, 35.4]) s.push(house(n++, x, 5, 1, 4));
  // Dãy nhà bên kia đường (quay về phía quán).
  for (let x = -20; x <= 34; x += 4.5) s.push(house(n++, x, 20.5, -1, 4));

  // Vỉa hè trước quán: ghế đẩu chỗ nhân viên nghỉ, chậu hoa, cây, đèn đường, cột điện.
  for (const x of [8.7, 9.5, 10.3]) s.push({ name: 'u_stoolbar', x, z: 10.95, size: 0.35 });
  for (const x of [1, 4, 7.2]) s.push({ name: 's_planter', x, z: 10.75, size: 0.6, detail: true });
  for (const x of [-9, -4.5, 13.6, 18, 22.5, 27]) s.push({ name: x % 2 ? 'n_tree_palmbend' : 'n_tree_palm', x, z: 11.9, size: 1.3, rot: x });
  for (const x of [-2, 6, 15.5, 25]) s.push({ name: 'r_light_square', x, z: 12.1, size: 1.05, rot: Math.PI });
  for (const x of [-14, 31]) s.push({ name: 'r_electricity_pole', x, z: 12.2, size: 2.4 });
  s.push({ name: 'r_dumpster', x: 13.3, z: 9.2, size: 0.9, detail: true });
  // Bên kia đường: cây bóng mát, ghế đá, hàng rào thấp.
  for (const x of [-12, -3, 6, 15, 24, 33]) s.push({ name: 's_tree_large', x, z: 17.7, size: 1, rot: x });
  for (const x of [1.5, 19.5]) s.push({ name: 'u_bench', x, z: 17.4, size: 1, detail: true });
  // Bờ sông sau quán: bụi cây, hoa; bờ bên kia trồng dừa, đá.
  for (let x = -18; x <= 30; x += 3) {
    s.push({ name: x % 2 ? 'n_plant_bush' : 'n_plant_bushlarge', x, z: -0.9, size: 0.7, detail: x % 6 !== 0 });
    s.push({ name: ['n_flower_yellowa', 'n_flower_purplea', 'n_flower_reda'][Math.abs(x) % 3], x: x + 1.3, z: -0.8, size: 0.25, detail: true });
  }
  for (let x = -20; x <= 32; x += 4) s.push({ name: ['n_tree_palm', 'n_tree_palmshort', 'n_tree_palmbend'][Math.abs(x) % 3], x, z: -10.8, size: 1.4, rot: x });
  for (const x of [-14, 2, 20]) s.push({ name: 'n_rock_smalla', x, z: -11.6, size: 0.6, detail: true });
  s.push({ name: 'p_structure_platform_dock_small', x: 6, z: -1.6, size: 1.6, y: -0.15 });
  // Hẻm hai bên quán: cây, bụi, thùng.
  for (const z of [2, 5.5, 8.5]) {
    s.push({ name: z === 5.5 ? 's_tree_small' : 'n_plant_bushlarge', x: -1.6, z, size: z === 5.5 ? 0.8 : 0.8 });
    s.push({ name: z === 5.5 ? 's_tree_small' : 'n_plant_bushlarge', x: 13.6, z, size: z === 5.5 ? 0.8 : 0.8 });
  }
  s.push({ name: 'p_crate', x: 13.5, z: 3.6, size: 0.5, detail: true });
  s.push({ name: 'p_flag_pennant', x: -0.7, z: 10.6, size: 1, detail: true });
  s.push({ name: 'p_flag_pennant', x: 12.7, z: 10.6, size: 1, detail: true });
  return s;
}

export default function Surroundings() {
  const { quality } = useSettings();
  const saver = quality === 'saver';
  const all = useMemo(buildSpots, []);
  const spots = useMemo(() => all.filter((sp) => !(saver && sp.detail)), [all, saver]);
  const focus = useViewFocus(saver);
  return (
    <group name="surroundings">
      <Flat x={6} z={5} w={160} d={160} color="#9CCC65" y={-0.05} />
      <Sidewalk x={6} z={11.2} w={80} d={2.4} />
      <Road x={6} z={14.4} w={80} />
      <Sidewalk x={6} z={17.2} w={80} d={1.6} />
      <River x={6} z={-5.6} w={80} d={9.6} bankZ={-0.55} lite={saver} />
      <PropInstances spots={spots} focus={focus} />
      <Signs signs={SIGNS_NEAR} />
      {!saver && (
        <>
          <Car model="v_sedan" lane={13.4} dir={1} speed={3.2} offset={0} />
          <Car model="v_taxi" lane={15.4} dir={-1} speed={2.6} offset={20} />
          <Car model="v_van" lane={13.4} dir={1} speed={2.8} offset={35} />
          <Walker model="mini_female_a" z={11.4} from={-10} to={24} speed={0.7} offset={3} />
          <Walker model="mini_male_b" z={17.1} from={-12} to={26} speed={0.6} offset={12} />
          <Pet model="a_animal_dog" z={10.6} from={-8} to={-1} speed={0.9} offset={2} />
          <Pet model="a_animal_cat" z={17.5} from={10} to={16} speed={0.6} offset={5} size={0.4} />
        </>
      )}
    </group>
  );
}
