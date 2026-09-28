import { useEffect, useMemo, useRef, useState } from 'react';
import { maxDpr } from '../../game/settings';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Group } from 'three';
import { Canvas, useFrame } from '../../three/fiber';
import type { ThreeEvent } from '../../three/fiber';
import { MProp, Mini } from '../scene/SceneryProps';
import { MAP_COLS, MAP_ROWS, findPath } from '../../game/layout';
import type { MapLayout, Tile } from '../../game/layout';
import { VENDORS, activeDeals, fmt, friendLevel, vendorCall, vendorState } from '../../game/market';
import type { VendorId } from '../../game/market';
import type { GameState } from '../../game/types';
import { useWalker } from '../../screens/views/useWalker';
import { ISO_YAW, fitCamera, makeCamera, project } from '../scene/camera';
import { Player, Sun, UseCamera } from '../scene/ShopScene3D';
import { checkerTileTexture } from '../scene/textures';
import { GROUP, colors } from '../ui';
import ModelCharacter from '../scene/ModelCharacter';
import type { CameraCam } from '../scene/camera';

/** Màn đầu: camera đung đưa nhẹ quanh chợ. */
function DemoOrbit({ cam, width, height, zoom }: { cam: CameraCam; width: number; height: number; zoom: number }) {
  useFrame(({ clock }) => {
    fitCamera(cam, Math.max(1, width), Math.max(1, height), ISO_YAW + Math.sin(clock.elapsedTime * 0.12) * 0.45, zoom);
  });
  return null;
}

const CHEF_LOOK = { skin: '#E0AC7E', hair: '#3E2723', shirt: '#FAFAFA', pants: '#263238', apron: '#E53935', hat: 'chef' as const, hatColor: '#FFFFFF' };

type Vec3 = [number, number, number];

/** Sạp trên bản đồ chợ (12 × 10 ô): sông ở trên, lối đi lát gạch ở giữa, 2 sạp mỗi bên. */
export interface Stall {
  id: VendorId;
  x: number;
  y: number;
  /** Hướng quay mặt ra lối đi: +1 (sang phải) hoặc −1 (sang trái). */
  face: 1 | -1;
  access: Tile[];
}
export const STALLS: Stall[] = [
  { id: 'thit', x: 1, y: 4, face: 1, access: [{ x: 3, y: 4 }, { x: 3, y: 5 }] },
  { id: 'bot', x: 1, y: 7, face: 1, access: [{ x: 3, y: 7 }, { x: 3, y: 8 }] },
  { id: 'rau', x: 9, y: 4, face: -1, access: [{ x: 8, y: 4 }, { x: 8, y: 5 }] },
  { id: 'nuoc', x: 9, y: 7, face: -1, access: [{ x: 8, y: 7 }, { x: 8, y: 8 }] },
];
const RIVER_ROWS = 3;
const PALMS: [number, number, string][] = [
  [0, 3, 'n_tree_palm'],
  [11, 3, 'n_tree_palmbend'],
  [0, 9, 'n_tree_palmshort'],
  [11, 9, 'n_tree_palm'],
  [5, 3, 'n_tree_palmshort'],
];
const key = (x: number, y: number) => `${x},${y}`;
/** Tên sạp ngắn cho chip: "Sạp thịt & tôm" → "Thịt & tôm", "Tạp hoá đồ uống" → "Đồ uống". */
const shortName = (stall: string) => {
  const s = stall.replace(/^Sạp /, '').replace(/^Tạp hoá /, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function buildMarketLayout(): MapLayout {
  const blocked = new Set<string>();
  for (let y = 0; y < RIVER_ROWS; y += 1) for (let x = 0; x < MAP_COLS; x += 1) blocked.add(key(x, y));
  for (const s of STALLS) for (let dx = 0; dx < 2; dx += 1) for (let dy = 0; dy < 2; dy += 1) blocked.add(key(s.x + dx, s.y + dy));
  for (const [x, y] of PALMS) blocked.add(key(x, y));
  return { stations: [], blocked, restSpot: { x: 6, y: 9 }, start: { x: 6, y: 9 } };
}

const ITEMS: Record<VendorId, string[]> = {
  thit: ['f_meat_raw', 'f_meat_ribs', 'f_whole_ham', 'f_fish', 'f_bacon_raw', 'f_sausage'],
  bot: ['f_loaf_baguette', 'f_egg', 'f_loaf_round', 'f_egg', 'f_bread', 'f_rice_ball'],
  rau: ['f_cabbage', 'f_leek', 'f_carrot', 'f_broccoli', 'f_tomato', 'f_eggplant'],
  nuoc: ['f_cup_coffee', 'f_soda_bottle', 'f_carton', 'f_coconut', 'f_can', 'f_lemon'],
};
const CRATE_FRUIT: Record<VendorId, string> = { thit: 'f_barrel', bot: 'f_bag', rau: 'f_watermelon', nuoc: 'f_pineapple' };

/** Một sạp: mái che sọc màu nhóm, bàn bày hàng, thùng, người bán đứng sau bàn. */
function StallMesh({ stall }: { stall: Stall }) {
  const v = VENDORS.find((x) => x.id === stall.id)!;
  const color = GROUP[v.group].fg;
  const cx = stall.x + 1;
  const cz = stall.y + 1;
  // Hướng người bán nhìn ra lối đi (quay theo trục y).
  const faceRot = stall.face === 1 ? Math.PI / 2 : -Math.PI / 2;
  const stripes = Array.from({ length: 6 }, (_, i) => i);
  return (
    <group position={[cx, 0, cz]}>
      {/* Mái che sọc: chỉ che nửa sau (trên đầu người bán) để thấy rõ hàng bày trên bàn */}
      {[-0.85, 0.85].map((dz) => (
        <mesh key={dz} position={[-stall.face * 0.85, 0.85, dz]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 1.7, 8]} />
          <meshStandardMaterial color="#8D6E63" />
        </mesh>
      ))}
      <group position={[-stall.face * 0.45, 1.62, 0]} rotation-z={stall.face * 0.35}>
        {stripes.map((i) => (
          <mesh key={i} position={[0, 0, -0.95 + 0.3167 * i + 0.158]} castShadow>
            <boxGeometry args={[1.05, 0.06, 0.3167]} />
            <meshStandardMaterial color={i % 2 ? '#FFF6E9' : color} roughness={0.8} />
          </mesh>
        ))}
      </group>
      {/* Bàn bày hàng: khăn màu nhóm */}
      <mesh position={[stall.face * 0.35, 0.33, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.75, 0.66, 1.8]} />
        <meshStandardMaterial color="#A1887F" />
      </mesh>
      <mesh position={[stall.face * 0.35, 0.675, 0]} receiveShadow>
        <boxGeometry args={[0.8, 0.03, 1.86]} />
        <meshStandardMaterial color={GROUP[v.group].bg} />
      </mesh>
      {ITEMS[stall.id].map((name, i) => (
        <MProp key={i} name={name} size={0.42} position={[stall.face * (0.18 + (i % 2) * 0.34), 0.69, -0.62 + Math.floor(i / 2) * 0.62]} rotation={i * 0.9} />
      ))}
      {/* Thùng hàng cạnh sạp */}
      <MProp name="p_crate" size={0.5} position={[stall.face * 0.35, 0, 1.25]} rotation={0.3} />
      <MProp name={CRATE_FRUIT[stall.id]} size={0.34} position={[stall.face * 0.35, 0.5, 1.25]} />
      {/* Người bán */}
      <group position={[-stall.face * 0.4, 0, 0]} rotation-y={faceRot}>
        <Mini model={v.model} height={1.2} />
      </group>
    </group>
  );
}

/** Khách đi chợ đi qua đi lại trên lối đi. */
function Shopper({ model, lane, speed, offset }: { model: string; lane: number; speed: number; offset: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = (clock.elapsedTime * speed + offset) % 2;
    const up = t < 1;
    const z = up ? 9.4 - t * 5.6 : 3.8 + (t - 1) * 5.6;
    g.position.set(lane, 0, z);
    g.rotation.y = up ? Math.PI : 0;
  });
  return (
    <group ref={ref}>
      <Mini model={model} height={0.9} walking={() => true} />
    </group>
  );
}

function Water() {
  const boats = useRef<Group>(null);
  useFrame(({ clock }) => {
    boats.current?.children.forEach((c, i) => {
      c.position.y = Math.sin(clock.elapsedTime * 1.4 + i * 1.7) * 0.03 - 0.12;
      c.rotation.z = Math.sin(clock.elapsedTime * 1.1 + i) * 0.03;
    });
  });
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[MAP_COLS / 2, -0.08, RIVER_ROWS / 2 - 1]} receiveShadow>
        <planeGeometry args={[MAP_COLS + 6, RIVER_ROWS + 2]} />
        <meshStandardMaterial color="#4FB3D9" roughness={0.25} metalness={0.1} />
      </mesh>
      {/* Bờ kè */}
      <mesh position={[MAP_COLS / 2, -0.04, RIVER_ROWS - 0.05]} receiveShadow>
        <boxGeometry args={[MAP_COLS + 6, 0.12, 0.2]} />
        <meshStandardMaterial color="#A1887F" />
      </mesh>
      <group ref={boats}>
        <group position={[2.5, -0.12, 1.3]} rotation-y={Math.PI / 2}>
          <MProp name="p_boat_row_small" size={1.5} position={[0, 0, 0]} />
        </group>
        <group position={[8.8, -0.12, 1.2]} rotation-y={-Math.PI / 2}>
          <MProp name="p_boat_row_large" size={1.6} position={[0, 0, 0]} />
        </group>
        <group position={[5.8, -0.12, 0.7]} rotation-y={0.2}>
          <MProp name="n_canoe" size={1.1} position={[0, 0, 0]} />
        </group>
      </group>
      <MProp name="n_lily_large" size={0.4} position={[4.2, -0.07, 1.8]} />
      <MProp name="n_lily_small" size={0.3} position={[7.2, -0.07, 2.1]} />
      <MProp name="n_lily_large" size={0.35} position={[10.5, -0.07, 0.6]} />
      <MProp name="p_structure_platform_dock_small" size={1.3} position={[6, -0.15, 2.3]} />
    </group>
  );
}

function Ground() {
  const tiles = useMemo(() => {
    const t = checkerTileTexture('#EFE2CC', '#E2D2B6').clone();
    t.repeat.set(3, (MAP_ROWS - RIVER_ROWS) / 2);
    t.needsUpdate = true;
    return t;
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[MAP_COLS / 2, -0.01, (MAP_ROWS + RIVER_ROWS) / 2]} receiveShadow>
        <planeGeometry args={[MAP_COLS + 6, MAP_ROWS - RIVER_ROWS + 4]} />
        <meshStandardMaterial color="#9CCC65" roughness={0.95} />
      </mesh>
      {/* Lối đi lát gạch giữa chợ */}
      <mesh rotation-x={-Math.PI / 2} position={[MAP_COLS / 2, 0, (MAP_ROWS + RIVER_ROWS) / 2]} receiveShadow>
        <planeGeometry args={[6, MAP_ROWS - RIVER_ROWS]} />
        <meshStandardMaterial map={tiles} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Decor() {
  return (
    <group>
      {PALMS.map(([x, y, name], i) => (
        <MProp key={i} name={name} size={1.1} position={[x + 0.5, 0, y + 0.5]} rotation={i} />
      ))}
      <MProp name="n_plant_bushlarge" size={0.6} position={[0.4, 0, 6.5]} />
      <MProp name="n_flower_reda" size={0.25} position={[0.6, 0, 6.9]} />
      <MProp name="n_flower_yellowa" size={0.25} position={[11.4, 0, 6.2]} />
      <MProp name="n_plant_bush" size={0.6} position={[11.5, 0, 6.6]} />
      <MProp name="n_flower_purplea" size={0.25} position={[3.2, 0, 9.6]} />
      <MProp name="n_rock_smalla" size={0.45} position={[9.2, 0, 9.6]} />
      <MProp name="u_bench" size={0.9} position={[6, 0, 6.5]} rotation={Math.PI / 2} />
      <MProp name="u_lampsquarefloor" size={0.25} position={[3.3, 0, 3.4]} />
      <MProp name="u_lampsquarefloor" size={0.25} position={[8.7, 0, 3.4]} />
      <MProp name="p_flag_pennant" size={1.0} position={[6, 0, 3.3]} />
      <MProp name="n_log" size={0.7} position={[0.6, 0, 8.2]} rotation={0.4} />
    </group>
  );
}

/**
 * Cảnh chợ 3D trên bờ sông (Kenney + KayKit, CC0): sạp mái che, người bán rao giá, khách đi chợ.
 * Chạm sạp (hoặc tên sạp) → chủ quán đi tới rồi mở bảng mua. Chạm chỗ trống → đi tới đó.
 */
export default function MarketScene3D({
  game,
  onStall,
  width,
  height,
  demo = false,
}: {
  game: GameState;
  onStall: (id: VendorId) => void;
  width: number;
  height: number;
  /** Nền màn đầu: không chạm được, không có chip tên sạp; Chú Tư + chủ quán vẫy chào, camera đung đưa. */
  demo?: boolean;
}) {
  const layout = useMemo(buildMarketLayout, []);
  const walker = useWalker(layout.start);
  const cam = useMemo(makeCamera, []);
  const zoom = demo ? (width < 600 ? 1.45 : 1.25) : width < 600 ? 1.22 : 1.1;
  useMemo(() => fitCamera(cam, Math.max(1, width), Math.max(1, height), ISO_YAW, zoom), [cam, width, height, zoom]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  const goStall = (id: VendorId) => {
    const st = STALLS.find((s) => s.id === id)!;
    const path = findPath(layout, walker.origin(), st.access);
    if (!path) return onStall(id);
    walker.walk(path, () => {
      walker.face({ x: -st.face, y: 0 });
      onStall(id);
    });
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const x = Math.floor(e.point.x);
    const y = Math.floor(e.point.z);
    const st = STALLS.find((s) => x >= s.x && x < s.x + 2 && y >= s.y && y < s.y + 2);
    if (st) return goStall(st.id);
    const path = findPath(layout, walker.origin(), [{ x, y }]);
    if (path) walker.walk(path, () => {});
  };

  const deals = activeDeals(game);
  const p = (x: number, y: number, z: number) => project(cam, x, y, z, width, height);
  return (
    <View style={{ width, height }}>
      <Canvas shadows="percentage" dpr={[1, Math.min(1.5, maxDpr())]} style={{ flex: 1 }}>
        <UseCamera cam={cam} />
        {demo && <DemoOrbit cam={cam} width={width} height={height} zoom={zoom} />}
        <color attach="background" args={['#BDE3F2']} />
        <hemisphereLight args={['#FFF6E5', '#6D4C41', 0.9]} />
        <ambientLight intensity={0.35} color="#FFE0B2" />
        <Sun />
        <group onClick={demo ? undefined : onClick}>
          <Ground />
        </group>
        <Water />
        <Decor />
        {STALLS.map((s) => (
          <group key={s.id} onClick={demo ? undefined : (e: ThreeEvent<MouseEvent>) => (e.stopPropagation(), goStall(s.id))}>
            <StallMesh stall={s} />
          </group>
        ))}
        <Shopper model="mini_male_d" lane={5.2} speed={0.08} offset={0} />
        <Shopper model="mini_female_c" lane={6.9} speed={0.07} offset={1} />
        <Player walker={walker.state} carrying={[]} profile={game.profile} />
        {demo && (
          <group position={[5.2, 0, 9.3]} rotation-y={ISO_YAW}>
            <ModelCharacter model="barbarian" fallback={CHEF_LOOK} hat={CHEF_LOOK} anim={tick % 2 ? 'Cheer' : 'Interact'} />
          </group>
        )}
      </Canvas>
      {/* Tên sạp + người bán rao giá (lớp chữ 2D đè lên cảnh) */}
      {!demo && STALLS.map((s, i) => {
        const v = VENDORS.find((x) => x.id === s.id)!;
        const g = GROUP[v.group];
        // Chip tên sạp nằm trên lối đi trước sạp (không che hình sạp); bong bóng rao trên đầu người bán.
        const chip = p(s.face === 1 ? s.x + 2.55 : s.x - 0.55, 0.1, s.y + 1);
        const head = p(s.x + 1 - s.face * 0.4, 1.5, s.y + 1);
        const deal = deals.find((d) => v.items.includes(d.id));
        const lv = friendLevel(vendorState(game, v.id).friendship);
        return (
          <View key={s.id} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {tick % STALLS.length === i && (
              <Text pointerEvents="none" style={[styles.call, { left: head.x - 75, top: head.y - 44 }]} numberOfLines={2}>
                💬 {vendorCall(game, v.id, tick)}
              </Text>
            )}
            <Pressable
              onPress={() => goStall(s.id)}
              style={[styles.chip, { backgroundColor: g.bg, borderColor: g.fg, left: chip.x - 60, top: chip.y - 18 }]}
              accessibilityRole="button"
              accessibilityLabel={`${v.stall} ${v.name}`}
            >
              <Text style={styles.chipTitle} numberOfLines={1}>
                {v.emoji} {shortName(v.stall)}
              </Text>
              <Text style={[styles.chipSub, { color: g.fg }]} numberOfLines={1}>
                {v.name} {'♥'.repeat(lv)}
                {deal ? ` · 🏷️${fmt(deal.off)}` : ''}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  call: {
    position: 'absolute',
    width: 150,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '700',
    color: colors.brown,
    textAlign: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0D0BC',
  },
  chip: { position: 'absolute', width: 120, borderRadius: 12, borderWidth: 2, paddingHorizontal: 6, paddingVertical: 1, alignItems: 'center' },
  chipTitle: { fontSize: 12, fontWeight: '900', color: colors.brown },
  chipSub: { fontSize: 11, fontWeight: '800' },
});
