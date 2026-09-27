import { useEffect, useState } from 'react';
import { Box3, Color, Mesh, Vector3 } from 'three';
import type { AnimationClip, Material, MeshStandardMaterial, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MODEL_DATA, PROP_BOUNDS } from '../assets/models.generated';

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
          if ((o as Mesh).isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
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

interface TintUniforms {
  uRole: { value: Float32Array };
  uCols: { value: Color[] };
}

const TINT_HEAD = /* glsl */ `
uniform float uRole[32];
uniform vec3 uCols[6];
`;
const TINT_BODY = /* glsl */ `
#include <map_fragment>
{
  vec2 cuv = clamp(vMapUv, 0.0, 0.9999);
  vec2 cell = floor(cuv * vec2(8.0, 4.0));
  float role = uRole[int(cell.x + cell.y * 8.0)];
  if (role > 0.5) {
    // Giữ độ sáng/tối (chuyển sắc) của ô gốc, chỉ đổi màu.
    vec3 W = vec3(0.2126, 0.7152, 0.0722);
    vec3 ref = texture2D(map, (cell + 0.5) / vec2(8.0, 4.0)).rgb;
    float r = dot(diffuseColor.rgb, W) / max(dot(ref, W), 0.02);
    diffuseColor.rgb = uCols[int(role + 0.5)] * clamp(r, 0.3, 1.6);
  }
}
`;

function partOf(o: Object3D): Part | null {
  for (let x: Object3D | null = o; x; x = x.parent) {
    const m = /_(Body|Arm|Leg|Head)/.exec(x.name);
    if (m) return m[1] as Part;
  }
  return null;
}

/** Nhân bản vật liệu từng bộ phận và gắn shader đổi màu theo bảng ô màu. */
function makeTintable(model: CharacterModel, scene: Object3D): TintUniforms[] {
  const list: TintUniforms[] = [];
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const part = partOf(mesh);
    if (!part) return;
    const roles = new Float32Array(32);
    for (const [k, v] of Object.entries(ROLE_MAP[model][part])) {
      const [cx, cy] = k.split(',').map(Number);
      roles[cx + cy * 8] = v;
    }
    const uniforms: TintUniforms = {
      uRole: { value: roles },
      uCols: { value: [0, 1, 2, 3, 4, 5].map(() => new Color(1, 1, 1)) },
    };
    const mat = (mesh.material as Material).clone() as MeshStandardMaterial;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uRole = uniforms.uRole;
      shader.uniforms.uCols = uniforms.uCols;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + TINT_HEAD)
        .replace('#include <map_fragment>', TINT_BODY);
    };
    mat.customProgramCacheKey = () => 'kaykit-tint';
    // Chưa phối màu thì tắt mọi ô (giữ màu gốc).
    mat.userData.tintRoles = roles.slice();
    roles.fill(0);
    mesh.material = mat;
    list.push(uniforms);
    (mesh.userData as { tintRoles?: Float32Array }).tintRoles = mat.userData.tintRoles;
  });
  return list;
}

function applyTint(scene: Object3D, uniforms: TintUniforms[], tint?: CharacterTint) {
  let i = 0;
  scene.traverse((o) => {
    const mesh = o as Mesh;
    const base = (mesh.userData as { tintRoles?: Float32Array }).tintRoles;
    if (!mesh.isMesh || !base) return;
    const u = uniforms[i++];
    if (!u) return;
    if (!tint) {
      u.uRole.value.fill(0);
      return;
    }
    u.uRole.value.set(base);
    const cols = [tint.shirt, tint.shirt, tint.shirt2 ?? tint.shirt, tint.pants, tint.hair, tint.skin];
    cols.forEach((c, k) => u.uCols.value[k].set(c));
  });
}

export function useCharacter(
  model: CharacterModel,
  tint?: CharacterTint
): { scene: Object3D; clips: AnimationClip[]; height: number } | null {
  const g = useGLTFModel(`char_${model}`);
  const anims = useGLTFModel('char_rogue');
  const [inst, setInst] = useState<{ scene: Object3D; clips: AnimationClip[]; height: number; uniforms: TintUniforms[] } | null>(null);
  useEffect(() => {
    if (!g || !anims) return;
    const scene = cloneSkinned(g.scene);
    const uniforms = makeTintable(model, scene);
    const size = new Box3().setFromObject(g.scene).getSize(new Vector3());
    setInst({ scene, clips: anims.animations, height: size.y || 2.4, uniforms });
  }, [g, anims, model]);
  const key = tint ? `${tint.shirt}|${tint.shirt2}|${tint.pants}|${tint.hair}|${tint.skin}` : '';
  useEffect(() => {
    if (inst) applyTint(inst.scene, inst.uniforms, tint);
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
