import { useMemo } from 'react';
import { useSettings } from '../../game/settings';
import { PropInstances } from './SceneryProps';
import type { PropSpot } from './SceneryProps';
import { Car, Flat, Pet, River, Road, Sidewalk, Signs, Walker, house, useViewFocus } from './SceneryKit';

/**
 * Phong cảnh quanh chợ (chợ ở x 0–12, z 0–10; sông ở z 0–3 phía trên):
 * – sông nối dài hai bên, bờ bên kia có nhà + dừa;
 * – phía nam: vỉa hè → đường có xe → dãy nhà phố;
 * – hai bên: nhà phố quay mặt vào chợ, cây, đèn đường.
 */
type Spot = PropSpot & { detail?: boolean };

function buildSpots(): Spot[] {
  const s: Spot[] = [];
  let n = 3;
  // Bờ bên kia sông: nhà quay mặt ra sông, dừa.
  for (let x = -18; x <= 30; x += 4.6) s.push(house(n++, x, -6.5, 1, 4));
  for (let x = -16; x <= 30; x += 3.2) s.push({ name: ['n_tree_palm', 'n_tree_palmbend', 'n_tree_palmshort'][Math.abs(Math.round(x)) % 3], x, z: -3.6, size: 1.3, rot: x });
  // Hai bên chợ: nhà quay mặt vào chợ.
  for (const [i, z] of [4.5, 9].entries()) {
    // Chừa 3–4 ô giữa sạp và nhà để nhà không che sạp ở góc nhìn chéo.
    s.push({ ...house(n++, -5, z, 1, 4), rot: Math.PI / 2 });
    s.push({ ...house(n++, 17.5, z, 1, 4), rot: -Math.PI / 2 });
    s.push({ ...house(n++, -9.8, z, 1, 4), rot: Math.PI / 2, detail: i > 0 });
    s.push({ ...house(n++, 22.3, z, 1, 4), rot: -Math.PI / 2, detail: i > 0 });
  }
  for (const z of [3.6, 6.8, 10.2]) {
    s.push({ name: 's_tree_large', x: -1.6, z, size: 1 }, { name: 's_tree_large', x: 13.8, z, size: 1 });
  }
  // Phía nam: vỉa hè có đèn, bên kia đường là dãy nhà.
  for (const x of [-4, 3, 9, 16]) s.push({ name: 'r_light_square', x, z: 11.9, size: 1.05, rot: Math.PI });
  for (const x of [-10, 22]) s.push({ name: 'r_electricity_pole', x, z: 12, size: 2.4 });
  for (let x = -18; x <= 30; x += 4.6) s.push(house(n++, x, 19.5, -1, 4));
  for (const x of [-13, 0, 12, 25]) s.push({ name: 's_tree_large', x, z: 17, size: 1, rot: x });
  for (const x of [-6, 18]) s.push({ name: 'r_construction_cone', x, z: 12.3, size: 0.35, detail: true });
  return s;
}

const SIGNS = [
  { x: 1.5, z: 17.8, y: 2.3, face: -1 as const, text: 'Tiệm vàng Kim' },
  { x: 10.7, z: 17.8, y: 2.3, face: -1 as const, text: 'Bánh xèo Út' },
];

export default function MarketSurroundings({ demo = false }: { demo?: boolean }) {
  const { quality } = useSettings();
  const saver = quality === 'saver';
  const all = useMemo(buildSpots, []);
  const spots = useMemo(() => all.filter((sp) => !(saver && sp.detail)), [all, saver]);
  const focus = useViewFocus(saver);
  return (
    <group name="surroundings">
      <Flat x={6} z={5} w={160} d={160} color="#9CCC65" y={-0.06} />
      <River x={6} z={-1.5} w={90} d={7} lite={saver} boats={demo ? 2 : 3} />
      <Sidewalk x={6} z={11.3} w={90} d={2.4} />
      <Road x={6} z={14.5} w={90} />
      <Sidewalk x={6} z={17.2} w={90} d={1.4} />
      <PropInstances spots={spots} focus={focus} />
      <Signs signs={SIGNS} />
      {!saver && (
        <>
          <Car model="v_van" lane={13.5} dir={1} speed={2.8} offset={5} />
          <Car model="v_sedan" lane={15.5} dir={-1} speed={3.1} offset={25} />
          <Walker model="mini_male_b" z={11.4} from={-8} to={20} speed={0.6} offset={2} />
          <Pet model="a_animal_dog" z={11} from={-6} to={-1} speed={0.8} offset={4} />
        </>
      )}
    </group>
  );
}
