import { useEffect, useMemo, useRef } from 'react';
import { AnimationMixer, LoopRepeat } from 'three';
import type { AnimationAction } from 'three';
import { useFrame } from '../../three/fiber';
import { useCharacter } from '../../three/models';
import type { CharacterModel } from '../../three/models';
import Character, { Hat } from './Character';
import type { Look } from './looks';
import DishModel from './Dish';

/** Chiều cao nhân vật mong muốn (ô). */
const HEIGHT = 1.08;
/** Đầu nhân vật KayKit to hơn đầu nhân vật tự vẽ. */
const HAT_SCALE = 1.55;

/**
 * Nhân vật KayKit có hoạt ảnh (đứng / đi / ngồi). Chưa nạp xong hoặc lỗi thì dùng nhân vật tự vẽ `fallback`.
 * Gốc toạ độ ở giữa hai bàn chân, mặt hướng +z — giống `Character`.
 */
export default function ModelCharacter({
  model,
  fallback,
  isMoving,
  seated = false,
  carrying = [],
  hat,
  shadows = true,
  anim,
}: {
  model: CharacterModel;
  fallback: Look;
  isMoving?: () => boolean;
  seated?: boolean;
  carrying?: string[];
  /** Mũ đội thêm (lấy từ nhân vật tự tạo). */
  hat?: Look;
  shadows?: boolean;
  /** Ép một hoạt ảnh cụ thể (vd 'Cheer', 'Interact') — dùng cho đầu bếp dẫn đường. */
  anim?: string;
}) {
  const tint = useMemo(
    () => ({ shirt: fallback.shirt, shirt2: fallback.apron ?? fallback.accent, pants: fallback.pants, hair: fallback.hair, skin: fallback.skin }),
    [fallback.shirt, fallback.apron, fallback.accent, fallback.pants, fallback.hair, fallback.skin]
  );
  const inst = useCharacter(model, tint);
  const mixer = useMemo(() => (inst ? new AnimationMixer(inst.scene) : null), [inst]);
  const actions = useRef<Record<string, AnimationAction>>({});
  const current = useRef<string>('');

  useEffect(() => {
    if (!inst || !mixer) return;
    const map: Record<string, AnimationAction> = {};
    for (const clip of inst.clips) {
      const a = mixer.clipAction(clip);
      a.setLoop(LoopRepeat, Infinity);
      map[clip.name] = a;
    }
    actions.current = map;
    current.current = '';
    inst.scene.traverse((o) => {
      o.castShadow = shadows;
    });
    return () => {
      mixer.stopAllAction();
    };
  }, [inst, mixer, shadows]);

  useFrame((_, dt) => {
    if (!mixer) return;
    const want = anim && actions.current[anim] ? anim : seated ? 'Sit_Chair_Idle' : isMoving?.() ? 'Walking_A' : 'Idle';
    if (want !== current.current) {
      const next = actions.current[want];
      const prev = actions.current[current.current];
      if (next) {
        next.reset().fadeIn(0.18).play();
        prev?.fadeOut(0.18);
        current.current = want;
      }
    }
    mixer.update(Math.min(dt, 0.1));
  });

  if (!inst) {
    return <Character look={fallback} isMoving={isMoving} seated={seated} carrying={carrying} shadows={shadows} />;
  }

  const scale = HEIGHT / inst.height;
  return (
    <group>
      <primitive object={inst.scene} scale={scale} position={[0, seated ? 0.02 : 0, seated ? -0.05 : 0]} />
      {hat?.hat && (
        // Mũ tự vẽ (thiết kế cho đầu nhân vật cao ~1) phóng to cho vừa đầu chibi, đặt trên đỉnh đầu.
        <group position={[0, HEIGHT - 0.1 - 1.0 * HAT_SCALE, seated ? -0.05 : 0.02]} scale={HAT_SCALE}>
          <Hat look={hat} cast={shadows} />
        </group>
      )}
      {carrying.slice(0, 2).map((dish, i) => (
        <group key={i} position={[carrying.length > 1 ? (i === 0 ? -0.17 : 0.17) : 0, 0.53, 0.34]}>
          <DishModel dish={dish} scale={0.85} />
        </group>
      ))}
    </group>
  );
}
