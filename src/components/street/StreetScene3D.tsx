import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { maxDpr, useSettings } from '../../game/settings';
import { Canvas, useFrame } from '../../three/fiber';
import type { ThreeEvent } from '../../three/fiber';
import { findPath } from '../../game/layout';
import type { Tile } from '../../game/layout';
import { DOOR_ROW, STREET_COLS, STREET_PLACES, STREET_ROWS, STREET_TREES, buildStreetLayout, doorTile, placeAt } from '../../game/street';
import type { StreetPlace, StreetPlaceId } from '../../game/street';
import type { GameState } from '../../game/types';
import { useWalker } from '../../screens/views/useWalker';
import { fitCamera, followCamera, makeCamera, project } from '../scene/camera';
import { ShopSign } from '../scene/KayProps';
import { Player, Sun, UseCamera } from '../scene/ShopScene3D';
import { Car, Flat, Pet, River, Road, SKY, Sidewalk, Signs, Walker, house, useViewFocus } from '../scene/SceneryKit';
import { PropInstances } from '../scene/SceneryProps';
import type { PropSpot } from '../scene/SceneryProps';
import { colors } from '../ui';

/** Mặt tiền 5 nơi (mô hình Kenney nhuộm màu) + bảng hiệu. */
const FACADE: Record<StreetPlaceId, { model: string; size: number; tint: string; sign: string }> = {
  shop: { model: 'c_building_e', size: 5, tint: '#FFD2A6', sign: '' },
  market: { model: '', size: 0, tint: '', sign: '🛒 CHỢ NỔI' },
  uncle: { model: 's_building_type_n', size: 4.6, tint: '#E3F5CF', sign: 'Nhà Chú Tư' },
  tools: { model: 'c_building_c', size: 4, tint: '#D6F0FF', sign: 'Tiệm đồ quán' },
  bank: { model: 'c_building_i', size: 4.4, tint: '#FFF0B3', sign: 'Ngân hàng' },
};

const mid = (p: StreetPlace) => (p.x0 + p.x1 + 1) / 2;

/** Vật tĩnh trên phố (vẽ theo lô, xa thì ẩn). */
function buildSpots(saver: boolean): PropSpot[] {
  const s: PropSpot[] = [];
  for (const p of STREET_PLACES) {
    const f = FACADE[p.id];
    if (f.model) s.push({ name: f.model, x: mid(p), z: 2, size: f.size, tint: f.tint });
  }
  // Cổng chợ: sạp dù, thùng hàng phía sau cổng.
  const m = STREET_PLACES.find((p) => p.id === 'market')!;
  for (const [i, x] of [m.x0 + 0.8, m.x0 + 2.6, m.x0 + 4.4].entries()) {
    s.push({ name: i % 2 ? 'c_detail_parasol_b' : 'c_detail_parasol_a', x, z: 1.6, size: 1.6 });
    s.push({ name: ['f_watermelon', 'f_cabbage', 'f_pineapple'][i], x: x + 0.3, z: 2.2, size: 0.45 });
  }
  s.push({ name: 'p_crate', x: m.x0 + 5.2, z: 2.6, size: 0.6 });
  // Trước cửa các nơi: chậu cây, hàng rào nhà Chú Tư, thùng hàng tiệm đồ.
  s.push({ name: 's_fence_low', x: 14.6, z: 3.6, size: 1.2 }, { name: 's_fence_low', x: 18.4, z: 3.6, size: 1.2 });
  s.push({ name: 'p_crate', x: 20.6, z: 3.5, size: 0.5 }, { name: 'u_cardboardboxopen', x: 23.4, z: 3.5, size: 0.5 });
  for (const x of [1.4, 5.6, 26.4, 30.6]) s.push({ name: 's_planter', x, z: 3.6, size: 0.6 });
  // Cây + đèn đường trên mép vỉa hè (các ô chặn trong bản đồ).
  for (const [i, t] of STREET_TREES.entries()) {
    s.push({ name: i % 2 ? 's_tree_large' : 'n_tree_palm', x: t.x + 0.5, z: t.y + 0.5, size: i % 2 ? 1 : 1.3, rot: i });
    s.push({ name: 'r_light_square', x: t.x + 0.5, z: t.y + 0.9, size: 1.05, rot: Math.PI });
  }
  // Nhà nối dài hai đầu phố + dãy nhà phía sau.
  let n = 0;
  for (const x of [-3, -7.5, -12, 35, 39.5, 44]) s.push(house(n++, x, 2, 1, 4));
  for (let x = -10; x <= 42; x += 4.6) s.push(house(n++, x, -3.4, 1, 4));
  // Bờ sông bên kia đường.
  for (let x = -12; x <= 44; x += 3.5) s.push({ name: x % 2 ? 'n_plant_bush' : 'n_tree_palmshort', x, z: 12.8, size: x % 2 ? 0.7 : 1.2, rot: x });
  if (!saver) for (const x of [2, 16, 30]) s.push({ name: 'u_bench', x, z: 12.3, size: 1, rot: Math.PI });
  return s;
}

/** Camera đi theo nhân vật trong khung khu phố; báo vị trí chip tên nhà cho lớp 2D. */
function StreetCamera({ cam, frame, walker, onChips, w, h }: { cam: ReturnType<typeof makeCamera>; frame: ReturnType<typeof fitCamera>; walker: ReturnType<typeof useWalker>; onChips: (c: { id: StreetPlaceId; x: number; y: number }[]) => void; w: number; h: number }) {
  const first = useRef(true);
  const acc = useRef(0);
  useFrame((_, dt) => {
    const st = walker.state.current;
    followCamera(cam, frame, st.x + 0.5, st.y + 0.5, first.current ? 1 : Math.min(1, dt * 4));
    first.current = false;
    acc.current += dt;
    if (acc.current > 0.08) {
      acc.current = 0;
      onChips(STREET_PLACES.map((p) => ({ id: p.id, ...project(cam, mid(p), 3.4, 3.6, w, h) })));
    }
  });
  return null;
}

/**
 * 🏘️ Khu phố nối 5 nơi: chạm mặt đất để đi, chạm nhà (hoặc chip tên) để đi tới cửa rồi vào.
 * Mô hình Kenney (CC0): nhà phố, đèn đường, xe, chó mèo; vật xa tự ẩn / "bật" lên.
 */
export default function StreetScene3D({
  game,
  from,
  width,
  height,
  onEnter,
  walkTo,
}: {
  game: GameState;
  from: StreetPlaceId;
  width: number;
  height: number;
  onEnter: (id: StreetPlaceId) => void;
  /** Yêu cầu đi bộ tới một nơi (từ hàng nút phía trên); `seq` đổi thì đi. */
  walkTo?: { id: StreetPlaceId; seq: number } | null;
}) {
  const { quality } = useSettings();
  const saver = quality === 'saver';
  const layout = useMemo(() => buildStreetLayout(from), [from]);
  const walker = useWalker(layout.start);
  const cam = useMemo(makeCamera, []);
  // Điện thoại: thấy khoảng 9 ô ngang; màn rộng: khoảng 16 ô.
  const zoom = Math.max(1, STREET_COLS / (width < 600 ? 9 : 16));
  const frame = useMemo(() => fitCamera(cam, Math.max(1, width), Math.max(1, height), 0, zoom, { cols: STREET_COLS, rows: STREET_ROWS + 3 }), [cam, width, height, zoom]);
  const spots = useMemo(() => buildSpots(saver), [saver]);
  const [chips, setChips] = useState<{ id: StreetPlaceId; x: number; y: number }[]>([]);
  const [near, setNear] = useState<StreetPlaceId | null>(from);

  const goPlace = (id: StreetPlaceId) => {
    const path = findPath(layout, walker.origin(), [doorTile(id)]);
    if (!path) return;
    setNear(null);
    walker.walk(path, () => {
      walker.face({ x: 0, y: -1 });
      setNear(id);
      onEnter(id);
    });
  };
  const goTile = (t: Tile) => {
    const path = findPath(layout, walker.origin(), [t]);
    if (!path) return;
    walker.walk(path, () => {
      const at = STREET_PLACES.find((p) => p.door === t.x && t.y === DOOR_ROW);
      setNear(at?.id ?? null);
    });
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const x = Math.floor(e.point.x);
    const y = Math.floor(e.point.z);
    const p = placeAt(x, y);
    if (p) return goPlace(p.id);
    goTile({ x: Math.max(0, Math.min(STREET_COLS - 1, x)), y: Math.max(DOOR_ROW, Math.min(STREET_ROWS - 1, y)) });
  };

  useEffect(() => {
    if (walkTo) goPlace(walkTo.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkTo?.seq]);

  // Phím: WASD / mũi tên đi từng ô, E / Enter vào nơi đang đứng trước cửa.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const dirs: Record<string, Tile> = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 } };
    const onKey = (ev: KeyboardEvent) => {
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      const d = dirs[k];
      if (d) {
        ev.preventDefault();
        const o = walker.dest();
        const t = { x: o.x + d.x, y: o.y + d.y };
        if (t.y < DOOR_ROW && d.y < 0) {
          const p = STREET_PLACES.find((pl) => pl.door === o.x);
          if (p) return goPlace(p.id);
        }
        const path = findPath(layout, o, [t]);
        if (path) walker.walk(path, () => setNear(STREET_PLACES.find((pl) => pl.door === t.x && t.y === DOOR_ROW)?.id ?? null));
      } else if (k === 'e' || k === 'Enter') {
        const o = walker.origin();
        const p = STREET_PLACES.find((pl) => pl.door === o.x && o.y === DOOR_ROW);
        if (p) onEnter(p.id);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <View style={{ width, height }}>
      <Canvas shadows="percentage" dpr={[1, Math.min(1.5, maxDpr())]} style={{ flex: 1 }}>
        <UseCamera cam={cam} />
        <StreetCamera cam={cam} frame={frame} walker={walker} onChips={setChips} w={width} h={height} />
        <color attach="background" args={[SKY]} />
        <fog attach="fog" args={[SKY, 50, 95]} />
        <hemisphereLight args={['#FFF6E5', '#6D4C41', 0.9]} />
        <ambientLight intensity={0.4} color="#FFE0B2" />
        <Sun />
        <StreetWorld spots={spots} saver={saver} shopName={game.profile.shopName} />
        {/* Mặt đất bắt chạm (vỉa hè + đường) và khối vô hình trên mặt tiền để chạm nhà */}
        <mesh rotation-x={-Math.PI / 2} position={[STREET_COLS / 2, 0.001, 6]} onClick={onClick}>
          <planeGeometry args={[STREET_COLS + 20, 30]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {STREET_PLACES.map((p) => (
          <mesh
            key={p.id}
            position={[mid(p), 1.6, 2]}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              goPlace(p.id);
            }}
          >
            <boxGeometry args={[p.x1 - p.x0 + 1, 3.2, 3.6]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
        {/* Thảm trước cửa */}
        {STREET_PLACES.map((p) => (
          <mesh key={`m${p.id}`} rotation-x={-Math.PI / 2} position={[p.door + 0.5, 0.01, DOOR_ROW + 0.5]}>
            <planeGeometry args={[0.9, 0.9]} />
            <meshBasicMaterial color={near === p.id ? '#FFD54F' : '#FFE0B2'} transparent opacity={0.85} />
          </mesh>
        ))}
        <Player walker={walker.state} carrying={[]} profile={game.profile} />
      </Canvas>
      {/* Chip tên các nơi (chạm để đi tới) */}
      {chips.map((c) => {
        const p = STREET_PLACES.find((x) => x.id === c.id)!;
        if (c.x < -60 || c.x > width + 60) return null;
        return (
          <Pressable
            key={c.id}
            onPress={() => goPlace(c.id)}
            style={[styles.chip, near === c.id && styles.chipNear, { left: c.x - 62, top: Math.max(4, c.y - 26) }]}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}: ${p.verb}`}
          >
            <Text style={styles.chipTitle} numberOfLines={1}>
              {p.emoji} {p.name}
            </Text>
            <Text style={styles.chipVerb}>👆 {p.verb}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Phần cảnh tĩnh + động của khu phố (tách để dùng hook useThree trong Canvas). */
function StreetWorld({ spots, saver, shopName }: { spots: PropSpot[]; saver: boolean; shopName: string }) {
  const focus = useViewFocus(saver);
  const signs = useMemo(
    () => [
      ...STREET_PLACES.filter((p) => FACADE[p.id].sign && p.id !== 'market').map((p) => ({ x: mid(p), z: 3.75, y: 2.5, face: 1 as const, text: FACADE[p.id].sign })),
      { x: 3, z: 3.8, y: 2.6, face: 1 as const, text: shopName },
      { x: -7.5, z: 3.8, y: 2.3, face: 1 as const, text: 'Tạp hoá Cô Ba' },
      { x: 39.5, z: 3.8, y: 2.3, face: 1 as const, text: 'Cà phê Mây' },
    ],
    [shopName]
  );
  const gate = STREET_PLACES.find((p) => p.id === 'market')!;
  return (
    <group>
      <Flat x={STREET_COLS / 2} z={4} w={160} d={160} color="#9CCC65" y={-0.05} />
      <Sidewalk x={STREET_COLS / 2} z={5.5} w={90} d={3.2} />
      <Road x={STREET_COLS / 2} z={9} w={90} />
      <Sidewalk x={STREET_COLS / 2} z={11.6} w={90} d={1.2} />
      <River x={STREET_COLS / 2} z={17.5} w={90} d={9} bankZ={12.9} lite={saver} />
      <PropInstances spots={spots} focus={focus} />
      <Signs signs={signs} />
      {/* Cổng chợ: 2 cột + bảng tên */}
      <group position={[(gate.x0 + gate.x1 + 1) / 2, 0, 3.6]}>
        {[-2.6, 2.6].map((x) => (
          <mesh key={x} position={[x, 1.3, 0]} castShadow>
            <boxGeometry args={[0.3, 2.6, 0.3]} />
            <meshLambertMaterial color="#C62828" />
          </mesh>
        ))}
        <mesh position={[0, 2.7, 0]} castShadow>
          <boxGeometry args={[5.6, 0.25, 0.35]} />
          <meshLambertMaterial color="#8D6E63" />
        </mesh>
        <group scale={0.75}>
          <ShopSign name={FACADE.market.sign} position={[0, 3.25 / 0.75, 0.2 / 0.75]} />
        </group>
      </group>
      {!saver && (
        <>
          <Car model="v_sedan" lane={8} dir={1} speed={3} offset={0} from={-14} to={46} />
          <Car model="v_delivery" lane={10} dir={-1} speed={2.4} offset={18} from={-14} to={46} />
          <Car model="v_taxi" lane={8} dir={1} speed={2.6} offset={33} from={-14} to={46} />
          <Walker model="mini_female_c" z={6.6} from={-2} to={33} speed={0.6} offset={4} />
          <Walker model="mini_male_d" z={11.6} from={-6} to={38} speed={0.7} offset={9} />
          <Pet model="a_animal_dog" z={6.3} from={13.5} to={19} speed={0.8} offset={1} />
          <Pet model="a_animal_cat" z={3.9} from={24.6} to={25.6} speed={0.3} offset={3} size={0.4} />
          <Pet model="a_animal_chick" z={4.2} from={7.4} to={11.8} speed={0.7} offset={6} size={0.32} />
        </>
      )}
    </group>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    width: 124,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: colors.chunkyShadow,
    borderBottomWidth: 4,
  },
  chipNear: { borderColor: colors.primary, backgroundColor: '#FFF3E0' },
  chipTitle: { fontSize: 13, fontWeight: '900', color: colors.brown },
  chipVerb: { fontSize: 11, fontWeight: '800', color: colors.primaryDark },
});

