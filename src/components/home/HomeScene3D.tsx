import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { newGame } from '../../game/engine';
import { seededRng } from '../../game/helpers';
import type { Appearance } from '../../game/settings';
import { hasWebGL } from '../../three/webgl';
import MarketScene3D from '../market/MarketScene3D';

/**
 * Nền màn đầu: chợ bên sông 3D (dùng lại cảnh chợ ở chế độ demo) với Chú Tư và chủ quán vẫy chào.
 * Máy không có WebGL: nền 2D gồm trời, sông, ghe trôi, đèn lồng lắc lư (không dùng ảnh).
 */
export default function HomeScene3D({ width, height, look }: { width: number; height: number; look: Appearance | null }) {
  const gl = useMemo(hasWebGL, []);
  const demo = useMemo(() => {
    const g = newGame(seededRng(1), { profile: look ?? undefined });
    g.activeEvent = null;
    return g;
  }, [look]);
  if (!gl) return <Home2D width={width} height={height} />;
  return <MarketScene3D game={demo} onStall={() => {}} width={width} height={height} demo />;
}

function Home2D({ width, height }: { width: number; height: number }) {
  const boat = useRef(new Animated.Value(0)).current;
  const swing = useRef(new Animated.Value(0)).current;
  const [lanterns] = useState(() => Array.from({ length: 5 }, (_, i) => i));
  useEffect(() => {
    const a = Animated.loop(Animated.timing(boat, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(swing, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(swing, { toValue: -1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [boat, swing]);
  const rotate = swing.interpolate({ inputRange: [-1, 1], outputRange: ['-10deg', '10deg'] });
  return (
    <View style={{ width, height, backgroundColor: '#BDE3F2', overflow: 'hidden' }}>
      <View style={[styles.sun]} />
      <View style={styles.string} />
      <View style={styles.lanterns}>
        {lanterns.map((i) => (
          <Animated.Text key={i} style={[styles.lantern, { transform: [{ rotate }] }]}>
            🏮
          </Animated.Text>
        ))}
      </View>
      <View style={[styles.river, { top: height * 0.42 }]}>
        <Animated.Text style={[styles.boat, { transform: [{ translateX: boat.interpolate({ inputRange: [0, 1], outputRange: [-80, width + 40] }) }] }]}>🛶</Animated.Text>
      </View>
      <View style={[styles.bank, { top: height * 0.42 + 70 }]}>
        <Text style={styles.stalls}>🌴 🥩 🥚 🥬 🧋 🌴</Text>
        <Text style={styles.people}>👨‍🍳 🧑‍🍳</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sun: { position: 'absolute', right: 40, top: 60, width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFE082' },
  string: { position: 'absolute', left: 0, right: 0, top: 150, height: 2, backgroundColor: '#8D6E63' },
  lanterns: { position: 'absolute', left: 0, right: 0, top: 146, flexDirection: 'row', justifyContent: 'space-around' },
  lantern: { fontSize: 30 },
  river: { position: 'absolute', left: 0, right: 0, height: 70, backgroundColor: '#5DADE2', justifyContent: 'center' },
  boat: { fontSize: 36, position: 'absolute' },
  bank: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#9CCC65', alignItems: 'center', paddingTop: 16, gap: 6 },
  stalls: { fontSize: 34, letterSpacing: 6 },
  people: { fontSize: 44 },
});
