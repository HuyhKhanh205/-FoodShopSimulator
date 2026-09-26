import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Button, Panel, ProgressBar, colors } from '../components/ui';
import { ROLE_EMOJI, ROLE_LABEL, TRAITS } from '../game/data';
import { MAX_STAFF, fire, hire, raiseWage, toggleDayOff } from '../game/engine';
import { useGame } from '../game/GameContext';
import { errorRate, fairWage, formatMoney } from '../game/helpers';
import type { GameState, Staff } from '../game/types';

const ROLE_DESC = {
  cook: 'Tự nấu món khách gọi (cần nguyên liệu đã sơ chế).',
  prep: 'Tự sơ chế thịt, rau, hành.',
  waiter: 'Mang món ra cho khách, bỏ món cháy, lau dọn, chặn khách bùng tiền.',
};

function StaffCard({ st, game, children }: { st: Staff; game: GameState; children: React.ReactNode }) {
  const err = errorRate(game, st);
  const fair = fairWage(st.skill);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.avatar}>{ROLE_EMOJI[st.role]}</Text>
        <View style={styles.flex}>
          <Text style={styles.name}>
            {st.name} · {ROLE_LABEL[st.role]}
          </Text>
          <Text style={styles.muted}>{ROLE_DESC[st.role]}</Text>
        </View>
      </View>
      <Text style={styles.stat}>Tay nghề {st.skill}/100</Text>
      <ProgressBar value={st.skill / 100} color={colors.info} />
      <Text style={styles.stat}>Tâm trạng {Math.round(st.mood)}/100</Text>
      <ProgressBar value={st.mood / 100} color={st.mood < 30 ? colors.bad : st.mood < 60 ? colors.accent : colors.good} />
      <Text style={styles.line}>
        Tính cách: <Text style={styles.bold}>{TRAITS[st.trait].name}</Text> — {TRAITS[st.trait].desc}
      </Text>
      <Text style={styles.line}>
        Lương: <Text style={styles.bold}>{formatMoney(st.wage)}/ngày</Text>
        <Text style={st.wage < fair * 0.9 ? { color: colors.bad } : styles.muted}> (mặt bằng chung ~{formatMoney(fair)})</Text>
      </Text>
      <Text style={styles.line}>
        Tỉ lệ làm sai ước tính: <Text style={[styles.bold, { color: err > 0.15 ? colors.bad : err > 0.08 ? colors.primary : colors.good }]}>{Math.round(err * 100)}%</Text>
        <Text style={styles.muted}> (tăng khi đông khách)</Text>
      </Text>
      {st.absent && <Text style={[styles.line, { color: colors.bad }]}>Nghỉ hôm nay</Text>}
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

export default function StaffScreen() {
  const navigation = useNavigation();
  const { game, act } = useGame();
  if (!game) return null;
  const full = game.staff.length >= MAX_STAFF;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Button small variant="ghost" label="← Quay lại" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>👥 Nhân viên</Text>
        <Text style={styles.money}>{formatMoney(game.money)}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Panel title={`Đang làm (${game.staff.length}/${MAX_STAFF})`}>
          {game.staff.length === 0 && <Text style={styles.muted}>Chưa có nhân viên. Bạn đang tự làm tất cả!</Text>}
          <View style={styles.grid}>
            {game.staff.map((st) => (
              <StaffCard key={st.id} st={st} game={game}>
                <Button small label="Tăng lương 10%" onPress={() => act((s) => raiseWage(s, st.id))} />
                {game.phase === 'market' && (
                  <Button small variant="secondary" label={st.absent ? 'Gọi đi làm' : 'Cho nghỉ hôm nay'} onPress={() => act((s) => toggleDayOff(s, st.id))} />
                )}
                <Button small variant="danger" label={`Sa thải (-${formatMoney(st.wage)})`} onPress={() => act((s) => fire(s, st.id))} />
              </StaffCard>
            ))}
          </View>
        </Panel>

        <Panel title="📄 Ứng viên hôm nay">
          <Text style={[styles.muted, { marginBottom: 8 }]}>
            Lương trả cuối mỗi ngày. Tay nghề cao thì ít sai nhưng lương cao. Mỗi ngày có ứng viên mới.
          </Text>
          <View style={styles.grid}>
            {game.candidates.map((st) => (
              <StaffCard key={st.id} st={st} game={game}>
                <Button small label={full ? 'Đã đủ người' : 'Thuê'} disabled={full} onPress={() => act((s) => void hire(s, st.id))} />
              </StaffCard>
            ))}
          </View>
        </Panel>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  money: { fontWeight: '800', color: colors.primary, marginRight: 8 },
  content: { padding: 12, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexGrow: 1, flexBasis: 300, maxWidth: 520, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: '#FFFCF8' },
  cardHeader: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 },
  avatar: { fontSize: 30 },
  flex: { flex: 1 },
  name: { fontWeight: '800', fontSize: 15, color: colors.text },
  stat: { fontSize: 12, color: colors.text, marginTop: 6, marginBottom: 2 },
  line: { fontSize: 13, color: colors.text, marginTop: 6 },
  bold: { fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
});
