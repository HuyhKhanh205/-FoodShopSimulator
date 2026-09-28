import { useRef } from 'react';
import { maxDpr } from '../../game/settings';
import { StyleSheet, Text, View } from 'react-native';
import type { Group } from 'three';
import { Canvas, useFrame } from '../../three/fiber';
import Character from './Character';
import ModelCharacter from './ModelCharacter';
import type { CharacterModel } from '../../three/models';
import type { Look } from './looks';

function Turntable({ look, model }: { look: Look; model?: CharacterModel }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.8;
  });
  return (
    <group ref={ref} position={[0, -0.55, 0]}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[0.6, 32]} />
        <meshLambertMaterial color="#FFCC80" />
      </mesh>
      {model ? <ModelCharacter model={model} fallback={look} hat={look.hat ? look : undefined} /> : <Character look={look} />}
    </group>
  );
}

/** Nhân vật 3D xoay tròn để xem trước khi tạo. */
export default function CharacterPreview({ look, model, enabled }: { look: Look; model?: CharacterModel; enabled: boolean }) {
  if (!enabled) {
    return (
      <View style={[styles.box, styles.center]}>
        <Text style={{ fontSize: 64 }}>🧑‍🍳</Text>
        <Text style={styles.note}>Thiết bị không hỗ trợ 3D</Text>
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <Canvas camera={{ position: [0, 0.25, 3.0], fov: 38 }} dpr={[1, maxDpr()]} style={{ flex: 1 }}>
        <color attach="background" args={['#FFF3E0']} />
        <hemisphereLight args={['#FFFFFF', '#8D6E63', 1.2]} />
        <directionalLight position={[2, 3, 3]} intensity={1.4} />
        <Turntable look={look} model={model} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 260, borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#F0DCC8' },
  center: { alignItems: 'center', justifyContent: 'center' },
  note: { color: '#8D6E63', marginTop: 8 },
});
