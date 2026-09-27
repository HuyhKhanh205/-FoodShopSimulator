import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Hud from '../../components/Hud';
import HelpButton from '../../components/kid/HelpButton';
import IconTile from '../../components/kid/IconTile';
import { Panel, Stars, colors } from '../../components/ui';
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
  const [details, setDetails] = useState(false);
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
        <View style={styles.headRow}>
          <Text style={styles.heading}>🌙 Ngày {r.day}</Text>
          <HelpButton topic="summary" />
        </View>

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

        {/* Tóm tắt bằng hình */}
        <View style={styles.bigRow}>
          <View style={styles.bigCard}>
            <Stars value={r.reviews.length ? avgStars : r.repEnd} size={30} />
          </View>
          <View style={[styles.bigCard, { backgroundColor: profit >= 0 ? colors.goodBg : colors.badBg }]}>
            <Text style={[styles.bigNum, { color: profit >= 0 ? colors.good : colors.bad }]}>
              💰 {profit >= 0 ? '+' : ''}
              {formatMoney(profit)}
            </Text>
          </View>
          <View style={styles.bigCard}>
            <Text style={styles.bigNum}>
              😊 {r.served} · 😡 {r.lost}
            </Text>
          </View>
        </View>
        {game.gameOver ? (
          <IconTile icon="🔄" label="Chơi lại" name="Chơi lại từ đầu" size="lg" tone="primary" onPress={startNewGame} style={styles.nextBtn} />
        ) : (
          <IconTile icon="☀️" label="Ngày mới" name="Sang ngày mới" size="lg" tone="primary" onPress={() => act((s, rng) => nextDay(s, rng))} style={styles.nextBtn} />
        )}
        <View style={styles.smallRow}>
          <IconTile icon="📊" label="Chi tiết" name="Xem chi tiết" size="sm" selected={details} onPress={() => setDetails((v) => !v)} />
          <IconTile icon="🏠" label="Menu" name="Về menu" size="sm" onPress={() => navigation.navigate('Home')} />
        </View>

        {details && (
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

          </View>
        </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 12, paddingBottom: 40 },
  heading: { fontSize: 24, fontWeight: '900', color: colors.text },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  bigRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  bigCard: { flexGrow: 1, backgroundColor: '#fff', borderRadius: 18, borderWidth: 2, borderColor: colors.border, padding: 14, alignItems: 'center', justifyContent: 'center' },
  bigNum: { fontSize: 24, fontWeight: '900', color: colors.text },
  nextBtn: { alignSelf: 'stretch', minHeight: 100, marginBottom: 12 },
  smallRow: { flexDirection: 'row', gap: 12, marginBottom: 12, paddingTop: 6 },
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
