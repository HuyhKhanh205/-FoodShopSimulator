import { useEffect, useState } from 'react';
import { Box3, DataTexture, NearestFilter, RGBAFormat, SRGBColorSpace, Vector3 } from 'three';
import type { AnimationClip, Material, Mesh, MeshStandardMaterial, Object3D, Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MODEL_DATA, PROP_BOUNDS } from '../assets/models.generated';
import { CHAR_PALETTES, PALETTE_COLS, PALETTE_ROWS, PALETTE_SAMPLES, PROP_PALETTES, PROP_PALETTE_H, PROP_PALETTE_W } from '../assets/palettes.generated';

export type CharacterModel = 'rogue' | 'knight' | 'mage' | 'barbarian';
export const CHARACTER_MODELS: CharacterModel[] = ['rogue', 'knight', 'mage', 'barbarian'];

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64.length; i += 1) LOOKUP[B64.charCodeAt(i)] = i;

/** Giải base64 → ArrayBuffer (không phụ thuộc atob để chạy được cả trên app). */
function decodeBase64(b64: string): ArrayBuffer {
  const len = b64.length;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((len * 3) / 4 - pad);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = LOOKUP[b64.charCodeAt(i)];
    const b = LOOKUP[b64.charCodeAt(i + 1)];
    const c = LOOKUP[b64.charCodeAt(i + 2)];
    const d = LOOKUP[b64.charCodeAt(i + 3)];
    out[p++] = (a << 2) | (b >> 4);
    if (p < out.length) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < out.length) out[p++] = ((c & 3) << 6) | d;
  }
  return out.buffer;
}

/** RGB → DataTexture sRGB (lọc điểm gần nhất để không lem giữa các ô màu). */
function rgbTexture(rgb: Uint8Array, w: number, h: number): DataTexture {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0, o = 0; i < rgb.length; i += 3, o += 4) {
    data[o] = rgb[i];
    data[o + 1] = rgb[i + 1];
    data[o + 2] = rgb[i + 2];
    data[o + 3] = 255;
  }
  const tex = new DataTexture(data, w, h, RGBAFormat);
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

const propTextures = new Map<string, DataTexture | null>();
/** Bảng màu đồ vật theo tên vật liệu (ảnh PNG trong GLB đã bị bỏ khi nhúng). */
function propTexture(material: string): DataTexture | null {
  if (!propTextures.has(material)) {
    const b64 = PROP_PALETTES[material];
    propTextures.set(material, b64 ? rgbTexture(new Uint8Array(decodeBase64(b64)), PROP_PALETTE_W, PROP_PALETTE_H) : null);
  }
  return propTextures.get(material)!;
}

const cache = new Map<string, Promise<GLTF>>();
const done = new Map<string, GLTF | null>();

function load(name: string): Promise<GLTF> {
  let p = cache.get(name);
  if (!p) {
    p = new Promise<GLTF>((resolve, reject) => {
      const data = MODEL_DATA[name];
      if (!data) {
        reject(new Error(`Không có mô hình ${name}`));
        return;
      }
      try {
        new GLTFLoader().parse(decodeBase64(data), '', resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
    p.then(
      (g) => {
        g.scene.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          // Gắn bảng màu cho vật liệu đồ vật (không cần nạp ảnh — chạy được trên Safari iPhone).
          const mat = mesh.material as MeshStandardMaterial;
          const tex = mat && !mat.map ? propTexture(mat.name) : null;
          if (tex) {
            mat.map = tex;
            mat.needsUpdate = true;
          }
        });
        done.set(name, g);
      },
      () => done.set(name, null)
    );
    cache.set(name, p);
  }
  return p;
}

/** Nạp một mô hình; trả về null khi đang nạp hoặc bị lỗi (khi đó dùng mô hình tự vẽ). */
export function useGLTFModel(name: string): GLTF | null {
  const [g, setG] = useState<GLTF | null>(() => done.get(name) ?? null);
  useEffect(() => {
    let alive = true;
    load(name).then(
      (x) => alive && setG(x),
      () => alive && setG(null)
    );
    return () => {
      alive = false;
    };
  }, [name]);
  return g;
}

/** Nạp trước mọi mô hình (gọi khi mở game để lúc vào quán không phải chờ). */
export function preloadModels() {
  for (const name of Object.keys(MODEL_DATA)) load(name).catch(() => {});
}

// ---------- Nhân vật ----------

/** Màu phối cho nhân vật KayKit: áo, áo phụ (viền/khăn), quần, tóc, da. */
export interface CharacterTint {
  shirt: string;
  shirt2?: string;
  pants: string;
  hair: string;
  skin: string;
}

/**
 * Texture KayKit là bảng màu 8×4 ô chuyển sắc. Mỗi bộ phận (thân, tay, chân, đầu) dùng vài ô;
 * bảng dưới cho biết ô "cột,hàng" nào là áo (1), áo phụ (2), quần (3), tóc (4), da (5).
 * Các ô không ghi (giày, thắt lưng, kim loại...) giữ nguyên màu gốc.
 */
type Part = 'Body' | 'Arm' | 'Leg' | 'Head';
const ROLE_MAP: Record<CharacterModel, Record<Part, Record<string, number>>> = {
  rogue: {
    Body: { '0,1': 1, '1,1': 2 },
    Arm: { '0,1': 1, '1,1': 2, '5,2': 2 },
    Leg: { '7,1': 3 },
    Head: { '0,0': 5, '1,0': 4 },
  },
  knight: {
    Body: { '3,0': 1, '0,1': 2 },
    Arm: { '3,0': 1 },
    Leg: { '3,0': 3 },
    Head: { '0,0': 5, '1,0': 4 },
  },
  mage: {
    Body: { '0,1': 1, '2,2': 2 },
    Arm: { '0,1': 1 },
    Leg: { '7,1': 3 },
    Head: { '0,0': 5, '1,0': 4 },
  },
  barbarian: {
    Body: { '6,0': 5, '2,1': 1, '0,1': 2 },
    Arm: { '6,0': 5, '1,1': 2, '2,1': 1 },
    Leg: { '7,1': 3, '2,1': 3 },
    Head: { '0,0': 5, '1,0': 4 },
  },
};

const paletteBytes = new Map<CharacterModel, Uint8Array>();
function palette(model: CharacterModel): Uint8Array | null {
  let p = paletteBytes.get(model);
  if (!p) {
    const b64 = CHAR_PALETTES[model];
    if (!b64) return null;
    p = new Uint8Array(decodeBase64(b64));
    paletteBytes.set(model, p);
  }
  return p;
}

const hexRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const tintCache = new Map<string, DataTexture>();

/**
 * Texture nhỏ (8 × 128) thay cho texture gốc: ô nào là áo / quần / tóc / da thì tô màu mới
 * (giữ độ sáng tối chuyển sắc của ô gốc), ô khác giữ nguyên. Không dùng shader tự viết
 * nên chạy được trên mọi máy (Safari iPhone, app).
 */
function tintTexture(model: CharacterModel, part: Part, tint?: CharacterTint): DataTexture | null {
  const key = tint ? `${model}|${part}|${tint.shirt}|${tint.shirt2}|${tint.pants}|${tint.hair}|${tint.skin}` : `${model}|orig`;
  const hit = tintCache.get(key);
  if (hit) return hit;
  const src = palette(model);
  if (!src) return null;
  // Không phối màu: giữ nguyên màu gốc (vẫn dùng bảng màu thay cho ảnh).
  const roles: Record<string, number> = tint ? ROLE_MAP[model][part] : {};
  const cols = !tint ? [] : [null, tint.shirt, tint.shirt2 ?? tint.shirt, tint.pants, tint.hair, tint.skin].map((c) => (c ? hexRgb(c) : null));
  const W = PALETTE_COLS;
  const H = PALETTE_ROWS * PALETTE_SAMPLES;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    const cy = Math.floor(y / PALETTE_SAMPLES);
    const mid = cy * PALETTE_SAMPLES + (PALETTE_SAMPLES >> 1);
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 3;
      const o = (y * W + x) * 4;
      const role = roles[`${x},${cy}`] ?? 0;
      const target = cols[role];
      if (target) {
        const m = (mid * W + x) * 3;
        const ratio = Math.min(1.5, Math.max(0.35, lum(src[i], src[i + 1], src[i + 2]) / Math.max(8, lum(src[m], src[m + 1], src[m + 2]))));
        data[o] = Math.min(255, target[0] * ratio);
        data[o + 1] = Math.min(255, target[1] * ratio);
        data[o + 2] = Math.min(255, target[2] * ratio);
      } else {
        data[o] = src[i];
        data[o + 1] = src[i + 1];
        data[o + 2] = src[i + 2];
      }
      data[o + 3] = 255;
    }
  }
  const tex = new DataTexture(data, W, H, RGBAFormat);
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  tintCache.set(key, tex);
  return tex;
}

interface TintSlot {
  part: Part;
  mat: MeshStandardMaterial;
  original: Texture | null;
}

function partOf(o: Object3D): Part | null {
  for (let x: Object3D | null = o; x; x = x.parent) {
    const m = /_(Body|Arm|Leg|Head)/.exec(x.name);
    if (m) return m[1] as Part;
  }
  return null;
}

/** Nhân bản vật liệu từng bộ phận để mỗi nhân vật đổi texture riêng. */
function makeTintable(scene: Object3D): TintSlot[] {
  const list: TintSlot[] = [];
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const part = partOf(mesh);
    if (!part) return;
    const mat = (mesh.material as Material).clone() as MeshStandardMaterial;
    mesh.material = mat;
    list.push({ part, mat, original: mat.map });
  });
  return list;
}

function applyTint(model: CharacterModel, slots: TintSlot[], tint?: CharacterTint) {
  for (const sl of slots) {
    const next = tintTexture(model, sl.part, tint) ?? sl.original;
    if (sl.mat.map !== next) {
      sl.mat.map = next;
      sl.mat.needsUpdate = true;
    }
  }
}

export function useCharacter(
  model: CharacterModel,
  tint?: CharacterTint
): { scene: Object3D; clips: AnimationClip[]; height: number } | null {
  const g = useGLTFModel(`char_${model}`);
  const anims = useGLTFModel('char_rogue');
  const [inst, setInst] = useState<{ scene: Object3D; clips: AnimationClip[]; height: number; slots: TintSlot[] } | null>(null);
  useEffect(() => {
    if (!g || !anims) return;
    const scene = cloneSkinned(g.scene);
    const slots = makeTintable(scene);
    const size = new Box3().setFromObject(g.scene).getSize(new Vector3());
    setInst({ scene, clips: anims.animations, height: size.y || 2.4, slots });
  }, [g, anims, model]);
  const key = tint ? `${tint.shirt}|${tint.shirt2}|${tint.pants}|${tint.hair}|${tint.skin}` : '';
  useEffect(() => {
    if (inst) applyTint(model, inst.slots, tint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst, key]);
  return inst;
}

// ---------- Đồ vật ----------

export type PropName = keyof typeof PROP_BOUNDS | string;

/** Bản sao một đồ vật trong props.glb (null khi chưa nạp xong / lỗi). */
export function useProp(name: PropName): Object3D | null {
  const g = useGLTFModel('props');
  const [obj, setObj] = useState<Object3D | null>(null);
  useEffect(() => {
    if (!g) return;
    const src = g.scene.getObjectByName(name);
    setObj(src ? src.clone(true) : null);
  }, [g, name]);
  return obj;
}

export function propSize(name: string): [number, number, number] {
  const b = PROP_BOUNDS[name];
  if (!b) return [1, 1, 1];
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
}
