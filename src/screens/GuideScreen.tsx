import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { HelpSheet } from '../components/kid/HelpButton';
import { canSpeak, speak } from '../components/kid/speech';
import { colors } from '../components/ui';
import { STAGES } from '../game/dayflow';
import { HELP } from '../game/help';
import type { HelpTopic } from '../game/help';

/** Thứ tự các thẻ trong sổ hướng dẫn (theo vòng chơi). */
const ORDER: { topic: HelpTopic; icon: string }[] = [
  { topic: 'home', icon: '🍜' },
  { topic: 'market', icon: '🛒' },
  { topic: 'shop', icon: '🏮' },
  { topic: 'kitchen', icon: '🔪' },
  { topic: 'counter', icon: '🧋' },
  { topic: 'summary', icon: '🌙' },
  { topic: 'notebook', icon: '📒' },
  { topic: 'lab', icon: '📖' },
  { topic: 'staff', icon: '👥' },
  { topic: 'upgrades', icon: '🔧' },
  { topic: 'event', icon: '🎉' },
  { topic: 'character', icon: '🧑‍🍳' },
];

/** Sổ hướng dẫn bằng hình: vòng một ngày (đường sông) + các thẻ chủ đề, chạm để xem từng bước, có 🔊 đọc. */
export default function GuideScreen() {
  const navigation = useNavigation();
  const [open, setOpen] = useState<HelpTopic | null>(null);
  /** Bến đang chọn trên vòng một ngày (chạm mới hiện lời giải thích). */
  const [stage, setStage] = useState<number | null>(null);
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel="Quay lại">
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>📖 Hướng dẫn</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.day}>
          <Text style={styles.dayTitle}>🛶 Vòng một ngày</Text>
          <View style={styles.river}>
            {STAGES.map((st, i) => (
              <Pressable
                key={st.id}
                onPress={() => {
                  setStage(i);
                  speak(st.say);
                }}
                style={styles.stop}
                accessibilityRole="button"
                accessibilityLabel={`${st.label}: ${st.say}`}
              >
                <View style={[styles.node, stage === i && styles.nodeOn]}>
                  <Text style={styles.nodeIcon}>{st.icon}</Text>
                </View>
                <Text style={styles.stopLabel}>
                  {i + 1}. {st.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {stage !== null ? (
            <Text style={styles.dayLine}>{STAGES[stage].say}</Text>
          ) : (
            <Text style={styles.hint}>👆 Chạm một bến để xem{canSpeak() ? ' và nghe Chú Tư đọc' : ''}.</Text>
          )}
        </View>
        <View style={styles.grid}>
          {ORDER.map(({ topic, icon }) => (
            <Pressable key={topic} onPress={() => setOpen(topic)} style={({ pressed }) => [styles.card, pressed && { transform: [{ translateY: 3 }] }]} accessibilityRole="button" accessibilityLabel={HELP[topic].title}>
              <Text style={styles.cardIcon}>{icon}</Text>
              <Text style={styles.cardTitle}>{HELP[topic].title}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {open && <HelpSheet topic={open} visible onClose={() => setOpen(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingHorizontal: 14, backgroundColor: colors.primary },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  title: { flex: 1, fontSize: 19, fontWeight: '900', color: '#fff' },
  content: { padding: 14, gap: 14, paddingBottom: 40, maxWidth: 700, width: '100%', alignSelf: 'center' },
  day: { backgroundColor: '#E3F4FD', borderRadius: 20, borderWidth: 2, borderColor: '#7CC6EE', borderBottomWidth: 5, padding: 12, gap: 6 },
  dayTitle: { fontSize: 18, fontWeight: '900', color: '#1B5E8C' },
  river: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#7CC6EE', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 4 },
  stop: { alignItems: 'center', width: '20%', gap: 2 },
  node: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#2B7BB9' },
  nodeOn: { borderColor: colors.primary, borderWidth: 3, backgroundColor: '#FFF3E0' },
  nodeIcon: { fontSize: 20 },
  stopLabel: { fontSize: 10, fontWeight: '900', color: '#0D3B5E', textAlign: 'center' },
  dayLine: { fontSize: 13, fontWeight: '700', color: colors.brown },
  hint: { fontSize: 12, fontWeight: '800', color: '#1B5E8C' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.cream, borderRadius: 18, borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 5, padding: 12, alignItems: 'center', gap: 4 },
  cardIcon: { fontSize: 34 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: colors.brown, textAlign: 'center' },
});
