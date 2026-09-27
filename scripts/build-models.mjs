/**
 * Tối ưu mô hình KayKit (CC0) cho game: chỉ giữ phần cần dùng, gộp đồ vật vào một file.
 *
 *   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
 *   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0
 *   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0
 *   KAYKIT_DIR=<thư mục chứa 3 repo> node scripts/build-models.mjs
 *
 * Kết quả: assets/models/char_*.glb, assets/models/props.glb, assets/models/props.json (kích thước từng đồ vật).
 * Sau đó chạy `node scripts/embed-models.mjs` để nhúng vào mã nguồn.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document, NodeIO, PropertyType, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, prune, resample, unpartition } from '@gltf-transform/functions';

const KAYKIT = process.env.KAYKIT_DIR;
if (!KAYKIT) throw new Error('Cần đặt KAYKIT_DIR');
const OUT = join(process.cwd(), 'assets/models');
mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
/** Bỏ hẳn mọi phần không còn dùng (mặc định prune giữ lại accessor mồ côi). */
const pruneAll = () =>
  prune({
    propertyTypes: [
      PropertyType.ACCESSOR, PropertyType.NODE, PropertyType.MESH, PropertyType.SKIN, PropertyType.MATERIAL,
      PropertyType.TEXTURE, PropertyType.ANIMATION, PropertyType.CAMERA, PropertyType.PRIMITIVE_TARGET,
    ],
  });

// ---------- Nhân vật ----------
const CHAR_DIR = join(KAYKIT, 'KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf');
const CHARACTERS = ['Rogue', 'Knight', 'Mage', 'Barbarian'];
/** Hoạt ảnh giữ lại (chỉ lưu trong Rogue, các nhân vật khác dùng chung vì cùng bộ xương). */
const KEEP_ANIMS = ['Idle', 'Walking_A', 'Running_A', 'Sit_Chair_Idle', 'Interact', 'Use_Item', 'Cheer', 'PickUp'];
/** Bỏ vũ khí, khiên, mũ giáp, áo choàng — chỉ giữ người. */
const DROP_NODE = /(Sword|Shield|Axe|Crossbow|Knife|Throwable|Wand|Staff|Spellbook|Mug|Helmet|Hat|Cape)/i;

for (const name of CHARACTERS) {
  const doc = await io.read(join(CHAR_DIR, `${name}.glb`));
  const root = doc.getRoot();
  for (const node of root.listNodes()) if (DROP_NODE.test(node.getName())) node.dispose();
  for (const anim of root.listAnimations()) {
    if (name !== 'Rogue' || !KEEP_ANIMS.includes(anim.getName())) {
      // Phải huỷ cả sampler/channel, nếu không dữ liệu hoạt ảnh vẫn bị ghi ra file.
      for (const ch of anim.listChannels()) ch.dispose();
      for (const sp of anim.listSamplers()) sp.dispose();
      anim.dispose();
    }
  }
  await doc.transform(pruneAll(), dedup(), resample(), pruneAll());
  const file = join(OUT, `char_${name.toLowerCase()}.glb`);
  await io.write(file, doc);
  console.log('nhân vật', name, 'hoạt ảnh:', root.listAnimations().map((a) => a.getName()).join(','));
}

// ---------- Đồ vật nhà hàng + trang trí ----------
const REST = join(KAYKIT, 'KayKit-Restaurant-Bits-1.0/addons/kaykit_restaurant_bits/Assets/gltf');
const FURN = join(KAYKIT, 'KayKit-Furniture-Bits-1.0/addons/kaykit_furniture_bits/Assets/gltf');
const PROPS = {
  [REST]: [
    'stove_single', 'extractorhood', 'fridge_A', 'kitchencounter_straight_A', 'kitchencounter_straight_B', 'kitchencounter_sink',
    'kitchentable_A', 'cuttingboard', 'knife', 'pot_A', 'pot_A_stew', 'pan_A', 'lid_A', 'plate', 'bowl', 'stew_bowl', 'food_dinner',
    'table_round_A', 'chair_A', 'crate_steak', 'crate_onions', 'crate_lettuce', 'crate_tomatoes', 'crate_buns',
    'jar_A_medium', 'jar_B_small', 'jar_C_medium', 'ketchup', 'mustard', 'menu', 'dishrack_plates', 'shelf_papertowel_decorated',
    'food_ingredient_steak', 'food_ingredient_steak_pieces', 'food_ingredient_onion', 'food_ingredient_onion_chopped',
    'food_ingredient_lettuce', 'food_ingredient_lettuce_chopped', 'food_ingredient_ham', 'food_ingredient_carrot', 'food_ingredient_carrot_pieces',
    'food_ingredient_tomato', 'food_ingredient_tomato_slices', 'door_A', 'wall_window_closed',
  ],
  [FURN]: ['cactus_medium_A', 'cactus_small_B', 'lamp_standing', 'pictureframe_large_A', 'pictureframe_medium', 'rug_rectangle_stripes_A', 'shelf_B_small_decorated'],
};

const props = new Document();
const meta = {};
for (const [dir, names] of Object.entries(PROPS)) {
  for (const name of names) {
    const src = await io.read(join(dir, `${name}.gltf`));
    const scene = src.getRoot().getDefaultScene() ?? src.getRoot().listScenes()[0];
    const b = getBounds(scene);
    meta[name] = { min: b.min.map((v) => +v.toFixed(3)), max: b.max.map((v) => +v.toFixed(3)) };
    // Gói mọi node gốc của đồ vật vào một node mang tên đồ vật.
    const group = src.createNode(name);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      group.addChild(child);
    }
    scene.addChild(group);
    mergeDocuments(props, src);
  }
}
// Gộp mọi cảnh thành một.
const scenes = props.getRoot().listScenes();
const main = scenes[0];
for (const sc of scenes.slice(1)) {
  for (const child of sc.listChildren()) main.addChild(child);
  sc.dispose();
}
props.getRoot().setDefaultScene(main);
await props.transform(unpartition(), dedup(), pruneAll());
await io.write(join(OUT, 'props.glb'), props);
writeFileSync(join(OUT, 'props.json'), JSON.stringify(meta, null, 1));
console.log('đồ vật:', Object.keys(meta).length);
