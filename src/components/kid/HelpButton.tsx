import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HELP } from '../../game/help';
import type { HelpTopic } from '../../game/help';
import { useGame } from '../../game/GameContext';
import { colors } from '../ui';
import { tutorialUi } from './tutorialUi';
import { canSpeak, MUTED_HINT, speak, stopSpeaking } from './speech';
import { helpSpeech } from '../../game/voice';

const seenKey = (t: HelpTopic) => `quanan-help-seen:${t}`;

/** Các hướng dẫn đã tự mở trong lần chơi này (không mở lại khi đổi màn / vào–ra bếp). */
const shownThisSession = new Set<HelpTopic>();

function seenInLocal(t: HelpTopic): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(seenKey(t)) === '1';
  } catch {
    return false;
  }
}
function rememberSeen(t: HelpTopic) {
  AsyncStorage.setItem(seenKey(t), '1').catch(() => {});
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(seenKey(t), '1');
  } catch {
    // Không lưu được thì vẫn nhớ trong lần chơi này.
  }
}

export { MUTED_HINT, canSpeak, speak, stopSpeaking } from './speech';

/** Bảng hướng dẫn bằng hình. */
export function HelpSheet({ topic, visible, onClose }: { topic: HelpTopic; visible: boolean; onClose: () => void }) {
  const [more, setMore] = useState(false);
  const [muted, setMuted] = useState(false);
  const h = HELP[topic];
  const steps = more && h.more ? [...h.steps, ...h.more] : h.steps;
  const close = () => {
    stopSpeaking();
    setMore(false);
    setMuted(false);
    onClose();
  };
  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityLabel={`Hướng dẫn: ${h.title}`}>
          <Text style={styles.title}>❗ {h.title}</Text>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }}>
            {steps.map((s, i) => (
              <View key={i} style={styles.step}>
                <Text style={styles.stepIcon}>{s.icon}</Text>
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
            ))}
          </ScrollView>
          {muted && <Text style={styles.muted}>{MUTED_HINT}</Text>}
          <View style={styles.row}>
            {canSpeak() && (
              <Pressable style={[styles.btn, styles.btnSoft]} onPress={() => {
                  setMuted(false);
                  speak(helpSpeech(topic, more), () => setMuted(true));
                }} accessibilityRole="button">
                <Text style={styles.btnSoftText}>🔊 Đọc</Text>
              </Pressable>
            )}
            {h.more && !more && (
              <Pressable style={[styles.btn, styles.btnSoft]} onPress={() => setMore(true)} accessibilityRole="button">
                <Text style={styles.btnSoftText}>➕ Thêm</Text>
              </Pressable>
            )}
            <Pressable style={[styles.btn, styles.btnMain]} onPress={close} accessibilityRole="button">
              <Text style={styles.btnMainText}>👍 Hiểu rồi</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Hướng dẫn ngày đầu (đầu bếp dẫn từng bước) đã bao gồm các màn này — không tự mở thêm. */
const COVERED_BY_TUTORIAL: HelpTopic[] = ['home', 'character', 'market', 'shop', 'kitchen'];

/**
 * Nút "!" tròn màu cam: bấm để bếp trưởng hiện lên đọc hướng dẫn của màn này.
 * Màn chưa có trong hướng dẫn ngày đầu (bếp thử món, nhân viên...) thì lần đầu vào tự gọi bếp trưởng MỘT lần.
 */
export default function HelpButton({ topic, autoOpen = true, style }: { topic: HelpTopic; autoOpen?: boolean; style?: StyleProp<ViewStyle> }) {
  const { game } = useGame();
  const tutorialDone = Boolean(game?.tutorial.done);
  useEffect(() => {
    if (!autoOpen || !tutorialDone || COVERED_BY_TUTORIAL.includes(topic) || shownThisSession.has(topic)) return;
    let alive = true;
    const openOnce = () => {
      if (!alive || shownThisSession.has(topic)) return;
      shownThisSession.add(topic);
      rememberSeen(topic);
      tutorialUi.requestHelp(topic);
    };
    if (seenInLocal(topic)) {
      shownThisSession.add(topic);
      return;
    }
    AsyncStorage.getItem(seenKey(topic))
      .then((v) => {
        if (v) shownThisSession.add(topic);
        else openOnce();
      })
      .catch(openOnce);
    return () => {
      alive = false;
    };
  }, [topic, autoOpen, tutorialDone]);
  return (
    <Pressable
      onPress={() => tutorialUi.requestHelp(topic)}
      accessibilityRole="button"
      accessibilityLabel="Hướng dẫn"
      style={({ pressed }) => [styles.bang, pressed && { transform: [{ scale: 0.92 }] }, style]}
    >
      <Text style={styles.bangText}>!</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontWeight: '700', color: colors.bad, textAlign: 'center' },
  bang: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  bangText: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: -2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 18, width: '100%', maxWidth: 440, gap: 12 },
  title: { fontSize: 22, fontWeight: '900', color: colors.primaryDark, textAlign: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.warnBg, borderRadius: 16, padding: 10 },
  stepIcon: { fontSize: 34, width: 48, textAlign: 'center' },
  stepText: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 23 },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  btn: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, minHeight: 50, justifyContent: 'center' },
  btnMain: { backgroundColor: colors.primary, flexGrow: 1, alignItems: 'center' },
  btnMainText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  btnSoft: { backgroundColor: colors.warnBg, borderWidth: 1, borderColor: colors.border },
  btnSoftText: { color: colors.text, fontSize: 16, fontWeight: '800' },
});
