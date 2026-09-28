import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { chooseEventOption, currentEvent, dismissEventResult } from '../game/engine';
import { useGame } from '../game/GameContext';
import MiniGame from './minigame/MiniGame';
import { Button, colors } from './ui';

/**
 * Hộp thoại tình huống: game tạm dừng tới khi người chơi chọn cách xử lý.
 * Hậu quả được giấu — chọn xong (hoặc chơi xong mini game) mới hiện thẻ Kết quả, bấm OK chạy tiếp.
 */
export default function EventModal() {
  const { game, act } = useGame();
  const def = game ? currentEvent(game) : null;
  const [playing, setPlaying] = useState<number | null>(null);
  if (!game) return null;

  const result = game.eventResult;
  if (result) {
    return (
      <Modal transparent animationType="none" visible>
        <View style={styles.backdrop}>
          <View style={styles.card} accessibilityLabel="Kết quả tình huống">
            <Text style={styles.resultTag}>KẾT QUẢ</Text>
            <Text style={styles.emoji}>{result.emoji}</Text>
            <Text style={styles.title}>{result.title}</Text>
            <Text style={styles.say}>{result.say}</Text>
            {result.lines.length > 0 && (
              <ScrollView style={styles.lines} contentContainerStyle={{ gap: 4 }}>
                {result.lines.map((l) => (
                  <Text key={l} style={styles.line}>
                    {l}
                  </Text>
                ))}
              </ScrollView>
            )}
            <View style={styles.choices}>
              <Button label="👍 OK" onPress={() => act((s) => dismissEventResult(s))} />
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (!def || !game.activeEvent) return null;
  const ctx = game.activeEvent.ctx;
  const mini = playing !== null ? def.choices[playing]?.mini : undefined;

  return (
    <Modal transparent animationType="none" visible>
      <View style={styles.backdrop}>
        {mini && playing !== null ? (
          <MiniGame
            spec={mini}
            onDone={(score) => {
              const i = playing;
              setPlaying(null);
              act((s, rng) => chooseEventOption(s, i, rng, score));
            }}
          />
        ) : (
          <View style={styles.card}>
            <Text style={styles.emoji}>{def.emoji}</Text>
            <Text style={styles.title}>{def.title}</Text>
            <Text style={styles.body}>{def.body(ctx, game)}</Text>
            <View style={styles.choices}>
              {def.choices.map((c, i) => (
                <Button
                  key={c.label}
                  label={c.mini ? `🎮 ${c.label}` : c.label}
                  variant={i === 0 ? 'primary' : 'secondary'}
                  disabled={c.enabled ? !c.enabled(game, ctx) : false}
                  onPress={() => {
                    if (c.mini) setPlaying(i);
                    else act((s, rng) => chooseEventOption(s, i, rng));
                  }}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 20, width: '100%', maxWidth: 440, alignItems: 'center' },
  resultTag: { fontSize: 12, fontWeight: '900', color: colors.primary, letterSpacing: 2 },
  emoji: { fontSize: 64, marginBottom: 4 },
  title: { fontSize: 21, fontWeight: '900', color: colors.text, textAlign: 'center' },
  body: { fontSize: 16, color: colors.text, textAlign: 'center', marginVertical: 12, lineHeight: 22 },
  say: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center', marginVertical: 12, lineHeight: 23 },
  lines: { alignSelf: 'stretch', maxHeight: 200, backgroundColor: colors.warnBg, borderRadius: 12, padding: 10, marginBottom: 12 },
  line: { fontSize: 15, color: colors.text, fontWeight: '600' },
  choices: { width: '100%', gap: 8 },
});
