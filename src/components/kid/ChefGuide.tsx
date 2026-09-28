import { useEffect, useMemo, useRef, useState } from 'react';
import { maxDpr } from '../../game/settings';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { HELP } from '../../game/help';
import { useGame } from '../../game/GameContext';
import { advanceTutorial, currentStep, noteText, skipTutorial, stepSay } from '../../game/tutorial';
import { Canvas } from '../../three/fiber';
import { hasWebGL } from '../../three/webgl';
import ModelCharacter from '../scene/ModelCharacter';
import type { Look } from '../scene/looks';
import { colors } from '../ui';
import { MUTED_HINT, canSpeak, speak } from './HelpButton';
import { tutorialUi, useTutorialUi } from './tutorialUi';

/** Ngoại hình Chú Tư bếp trưởng: áo trắng, khăn đỏ, mũ đầu bếp. */
const CHEF_LOOK: Look = {
  skin: '#E0AC7E',
  hair: '#3E2723',
  shirt: '#FAFAFA',
  pants: '#263238',
  apron: '#E53935',
  hat: 'chef',
  hatColor: '#FFFFFF',
};

/** Bếp trưởng 3D (KayKit) có hoạt ảnh: vẫy / cổ vũ khi nói câu mới, rồi làm động tác giải thích. */
function ChefAvatar({ talkKey, size }: { talkKey: string; size: number }) {
  const gl = useMemo(hasWebGL, []);
  const [anim, setAnim] = useState('Cheer');
  useEffect(() => {
    setAnim('Cheer');
    const t = setTimeout(() => setAnim('Interact'), 1600);
    return () => clearTimeout(t);
  }, [talkKey]);
  if (!gl) return <Text style={{ fontSize: size * 0.55 }}>👨‍🍳</Text>;
  return (
    <View style={{ width: size, height: size * 1.15 }} pointerEvents="none">
      <Canvas camera={{ position: [0, 0.05, 2.9], fov: 32 }} dpr={[1, Math.min(1.5, maxDpr())]} gl={{ alpha: true }} style={{ flex: 1 }}>
        <hemisphereLight args={['#FFFFFF', '#8D6E63', 1.3]} />
        <directionalLight position={[1.5, 2.5, 2.5]} intensity={1.4} />
        <group position={[0, -0.72, 0]} rotation-y={0.35}>
          <ModelCharacter model="barbarian" fallback={CHEF_LOOK} hat={CHEF_LOOK} anim={anim} shadows={false} />
        </group>
      </Canvas>
    </View>
  );
}

interface Say {
  key: string;
  text: string;
  at: 'top' | 'bottom';
  /** Nút chính (▶ Tiếp / 👍) — không có thì chờ người chơi làm theo. */
  primary?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  onSkip?: () => void;
}

/**
 * Bếp trưởng dẫn đường: hiện ở mọi màn, nói theo thứ tự ưu tiên
 * 1) kịch bản ngày đầu, 2) hướng dẫn khi bấm ❗, 3) tin mới (lên cấp, món mới).
 */
export default function ChefGuide({ route, openLab }: { route: string; openLab: () => void }) {
  const { game, act } = useGame();
  const ui = useTutorialUi();
  const { width } = useWindowDimensions();
  const [helpIndex, setHelpIndex] = useState(0);
  const [mini, setMini] = useState(false);
  /** Câu vừa bấm 🔊 mà máy không phát tiếng. */
  const [mutedKey, setMutedKey] = useState<string | null>(null);
  const slide = useRef(new Animated.Value(0)).current;

  const step = game ? currentStep(game) : null;
  const inGame = route === 'Game';

  // Bước tự hoàn thành khi người chơi làm đúng.
  useEffect(() => {
    if (!game || !step || step.tapToContinue) return;
    if (step.done(game, { fpOpen: ui.fpOpen, basket: ui.basket, stall: ui.stall })) act((s) => advanceTutorial(s));
  });
  // Hết ngày mà chưa xong hướng dẫn thì thôi, không bắt làm lại.
  useEffect(() => {
    if (game && !game.tutorial.done && game.phase === 'summary') act((s) => skipTutorial(s));
  }, [game, act]);

  // Trợ giúp ❓: bước có chỗ cụ thể thì viền vàng chỗ đó.
  const helpTarget = ui.help ? HELP[ui.help.topic].steps[Math.min(helpIndex, HELP[ui.help.topic].steps.length - 1)].target : undefined;
  useEffect(() => {
    if (helpTarget) tutorialUi.glow(helpTarget, 6000);
  }, [helpTarget, ui.help?.at]);

  let say: Say | null = null;
  if (ui.help) {
    const h = HELP[ui.help.topic];
    const i = Math.min(helpIndex, h.steps.length - 1);
    const last = i >= h.steps.length - 1;
    say = {
      key: `help-${ui.help.at}-${i}`,
      text: `${h.steps[i].icon} ${h.steps[i].text}`,
      at: 'bottom',
      primary: {
        label: last ? '👍 Hiểu rồi' : `▶ Tiếp (${i + 1}/${h.steps.length})`,
        onPress: () => {
          if (last) {
            setHelpIndex(0);
            tutorialUi.clearHelp();
          } else setHelpIndex(i + 1);
        },
      },
      onSkip: () => {
        setHelpIndex(0);
        tutorialUi.clearHelp();
      },
    };
  } else if (game && step && inGame && !game.activeEvent && !game.eventResult) {
    say = {
      key: `tut-${game.tutorial.step}`,
      text: stepSay(step, game),
      at: step.at,
      primary: step.tapToContinue ? { label: game.tutorial.step === 0 ? '▶ Bắt đầu' : '👍 OK', onPress: () => act((s) => advanceTutorial(s)) } : undefined,
      onSkip: () => act((s) => skipTutorial(s)),
    };
  } else if (game && game.chefQueue.length > 0 && (inGame || route === 'Lab') && !game.activeEvent && !game.eventResult) {
    const n = game.chefQueue[0];
    const pop = () => act((s) => void s.chefQueue.shift());
    say = {
      key: `note-${JSON.stringify(n)}`,
      text: noteText(n),
      at: 'bottom',
      primary: { label: '👍 OK', onPress: pop },
      secondary:
        n.kind === 'notebook' || n.kind === 'autoClaim'
          ? {
              label: '📒 Mở sổ',
              onPress: () => {
                pop();
                tutorialUi.openNotebook(n.kind === 'autoClaim' ? 'bag' : 'tasks');
              },
            }
          : n.kind === 'levelUp' && route !== 'Lab' && game.phase !== 'open'
          ? {
              label: '🧪 Thử món',
              onPress: () => {
                pop();
                openLab();
              },
            }
          : undefined,
    };
  }

  const visible = Boolean(say);
  useEffect(() => {
    Animated.spring(slide, { toValue: visible ? 1 : 0, friction: 6, useNativeDriver: true }).start();
    if (visible) setMini(false);
  }, [visible, slide]);
  // Nhún nhẹ mỗi khi đổi câu.
  const bounce = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!say) return;
    bounce.setValue(0.85);
    Animated.spring(bounce, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [say?.key, bounce]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!say) return null;
  const avatar = width < 500 ? 104 : 140;
  const top = say.at === 'top';

  if (mini) {
    return (
      <Pressable style={[styles.mini, top ? { top: 92 + ui.topInset } : { bottom: 16 + ui.bottomInset }]} onPress={() => setMini(false)} accessibilityRole="button" accessibilityLabel="Mở lại Chú Tư bếp trưởng">
        <Text style={{ fontSize: 30 }}>👨‍🍳</Text>
        <Text style={styles.miniDot}>💬</Text>
      </Pressable>
    );
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        top ? { top: 86 + ui.topInset } : { bottom: 10 + ui.bottomInset },
        { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [top ? -260 : 260, 0] }) }] },
      ]}
    >
      <Pressable onPress={() => setMini(true)} accessibilityRole="button" accessibilityLabel="Chú Tư bếp trưởng (chạm để thu nhỏ)">
        <ChefAvatar talkKey={say.key} size={avatar} />
      </Pressable>
      <Animated.View style={[styles.bubble, { transform: [{ scale: bounce }] }]} accessibilityLabel={`Chú Tư bếp trưởng: ${say.text}`}>
        <Text style={styles.name}>👨‍🍳 Chú Tư bếp trưởng</Text>
        <Text style={styles.text}>{say.text}</Text>
        {mutedKey === say.key && <Text style={styles.muted}>{MUTED_HINT}</Text>}
        <View style={styles.row}>
          {canSpeak() && (
            <Pressable
              onPress={() => {
                const key = say!.key;
                setMutedKey(null);
                speak(say!.text, () => setMutedKey(key));
              }} style={[styles.btn, styles.btnSoft]} accessibilityLabel="Đọc to">
              <Text style={styles.btnSoftText}>🔊</Text>
            </Pressable>
          )}
          {say.secondary && (
            <Pressable onPress={say.secondary.onPress} style={[styles.btn, styles.btnSoft]} accessibilityRole="button">
              <Text style={styles.btnSoftText}>{say.secondary.label}</Text>
            </Pressable>
          )}
          {say.primary && (
            <Pressable onPress={say.primary.onPress} style={[styles.btn, styles.btnMain]} accessibilityRole="button">
              <Text style={styles.btnMainText}>{say.primary.label}</Text>
            </Pressable>
          )}
          {say.onSkip && (
            <Pressable onPress={say.onSkip} style={styles.skip} accessibilityRole="button" accessibilityLabel="Bỏ qua hướng dẫn">
              <Text style={styles.skipText}>⏭️</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 12, fontWeight: '700', color: colors.bad, marginTop: 4 },
  wrap: { position: 'absolute', left: 6, right: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 2, zIndex: 50 },
  bubble: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 12,
    gap: 6,
    borderWidth: 3,
    borderColor: colors.accent,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  name: { fontSize: 12, fontWeight: '900', color: colors.primaryDark },
  text: { fontSize: 17, fontWeight: '800', color: colors.text, lineHeight: 23 },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  btn: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, minHeight: 42, justifyContent: 'center' },
  btnMain: { backgroundColor: colors.primary },
  btnMainText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  btnSoft: { backgroundColor: colors.warnBg, borderWidth: 1, borderColor: colors.border },
  btnSoftText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  skip: { marginLeft: 'auto', padding: 6 },
  skipText: { fontSize: 20 },
  mini: {
    position: 'absolute',
    left: 10,
    zIndex: 50,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniDot: { position: 'absolute', top: -8, right: -8, fontSize: 16 },
});
