import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { questionOf } from '../../game/chat';
import { answerChat } from '../../game/engine';
import type { GameMutation } from '../../game/GameContext';
import type { Customer } from '../../game/types';
import { colors } from '../ui';
import IconTile from './IconTile';

/** Câu hỏi của khách + các ô trả lời bằng hình (dùng trong bảng thao tác và hộp ChatPrompt). */
export function QuestionAnswers({ c, act, onDone }: { c: Customer; act: (fn: GameMutation) => void; onDone?: () => void }) {
  const q = questionOf(c.question?.id);
  if (!q) return null;
  return (
    <View style={styles.qa}>
      <Text style={styles.q}>
        {c.emoji} {q.icon} {q.text}
      </Text>
      <View style={styles.answers}>
        {q.answers.map((a, i) => (
          <IconTile
            key={i}
            icon={a.icon}
            label={a.label}
            name={a.label}
            size="sm"
            onPress={() => {
              act((s) => void answerChat(s, c.id, i));
              onDone?.();
            }}
          />
        ))}
      </View>
    </View>
  );
}

/** Hộp trả lời nhanh khi chạm vào bong bóng ❓ trên đầu khách (không cần đi tới bàn). */
export default function ChatPrompt({ customer, act, onClose }: { customer: Customer | null; act: (fn: GameMutation) => void; onClose: () => void }) {
  if (!customer?.question) return null;
  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <QuestionAnswers c={customer} act={act} onDone={onClose} />
          <Pressable onPress={onClose} style={styles.skip} accessibilityRole="button" accessibilityLabel="Để sau">
            <Text style={styles.skipText}>⏭️</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  qa: { gap: 8, paddingTop: 4 },
  q: { fontSize: 16, fontWeight: '800', color: colors.text, lineHeight: 22 },
  answers: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, width: '100%', maxWidth: 420, gap: 10 },
  skip: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 4 },
  skipText: { fontSize: 22 },
});
