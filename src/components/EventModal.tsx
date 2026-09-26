import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { chooseEventOption, currentEvent } from '../game/engine';
import { useGame } from '../game/GameContext';
import { Button, colors } from './ui';

/** Hộp thoại tình huống: game tạm dừng tới khi người chơi chọn cách xử lý. */
export default function EventModal() {
  const { game, act } = useGame();
  const def = game ? currentEvent(game) : null;
  if (!game || !def || !game.activeEvent) return null;
  const ctx = game.activeEvent.ctx;

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>{def.emoji}</Text>
          <Text style={styles.title}>{def.title}</Text>
          <Text style={styles.body}>{def.body(ctx, game)}</Text>
          <View style={styles.choices}>
            {def.choices.map((c, i) => (
              <Button
                key={c.label}
                label={c.label}
                variant={i === 0 ? 'primary' : 'secondary'}
                onPress={() => act((s, rng) => chooseEventOption(s, i, rng))}
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
  emoji: { fontSize: 44, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, color: colors.text, textAlign: 'center', marginVertical: 12, lineHeight: 21 },
  choices: { width: '100%', gap: 8 },
});
