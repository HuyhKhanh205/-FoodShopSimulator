import React from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Hud from '../../components/Hud';
import { Button, Panel, Stars, colors } from '../../components/ui';
import { nextDay } from '../../game/engine';
import { useGame, useGameState } from '../../game/GameContext';
import { formatMoney } from '../../game/helpers';

const minus = (n: number) => (n > 0 ? '-' : '') + formatMoney(n);

function Line({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.lineValue, bold && styles.bold, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

export default function SummaryView() {
  const navigation = useNavigation();
  const game = useGameState();
  const { act, startNewGame } = useGame();
  const { width } = useWindowDimensions();
  const r = game.history[game.history.length - 1];
  if (!r) return null;

  const income = r.revenue + r.tips;
  const costs = r.ingredientCost + r.wages + r.rent + r.utilities + r.fines + r.otherCosts;
  const profit = income - costs;
  const repDelta = r.repEnd - r.repStart;
  const avgStars = r.reviews.length ? r.reviews.reduce((s, x) => s + x.stars, 0) / r.reviews.length : 0;

  return (
    <View style={styles.flex}>
      <Hud game={game} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>🌙 {game.profile.shopName} · tổng kết ngày {r.day}</Text>

        {game.gameOver === 'bankrupt' && (
          <Panel style={{ backgroundColor: colors.badBg }}>
            <Text style={styles.big}>💸 Phá sản!</Text>
            <Text style={styles.p}>Quán nợ quá nhiều, chủ nhà đã lấy lại mặt bằng. Thử lại với chiến lược khác nhé!</Text>
          </Panel>
        )}
        {game.gameOver === 'debt' && (
          <Panel style={{ backgroundColor: colors.badBg }}>
            <Text style={styles.big}>📉 Hết hạn trả nợ</Text>
            <Text style={styles.p}>Đã tới ngày {game.debtDueDay} mà vẫn còn nợ {formatMoney(game.debt)}. Ngân hàng đã siết nợ quán.</Text>
          </Panel>
        )}
        {game.debtPaidOnDay !== null && game.debtPaidOnDay === game.day && (
          <Panel style={{ backgroundColor: colors.goodBg }}>
            <Text style={styles.big}>🏆 Trả hết nợ!</Text>
            <Text style={styles.p}>Chúc mừng! Bạn đã trả hết nợ vào ngày {game.day}. Quán giờ là của bạn — tiếp tục kinh doanh nào!</Text>
          </Panel>
        )}

        <View style={[styles.columns, width >= 900 && styles.columnsWide]}>
          <View style={styles.flex}>
            <Panel title="💰 Thu chi">
              <Line label="Tiền bán món" value={formatMoney(r.revenue)} />
              <Line label="Tiền tip" value={formatMoney(r.tips)} />
              <Line label="Nguyên liệu" value={minus(r.ingredientCost)} />
              <Line label="Lương nhân viên" value={minus(r.wages)} />
              <Line label="Tiền mặt bằng" value={minus(r.rent)} />
              <Line label="Điện, gas" value={minus(r.utilities)} />
              {r.fines > 0 && <Line label="Tiền phạt" value={minus(r.fines)} color={colors.bad} />}
              {r.otherCosts > 0 && <Line label="Chi phí khác / nâng cấp" value={minus(r.otherCosts)} />}
              <Line label="Lãi / lỗ hôm nay" value={formatMoney(profit)} bold color={profit >= 0 ? colors.good : colors.bad} />
              {r.spoiledValue > 0 && <Text style={styles.warn}>⚠️ Khoảng {formatMoney(r.spoiledValue)} nguyên liệu sẽ hỏng vào ngày mai.</Text>}
            </Panel>

            <Panel title="📊 Hoạt động">
              <Line label="Bàn đã phục vụ" value={String(r.served)} />
              <Line label="Bàn bỏ về vì chờ lâu" value={String(r.lost)} />
              <Line label="Khách không có chỗ ngồi" value={String(r.noSeat)} />
              <Line label="Mang nhầm món" value={String(r.wrongDishes)} />
              <Line label="Món bị cháy" value={String(r.burnt)} />
              <Line label="Lỗi của nhân viên" value={String(r.staffErrors)} />
              <Line label="Khách bị dị ứng" value={String(r.allergic)} />
              <Line label="Khách bùng tiền" value={String(r.dashers)} />
              <Line
                label="Danh tiếng"
                value={`${r.repStart.toFixed(2)} → ${r.repEnd.toFixed(2)} (${repDelta >= 0 ? '+' : ''}${repDelta.toFixed(2)})`}
                color={repDelta >= 0 ? colors.good : colors.bad}
              />
            </Panel>

            {r.notes.length > 0 && (
              <Panel title="📝 Sự việc trong ngày">
                {r.notes.map((n, i) => (
                  <Text key={i} style={styles.p}>
                    • {n}
                  </Text>
                ))}
              </Panel>
            )}
          </View>

          <View style={styles.flex}>
            <Panel title="⭐ Đánh giá của khách" right={r.reviews.length ? <Stars value={avgStars} /> : undefined}>
              {r.reviews.length === 0 && <Text style={styles.muted}>Chưa có đánh giá.</Text>}
              {r.reviews
                .slice(-10)
                .reverse()
                .map((rv, i) => (
                  <View key={i} style={styles.review}>
                    <Stars value={rv.stars} size={12} />
                    <Text style={styles.p}>
                      <Text style={styles.bold}>{rv.name}: </Text>
                      {rv.text}
                    </Text>
                  </View>
                ))}
            </Panel>

            {game.gameOver ? (
              <Button label="🔄 Chơi lại từ đầu" onPress={startNewGame} />
            ) : (
              <Button label="☀️ Sang ngày mới" onPress={() => act((s, rng) => nextDay(s, rng))} />
            )}
            <Button variant="ghost" label="🏠 Về menu" onPress={() => navigation.navigate('Home')} style={{ marginTop: 8 }} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 12, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 10 },
  columns: { gap: 12 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  lineLabel: { color: colors.text },
  lineValue: { color: colors.text, fontWeight: '600' },
  bold: { fontWeight: '800' },
  big: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 4 },
  p: { color: colors.text, lineHeight: 19 },
  muted: { color: colors.muted },
  warn: { color: colors.bad, marginTop: 6, fontSize: 12 },
  review: { borderBottomWidth: 1, borderBottomColor: '#F7EDE2', paddingVertical: 5 },
});
