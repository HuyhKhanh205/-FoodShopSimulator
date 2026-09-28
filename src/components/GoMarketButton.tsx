import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { goStreet, leaveForMarket, staffOnDuty } from '../game/engine';
import { useGame, useGameState } from '../game/GameContext';
import { Button, colors } from './ui';

/**
 * Nút đi chợ (hoặc ra phố) giữa giờ bán. Chưa có nhân viên nào đang làm thì hỏi lại trước,
 * vì quán sẽ treo biển tạm đóng trong lúc chủ vắng mặt.
 */
export default function GoMarketButton({ render, to = 'market' }: { render: (onPress: () => void) => React.ReactNode; to?: 'market' | 'street' }) {
  const game = useGameState();
  const { act } = useGame();
  const [confirm, setConfirm] = useState(false);
  const noStaff = staffOnDuty(game).length === 0;
  const go = () => {
    setConfirm(false);
    act((s) => (to === 'street' ? goStreet(s, 'shop') : leaveForMarket(s)));
  };
  return (
    <>
      {render(() => (noStaff ? setConfirm(true) : go()))}
      {confirm && (
        <Modal transparent animationType="none" visible onRequestClose={() => setConfirm(false)}>
          <Pressable style={styles.backdrop} onPress={() => setConfirm(false)}>
            <Pressable style={styles.card} onPress={() => {}}>
              <Text style={styles.emoji}>🚪</Text>
              <Text style={styles.title}>Quán đóng tạm</Text>
              <Text style={styles.body} accessibilityLabel="Chưa có nhân viên: trong lúc vắng mặt quán không đón khách mới, món trên bếp vẫn có thể cháy.">
                👥 ❌ → 🚪🔒 · 🔥⚠️
              </Text>
              <View style={styles.row}>
                <Button label={to === 'street' ? '🚶 Vẫn ra phố' : '🛒 Vẫn đi chợ'} onPress={go} style={{ flex: 1 }} />
                <Button label="🏠 Ở lại" variant="secondary" onPress={() => setConfirm(false)} style={{ flex: 1 }} />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20, width: '100%', maxWidth: 420, alignItems: 'center', gap: 8 },
  emoji: { fontSize: 40 },
  title: { fontSize: 18, fontWeight: '900', color: colors.text, textAlign: 'center' },
  body: { fontSize: 14, color: colors.text, textAlign: 'center', lineHeight: 20 },
  row: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 6 },
});
