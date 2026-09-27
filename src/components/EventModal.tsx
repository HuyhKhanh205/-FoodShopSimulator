import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { chooseEventOption, currentEvent } from '../game/engine';
import { useGame } from '../game/GameContext';
import { Button, colors } from './ui';

/** Hộp thoại tình huống: game tạm dừng tới khi người chơi chọn cách xử lý. */
export default function EventModal() {
  const { game, act } = useGame();
  const def = game ? currentEvent(game) : null;
  const [details, setDetails] = useState(false);
  if (!game || !def || !game.activeEvent) return null;
  const ctx = game.activeEvent.ctx;

  return (
    <Modal transparent animationType="none" visible>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>{def.emoji}</Text>
          <Text style={styles.title}>{def.title}</Text>
          {details ? (
            <Text style={styles.body}>{def.body(ctx, game)}</Text>
          ) : (
            <Pressable onPress={() => setDetails(true)} style={styles.more} accessibilityRole="button" accessibilityLabel="Xem chi tiết">
              <Text style={styles.moreText}>❗ 📖</Text>
            </Pressable>
          )}
          <View style={styles.choices}>
            {def.choices.map((c, i) => (
              <Button
                key={c.label}
                label={c.label}
                variant={i === 0 ? 'primary' : 'secondary'}
                onPress={() => {
                  setDetails(false);
                  act((s, rng) => chooseEventOption(s, i, rng));
                }}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 20, width: '100%', maxWidth: 440, alignItems: 'center' },
  emoji: { fontSize: 72, marginBottom: 6 },
  more: { marginVertical: 10, backgroundColor: colors.warnBg, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  moreText: { fontSize: 22 },
  title: { fontSize: 22, fontWeight: '900', color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, color: colors.text, textAlign: 'center', marginVertical: 12, lineHeight: 21 },
  choices: { width: '100%', gap: 8 },
});
