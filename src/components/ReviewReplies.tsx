import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useGame } from '../game/GameContext';
import { REPLY_MAX, effectText, replyHints, replyReview } from '../game/reviews';
import type { DayReport, Review } from '../game/types';
import { Stars, colors } from './ui';

/**
 * Bảng "⭐ Đánh giá của khách" ở tổng kết: mỗi đánh giá có ✏️ Trả lời → người chơi tự gõ (có vài gợi ý bấm để chèn),
 * 📨 Gửi → hiện câu trả lời của quán, câu khách đáp lại và hiệu quả (★ +0,03).
 */
export default function ReviewReplies({ report }: { report: DayReport }) {
  const [open, setOpen] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const list = report.reviews.map((rv, i) => ({ rv, i })).reverse();
  // Đánh giá xấu chưa trả lời lên đầu.
  list.sort((a, b) => Number(Boolean(a.rv.reply)) - Number(Boolean(b.rv.reply)) || (a.rv.reply ? 0 : a.rv.stars - b.rv.stars));
  const left = report.reviews.filter((r) => !r.reply).length;
  const shown = all ? list : list.slice(0, 5);
  const avg = report.reviews.length ? report.reviews.reduce((s, x) => s + x.stars, 0) / report.reviews.length : 0;
  return (
    <View style={styles.box} accessibilityLabel="Đánh giá của khách">
      <View style={styles.head}>
        <Text style={styles.title}>⭐ Đánh giá của khách</Text>
        {report.reviews.length > 0 && <Stars value={avg} />}
      </View>
      {left > 0 && (
        <Text style={styles.left} accessibilityLabel={`${left} đánh giá chưa trả lời`}>
          💬 {left} đánh giá chưa trả lời
        </Text>
      )}
      {report.reviews.length === 0 && <Text style={styles.muted}>Chưa có đánh giá.</Text>}
      {shown.map(({ rv, i }) => (
        <ReviewRow key={i} rv={rv} index={i} open={open === i} onOpen={() => setOpen(open === i ? null : i)} onDone={() => setOpen(null)} />
      ))}
      {list.length > 5 && (
        <Pressable onPress={() => setAll((v) => !v)} style={styles.more} accessibilityRole="button" accessibilityLabel={all ? 'Thu gọn đánh giá' : 'Xem hết đánh giá'}>
          <Text style={styles.moreText}>{all ? '▲ Thu gọn' : `▼ Xem hết ${list.length} đánh giá`}</Text>
        </Pressable>
      )}
    </View>
  );
}

function ReviewRow({ rv, index, open, onOpen, onDone }: { rv: Review; index: number; open: boolean; onOpen: () => void; onDone: () => void }) {
  const { act } = useGame();
  const [text, setText] = useState('');
  const bad = rv.stars <= 3;
  const send = () => {
    const body = text.trim();
    if (!body) return;
    act((s, rng) => void replyReview(s, index, body, rng));
    setText('');
    onDone();
  };
  return (
    <View style={[styles.review, bad && !rv.reply && styles.reviewBad]}>
      <View style={styles.row}>
        <Stars value={rv.stars} size={12} />
        {!rv.reply && (
          <Pressable
            onPress={onOpen}
            onPressIn={() => {}}
            style={({ pressed }) => [styles.replyBtn, open && styles.replyBtnOn, pressed && { transform: [{ translateY: 2 }] }]}
            accessibilityRole="button"
            accessibilityLabel={`Trả lời ${rv.name}`}
          >
            <Text style={styles.replyBtnText}>✏️ Trả lời</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.p}>
        <Text style={styles.bold}>{rv.name}: </Text>
        {rv.text}
      </Text>
      {rv.reply && (
        <View style={styles.thread}>
          <Text style={styles.mine}>🏠 Quán: {rv.reply.text}</Text>
          <Text style={[styles.them, rv.reply.tone === 'rude' && { color: colors.bad }]}>
            💬 {rv.name}: {rv.reply.reaction}
          </Text>
          <Text style={[styles.effect, { color: rv.reply.rep >= 0 ? colors.good : colors.bad }]}>{effectText(rv)}</Text>
        </View>
      )}
      {open && !rv.reply && (
        <View style={styles.editor}>
          <Text style={styles.tip}>{bad ? '💡 Khách chê: xin lỗi, nói lý do, mời khách quay lại.' : '💡 Khách khen: cảm ơn khách thật lòng nha!'}</Text>
          <View style={styles.hints}>
            {replyHints(rv.stars).map((h) => (
              <Pressable key={h} onPress={() => setText((t) => (t + h).slice(0, REPLY_MAX))} style={styles.hint} accessibilityRole="button" accessibilityLabel={`Chèn: ${h.trim()}`}>
                <Text style={styles.hintText}>＋ {h.trim()}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={text}
            onChangeText={(v) => setText(v.slice(0, REPLY_MAX))}
            multiline
            maxLength={REPLY_MAX}
            placeholder="Tự viết câu trả lời của bạn…"
            placeholderTextColor="#B8A58F"
            style={styles.input}
            accessibilityLabel={`Câu trả lời cho ${rv.name}`}
          />
          <View style={styles.row}>
            <Text style={styles.counter}>
              {text.length}/{REPLY_MAX}
            </Text>
            <Pressable
              onPress={send}
              disabled={!text.trim()}
              style={({ pressed }) => [styles.send, !text.trim() && { opacity: 0.45 }, pressed && { transform: [{ translateY: 2 }] }]}
              accessibilityRole="button"
              accessibilityLabel="Gửi trả lời"
            >
              <Text style={styles.sendText}>📨 Gửi</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 2, borderColor: colors.border, padding: 12, gap: 6, marginBottom: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '900', color: colors.text },
  left: { alignSelf: 'flex-start', backgroundColor: colors.warnBg, borderColor: colors.accent, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, fontWeight: '900', color: colors.primaryDark, fontSize: 13 },
  muted: { color: colors.muted },
  review: { borderTopWidth: 1, borderTopColor: '#F7EDE2', paddingVertical: 6, gap: 3 },
  reviewBad: { backgroundColor: '#FFF7F7', borderRadius: 10, paddingHorizontal: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  p: { color: colors.text, lineHeight: 19 },
  bold: { fontWeight: '800' },
  replyBtn: { backgroundColor: colors.cream, borderRadius: 12, borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 3, paddingHorizontal: 10, paddingVertical: 4 },
  replyBtnOn: { backgroundColor: colors.selected },
  replyBtnText: { fontWeight: '900', color: colors.brown, fontSize: 13 },
  thread: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: colors.accent, gap: 2 },
  mine: { color: colors.brown, fontWeight: '700' },
  them: { color: colors.info, fontStyle: 'italic' },
  effect: { fontWeight: '900', fontSize: 12 },
  editor: { gap: 6, marginTop: 4 },
  tip: { fontSize: 12, color: colors.muted, fontWeight: '700' },
  hints: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hint: { backgroundColor: '#FFFBF2', borderRadius: 12, borderWidth: 1, borderColor: colors.chunkyShadow, paddingHorizontal: 8, paddingVertical: 4 },
  hintText: { fontSize: 12, fontWeight: '700', color: colors.brown },
  input: { minHeight: 60, borderWidth: 2, borderColor: colors.chunkyShadow, borderRadius: 12, padding: 8, color: colors.text, backgroundColor: '#FFFDF8', fontSize: 15, textAlignVertical: 'top' },
  counter: { fontSize: 12, color: colors.muted },
  send: { backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 4, borderColor: colors.primaryDark },
  sendText: { color: '#fff', fontWeight: '900' },
  more: { alignSelf: 'center', paddingVertical: 4 },
  moreText: { color: colors.primaryDark, fontWeight: '800' },
});
