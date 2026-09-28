/**
 * Mô hình cho màn Chợ (Kenney, CC0) — lấy từ bản sao GitHub của Kenney:
 *
 *   git clone --depth 1 --filter=blob:none --sparse https://github.com/Hidencod/tge-assets.git tge
 *   (cd tge && git sparse-checkout set packs/food-kit packs/nature-kit packs/mini-characters \
 *      packs/city-kit-commercial packs/furniture-kit packs/pirate-kit)
 *   KENNEY_DIR=tge/packs node scripts/build-market-models.mjs
 *
 * Ảnh texture của Kenney là bảng màu phẳng → **nướng thành màu đỉnh (COLOR_0)** rồi bỏ ảnh, bỏ UV:
 * không cần nạp ảnh nên chạy được trên Safari iPhone trong khung Artifact (xem lỗi mất màu trước đây).
 *
 * Kết quả: assets/models/market.glb (+ market.json: kích thước từng mô hình) và assets/models/mini_*.glb
 * (nhân vật đi chợ, chỉ giữ hoạt ảnh idle / walk). Sau đó chạy `node scripts/embed-models.mjs`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Accessor, Document, NodeIO, PropertyType, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, prune, quantize, resample, unpartition, weld } from '@gltf-transform/functions';
import { PNG } from 'pngjs';

const KENNEY = process.env.KENNEY_DIR;
if (!KENNEY) throw new Error('Cần đặt KENNEY_DIR (thư mục packs của tge-assets)');
const OUT = join(process.cwd(), 'assets/models');
mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const pruneAll = () =>
  prune({
    propertyTypes: [
      PropertyType.ACCESSOR, PropertyType.NODE, PropertyType.MESH, PropertyType.SKIN, PropertyType.MATERIAL,
      PropertyType.TEXTURE, PropertyType.ANIMATION, PropertyType.CAMERA, PropertyType.PRIMITIVE_TARGET,
    ],
  });

/** Tên trong game → [gói, file]. */
const PICK = {
  food: ['fish', 'meat-raw', 'meat-ribs', 'whole-ham', 'bacon-raw', 'sausage', 'egg', 'bread', 'loaf-baguette', 'loaf-round', 'cabbage', 'leek', 'onion', 'carrot', 'tomato', 'eggplant', 'paprika', 'corn', 'broccoli', 'watermelon', 'banana', 'pineapple', 'coconut', 'mussel', 'rice-ball', 'cup-coffee', 'soda-bottle', 'carton', 'bag', 'barrel', 'can', 'pumpkin', 'lemon', 'orange', 'grapes', 'apple', 'mushroom'],
  nature: ['tree-palm', 'tree-palmbend', 'tree-palmshort', 'tree-default', 'plant-bush', 'plant-bushlarge', 'grass-large', 'flower-reda', 'flower-yellowa', 'flower-purplea', 'rock-smalla', 'lily-large', 'lily-small', 'canoe', 'log', 'path-stone', 'pot-large'],
  'city-kit-commercial': ['detail-awning-wide', 'detail-awning', 'detail-parasol-a', 'detail-parasol-b', 'detail-overhang-wide', 'building-c', 'building-e', 'building-i'],
  furniture: ['bench', 'stoolbar', 'table', 'cardboardboxopen', 'lampsquarefloor'],
  pirate: ['boat-row-small', 'boat-row-large', 'crate', 'structure-platform-dock-small', 'flag-pennant'],
  // Phong cảnh phố (khu phố 5 nơi, quanh quán, quanh chợ).
  suburban: ['building-type-a', 'building-type-d', 'building-type-h', 'building-type-k', 'building-type-n', 'building-type-t', 'tree-large', 'tree-small', 'fence-low', 'planter'],
  roads: ['road-straight', 'road-crossing', 'light-square', 'electricity-pole', 'construction-cone', 'dumpster'],
  cars: ['sedan', 'taxi', 'van', 'delivery'],
  pets: ['animal-dog', 'animal-cat', 'animal-chick'],
};
const DIR = {
  food: 'food-kit',
  nature: 'nature-kit',
  'city-kit-commercial': 'city-kit-commercial',
  furniture: 'furniture-kit',
  pirate: 'pirate-kit',
  suburban: 'city-kit-suburban',
  roads: 'city-kit-roads',
  cars: 'car-kit',
  pets: 'cube-pets',
};
const PREFIX = { food: 'f_', nature: 'n_', 'city-kit-commercial': 'c_', furniture: 'u_', pirate: 'p_', suburban: 's_', roads: 'r_', cars: 'v_', pets: 'a_' };
const MINIS = ['character-female-a', 'character-female-c', 'character-male-b', 'character-male-d'];

const toLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const decoded = new Map();
function decodePng(tex) {
  if (!decoded.has(tex)) decoded.set(tex, PNG.sync.read(Buffer.from(tex.getImage())));
  return decoded.get(tex);
}

/** Nướng màu (texture × baseColorFactor) vào COLOR_0, bỏ ảnh / UV / tangent, dùng một vật liệu trắng chung. */
function bakeVertexColors(doc) {
  const root = doc.getRoot();
  const white = doc.createMaterial('kenney').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.8).setMetallicFactor(0);
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      const factor = mat ? mat.getBaseColorFactor() : [1, 1, 1, 1];
      const tex = mat?.getBaseColorTexture();
      const uv = prim.getAttribute('TEXCOORD_0');
      const pos = prim.getAttribute('POSITION');
      const n = pos.getCount();
      const colors = new Float32Array(n * 3);
      const png = tex && uv ? decodePng(tex) : null;
      const t = [0, 0];
      for (let i = 0; i < n; i += 1) {
        let r = 1;
        let g = 1;
        let b = 1;
        if (png) {
          uv.getElement(i, t);
          const x = Math.min(png.width - 1, Math.max(0, Math.floor((((t[0] % 1) + 1) % 1) * png.width)));
          const y = Math.min(png.height - 1, Math.max(0, Math.floor((((t[1] % 1) + 1) % 1) * png.height)));
          const o = (y * png.width + x) * 4;
          r = toLinear(png.data[o]);
          g = toLinear(png.data[o + 1]);
          b = toLinear(png.data[o + 2]);
        }
        colors[i * 3] = r * factor[0];
        colors[i * 3 + 1] = g * factor[1];
        colors[i * 3 + 2] = b * factor[2];
      }
      prim.setAttribute('COLOR_0', doc.createAccessor().setType(Accessor.Type.VEC3).setArray(colors).setBuffer(pos.getBuffer()));
      for (const sem of ['TEXCOORD_0', 'TEXCOORD_1', 'TANGENT']) if (prim.getAttribute(sem)) prim.setAttribute(sem, null);
      prim.setMaterial(white);
    }
  }
  for (const t of root.listTextures()) t.dispose();
}

// ---------- Đồ vật chợ: gộp vào market.glb ----------
const market = new Document();
const meta = {};
for (const [pack, names] of Object.entries(PICK)) {
  for (const file of names) {
    const src = await io.read(join(KENNEY, DIR[pack], `${file}.glb`));
    bakeVertexColors(src);
    const name = PREFIX[pack] + file.replace(/-/g, '_');
    const scene = src.getRoot().getDefaultScene() ?? src.getRoot().listScenes()[0];
    const b = getBounds(scene);
    meta[name] = { min: b.min.map((v) => +v.toFixed(3)), max: b.max.map((v) => +v.toFixed(3)) };
    const group = src.createNode(name);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      group.addChild(child);
    }
    scene.addChild(group);
    for (const a of src.getRoot().listAnimations()) a.dispose();
    if (process.env.SIZES) {
      // Đo dung lượng từng mô hình sau khi nén (để giữ ngân sách).
      const probe = new Document();
      mergeDocuments(probe, src);
      await probe.transform(unpartition(), weld(), dedup(), pruneAll(), quantize({ quantizeColor: 8 }));
      console.log('  ', name, Math.round((await io.writeBinary(probe)).byteLength / 1024), 'KB');
    }
    mergeDocuments(market, src);
  }
}
const scenes = market.getRoot().listScenes();
for (const sc of scenes.slice(1)) {
  for (const child of sc.listChildren()) scenes[0].addChild(child);
  sc.dispose();
}
market.getRoot().setDefaultScene(scenes[0]);
await market.transform(unpartition(), weld(), dedup(), pruneAll(), quantize({ quantizeColor: 8 }));
await io.write(join(OUT, 'market.glb'), market);
writeFileSync(join(OUT, 'market.json'), JSON.stringify(meta, null, 1));
console.log('đồ vật chợ:', Object.keys(meta).length);

// ---------- Người đi chợ (Kenney Mini Characters) ----------
const KEEP = ['idle', 'walk', 'interact-right', 'emote-yes'];
for (const file of MINIS) {
  const doc = await io.read(join(KENNEY, 'mini-characters', `${file}.glb`));
  bakeVertexColors(doc);
  for (const anim of doc.getRoot().listAnimations()) {
    if (!KEEP.includes(anim.getName())) {
      for (const ch of anim.listChannels()) ch.dispose();
      for (const sp of anim.listSamplers()) sp.dispose();
      anim.dispose();
    }
  }
  await doc.transform(pruneAll(), resample(), dedup(), pruneAll());
  const name = 'mini_' + file.replace('character-', '').replace('-', '_');
  await io.write(join(OUT, `${name}.glb`), doc);
  console.log('nhân vật', name, doc.getRoot().listAnimations().map((a) => a.getName()).join(','));
}
