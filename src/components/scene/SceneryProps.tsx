import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { AnimationMixer, Color, LoopRepeat, Matrix4, Quaternion, Vector3 } from 'three';
import type { AnimationAction, BufferGeometry, InstancedMesh, Material, Mesh } from 'three';
import { MARKET_BOUNDS } from '../../assets/models.generated';
import { useFrame } from '../../three/fiber';
import { marketPropSize, useGLTFModel, useMarketProp, useMini } from '../../three/models';

type Vec3 = [number, number, number];

/** Đồ vật Kenney đặt theo kích thước mong muốn (cạnh lớn nhất), tâm ở giữa đáy. */
export function MProp({ name, position, size, rotation = 0 }: { name: string; position: Vec3; size: number; rotation?: number }) {
  const obj = useMarketProp(name);
  const dims = marketPropSize(name);
  const scale = size / Math.max(dims[0], dims[2], 0.01);
  if (!obj) return null;
  // Căn tâm đáy (một số mô hình có gốc ở góc, vd đồ nội thất).
  return (
    <group position={position} rotation-y={rotation} scale={scale}>
      <primitive object={obj} position={[-(dims[0] / 2 + minOf(name, 0)), -minOf(name, 1), -(dims[2] / 2 + minOf(name, 2))]} />
    </group>
  );
}
const minOf = (name: string, axis: number) => MARKET_BOUNDS[name]?.min[axis] ?? 0;

/** Người bán / khách đi chợ (Kenney Mini Characters) có hoạt ảnh. */
export function Mini({ model, height = 0.95, walking }: { model: string; height?: number; walking?: () => boolean }) {
  const inst = useMini(model);
  const mixer = useMemo(() => (inst ? new AnimationMixer(inst.scene) : null), [inst]);
  const actions = useRef<Record<string, AnimationAction>>({});
  const current = useRef('');
  useEffect(() => {
    if (!inst || !mixer) return;
    for (const clip of inst.clips) {
      const a = mixer.clipAction(clip);
      a.setLoop(LoopRepeat, Infinity);
      actions.current[clip.name] = a;
    }
    inst.scene.traverse((o) => {
      o.castShadow = true;
    });
    return () => {
      mixer.stopAllAction();
    };
  }, [inst, mixer]);
  useFrame((_, dt) => {
    if (!mixer) return;
    const want = walking?.() ? 'walk' : 'idle';
    if (want !== current.current && actions.current[want]) {
      actions.current[want].reset().fadeIn(0.2).play();
      actions.current[current.current]?.fadeOut(0.2);
      current.current = want;
    }
    mixer.update(Math.min(dt, 0.1));
  });
  if (!inst) return null;
  return <primitive object={inst.scene} scale={height / inst.height} />;
}


// ---------------- Đồ vật lặp lại: vẽ theo lô (InstancedMesh) + ẩn / "bật" theo khoảng cách ----------------

export interface PropSpot {
  name: string;
  x: number;
  z: number;
  size: number;
  rot?: number;
  /** Nhuộm màu (nhân với màu gốc) — vd nhà Kenney trắng thành hồng, vàng, xanh pastel. */
  tint?: string;
  /** Kê cao (vd trên bến). */
  y?: number;
}

/** Tâm nhìn + bán kính nhìn hiện tại (cập nhật ~4 lần / giây bởi cảnh). `valid` = false thì hiện hết. */
export interface ViewFocus {
  x: number;
  z: number;
  R: number;
  valid: boolean;
}

const ZERO = new Matrix4().makeScale(0, 0, 0);

/**
 * Mỗi (mô hình × lưới con) là một InstancedMesh cho mọi chỗ đặt → vài chục lần vẽ cho cả phố.
 * Chỗ đặt ngoài tầm nhìn thì thu về 0 (không tốn đỉnh); lại vào tầm thì phóng từ 0,6 → 1 như Farm Together.
 */
export function PropInstances({ spots, focus }: { spots: PropSpot[]; focus: React.MutableRefObject<ViewFocus> }) {
  const gltf = useGLTFModel('market');
  const meshes = useRef<(InstancedMesh | null)[]>([]);
  const built = useMemo(() => {
    if (!gltf) return [];
    const byName = new Map<string, PropSpot[]>();
    for (const s of spots) byName.set(s.name, [...(byName.get(s.name) ?? []), s]);
    const out: { geometry: BufferGeometry; material: Material | Material[]; local: Matrix4; spots: { base: Matrix4; x: number; z: number; tint?: string }[] }[] = [];
    for (const [name, list] of byName) {
      const src = gltf.scene.getObjectByName(name);
      if (!src) continue;
      const node = src.clone(true);
      node.position.set(0, 0, 0);
      node.rotation.set(0, 0, 0);
      node.scale.set(1, 1, 1);
      node.updateMatrixWorld(true);
      const dims = marketPropSize(name);
      const offset = new Matrix4().makeTranslation(-(dims[0] / 2 + minOf(name, 0)), -minOf(name, 1), -(dims[2] / 2 + minOf(name, 2)));
      const bases = list.map((sp) => {
        const scale = sp.size / Math.max(dims[0], dims[2], 0.01);
        const m = new Matrix4().compose(new Vector3(sp.x, sp.y ?? 0, sp.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), sp.rot ?? 0), new Vector3(scale, scale, scale));
        return { base: m.multiply(offset), x: sp.x, z: sp.z, tint: sp.tint };
      });
      node.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        out.push({ geometry: mesh.geometry, material: mesh.material, local: mesh.matrixWorld.clone(), spots: bases });
      });
    }
    return out;
  }, [gltf, spots]);

  // Màu nhuộm từng chỗ đặt (chỉ khi có ít nhất một chỗ nhuộm, để khỏi đổi shader của đồ vật thường).
  useLayoutEffect(() => {
    const white = new Color('#FFFFFF');
    built.forEach((b, i) => {
      const m = meshes.current[i];
      if (!m || !b.spots.some((sp) => sp.tint)) return;
      b.spots.forEach((sp, j) => m.setColorAt(j, sp.tint ? new Color(sp.tint) : white));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  }, [built]);

  // Trạng thái hiện / phóng to của từng chỗ đặt (dùng chung cho mọi lưới con cùng mô hình).
  const state = useRef<Map<string, { shown: boolean; s: number }>>(new Map());
  const acc = useRef(1);
  const [grow, sc, back, out] = useMemo(() => [new Matrix4(), new Matrix4(), new Matrix4(), new Matrix4()], []);
  useFrame((_, dt) => {
    acc.current += dt;
    const check = acc.current >= 0.25;
    if (check) acc.current = 0;
    const f = focus.current;
    let changed = false;
    const keyOf = (sp: { x: number; z: number }) => `${sp.x},${sp.z}`;
    // Cập nhật trạng thái mỗi chỗ đặt một lần.
    const seen = new Set<string>();
    for (const b of built) {
      for (const sp of b.spots) {
        const k = keyOf(sp);
        if (seen.has(k)) continue;
        seen.add(k);
        let st = state.current.get(k);
        if (!st) {
          st = { shown: true, s: 1 };
          state.current.set(k, st);
          changed = true;
        }
        if (check) {
          const vis = !f.valid || Math.hypot(sp.x - f.x, sp.z - f.z) < f.R;
          if (vis !== st.shown) {
            st.shown = vis;
            st.s = vis ? 0.6 : 0;
            changed = true;
          }
        }
        if (st.shown && st.s < 1) {
          st.s = Math.min(1, st.s + dt * 1.6);
          changed = true;
        }
      }
    }
    if (check) {
      let n = 0;
      state.current.forEach((v) => (n += v.shown ? 1 : 0));
      (globalThis as { __visibleProps?: string }).__visibleProps = `${n}/${state.current.size}`;
    }
    if (!changed) return;
    built.forEach((b, i) => {
      const m = meshes.current[i];
      if (!m) return;
      b.spots.forEach((sp, j) => {
        const st = state.current.get(keyOf(sp))!;
        if (!st.shown) {
          m.setMatrixAt(j, ZERO);
          return;
        }
        // Phóng quanh gốc chỗ đặt: T(p) · S(s) · T(−p) · base · local.
        grow.makeTranslation(sp.x, 0, sp.z).multiply(sc.makeScale(st.s, st.s, st.s)).multiply(back.makeTranslation(-sp.x, 0, -sp.z));
        m.setMatrixAt(j, out.copy(grow).multiply(sp.base).multiply(b.local));
      });
      m.instanceMatrix.needsUpdate = true;
    });
  });

  return (
    <group>
      {built.map((b, i) => (
        <instancedMesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          args={[b.geometry, b.material, b.spots.length]}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
