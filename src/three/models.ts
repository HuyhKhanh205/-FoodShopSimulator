import { useEffect, useState } from 'react';
import { Box3, Mesh, Vector3 } from 'three';
import type { AnimationClip, Object3D } from 'three';
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

export function useCharacter(model: CharacterModel): { scene: Object3D; clips: AnimationClip[]; height: number } | null {
  const g = useGLTFModel(`char_${model}`);
  const anims = useGLTFModel('char_rogue');
  const [inst, setInst] = useState<{ scene: Object3D; clips: AnimationClip[]; height: number } | null>(null);
  useEffect(() => {
    if (!g || !anims) return;
    const scene = cloneSkinned(g.scene);
    const size = new Box3().setFromObject(g.scene).getSize(new Vector3());
    setInst({ scene, clips: anims.animations, height: size.y || 2.4 });
  }, [g, anims]);
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
