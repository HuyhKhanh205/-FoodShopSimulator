import { StyleSheet, Text, View } from 'react-native';
import { payDebt } from '../game/engine';
import { useGame } from '../game/GameContext';
import { formatMoney } from '../game/helpers';
import { Button, colors } from './ui';

/** 💳 Khoản vay: số nợ, hạn trả, nút trả bớt / trả hết (ở chợ và ở 🏦 Ngân hàng ngoài phố). */
export default function DebtPanel({ big = false }: { big?: boolean }) {
  const { game, act } = useGame();
  if (!game) return null;
  return (
    <View style={[styles.box, big && styles.big]}>
      <Text style={[styles.text, big && styles.bigText]}>
        💳 {game.debt > 0 ? formatMoney(game.debt) : 'Hết nợ rồi! 🎉'}
        {game.debt > 0 ? ` · 📅 hạn ngày ${game.debtDueDay}` : ''}
      </Text>
      {big && <Text style={styles.money}>💰 Đang có {formatMoney(game.money)}</Text>}
      <View style={styles.row}>
        <Button small={!big} label="Trả 500.000đ" disabled={game.debt <= 0 || game.money < 500_000} onPress={() => act((s) => payDebt(s, 500_000))} />
        <Button small={!big} variant="secondary" label="Trả hết có thể" disabled={game.debt <= 0 || game.money <= 0} onPress={() => act((s) => payDebt(s, s.money))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.warnBg, borderRadius: 14, padding: 10, gap: 8 },
  big: { padding: 16, gap: 12 },
  text: { fontSize: 14, fontWeight: '800', color: colors.text },
  bigText: { fontSize: 18 },
  money: { fontSize: 15, fontWeight: '700', color: colors.muted },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
