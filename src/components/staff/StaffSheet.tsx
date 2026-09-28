import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ROLE_EMOJI, ROLE_LABEL } from '../../game/data';
import { MAX_STAFF, canBreak, fire, hire, raiseWage, setStudentRole, staffBreak } from '../../game/engine';
import { useGame } from '../../game/GameContext';
import { formatMoney } from '../../game/helpers';
import { unlockedRoles } from '../../game/progression';
import type { GameState, Staff, StaffRole } from '../../game/types';
import { colors } from '../ui';

const ROLES: StaffRole[] = ['prep', 'cook', 'waiter'];

/** Nhân viên đang làm gì (chữ ngắn + hình). */
export function staffStatus(game: GameState, st: Staff): string {
  const run = game.run;
  if (st.absent) return '😴 Nghỉ ở nhà';
  if (!run) return '🙂 Sẵn sàng';
  if (run.elapsed < st.lateUntil) return `🚶 Đang tới (${Math.ceil((st.lateUntil - run.elapsed) / 1000)}s)`;
  if (run.slots.some((sl) => sl.job?.by === st.id)) return '🍳 Đang nấu';
  switch (st.task?.kind) {
    case 'break':
      return `☕ Nghỉ (${Math.max(0, Math.ceil((st.task.endsAt - run.elapsed) / 1000))}s)`;
    case 'prep':
      return '🔪 Sơ chế';
    case 'cook_start':
      return '🍳 Bắt đầu nấu';
    case 'serve':
      return '🍽️ Bưng món';
    case 'clean':
      return '🧽 Lau dọn';
    case 'fallen':
      return '💥 Vấp té';
    default:
      return '💤 Rảnh';
  }
}

/** Hàng nút chọn vai trò cho sinh viên (chỉ vai đã mở). `pending` = vai sẽ đổi khi xong việc. */
export function RolePicker({ game, current, pending, onPick, prefix = '' }: { game: GameState; current?: StaffRole; pending?: StaffRole; onPick: (r: StaffRole) => void; prefix?: string }) {
  const open = unlockedRoles(game);
  return (
    <View style={styles.roles}>
      {ROLES.filter((r) => open.includes(r)).map((r) => {
        const on = r === current;
        const wait = r === pending;
        return (
          <Pressable
            key={r}
            onPress={() => onPick(r)}
            style={[styles.role, on && styles.roleOn, wait && styles.roleWait]}
            accessibilityRole="button"
            accessibilityLabel={`${prefix}${ROLE_LABEL[r]}${on ? ' (đang làm)' : wait ? ' (đổi khi xong việc)' : ''}`}
          >
            <Text style={[styles.roleText, on && { color: '#fff' }]}>
              {wait ? '⏳' : ROLE_EMOJI[r]} {prefix}
              {ROLE_LABEL[r]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * 👥 Bảng nhân viên trong giờ bán (đồng hồ vẫn chạy): xem ai đang làm gì, cho nghỉ giải lao,
 * tăng lương, cho nghỉ việc, đổi vai sinh viên, thuê thêm người (20 giây sau tới).
 */
export default function StaffSheet({ onClose, selected, onSelect }: { onClose: () => void; selected: string | null; onSelect: (id: string | null) => void }) {
  const { game, act } = useGame();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [hiring, setHiring] = useState(false);
  if (!game) return null;
  const full = game.staff.length >= MAX_STAFF;

  return (
    <View style={styles.sheet} accessibilityLabel="Bảng nhân viên">
      <View style={styles.head}>
        <Text style={styles.title}>
          👥 Nhân viên {game.staff.length}/{MAX_STAFF}
        </Text>
        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Đóng bảng nhân viên">
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {game.staff.length === 0 && <Text style={styles.muted}>Chưa có ai. Thuê thêm người ở dưới nhé!</Text>}
        {game.staff.map((st) => {
          const sel = selected === st.id;
          return (
            <Pressable key={st.id} onPress={() => onSelect(sel ? null : st.id)} style={[styles.row, sel && styles.rowSel]} accessibilityLabel={`${st.name}, ${ROLE_LABEL[st.role]}, ${staffStatus(game, st)}`}>
              <View style={styles.rowTop}>
                <Text style={styles.avatar}>{ROLE_EMOJI[st.role]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {st.student ? '🎓 ' : ''}
                    {st.name} · {ROLE_LABEL[st.role]}
                  </Text>
                  <Text style={styles.status} numberOfLines={1}>
                    {staffStatus(game, st)} · <Text style={{ color: st.mood < 30 ? colors.bad : st.mood < 60 ? colors.primary : colors.good }}>😊 {Math.round(st.mood)}</Text>
                  </Text>
                </View>
              </View>
              {st.student && <RolePicker game={game} current={st.role} pending={st.nextRole} onPick={(r) => act((s) => void setStudentRole(s, st.id, r))} />}
              <View style={styles.btns}>
                <Chip label="☕ Nghỉ" name={`Cho ${st.name} nghỉ giải lao`} disabled={!canBreak(game, st)} onPress={() => act((s) => void staffBreak(s, st.id))} />
                <Chip label={`💰 +10%`} name={`Tăng lương ${st.name}`} onPress={() => act((s) => raiseWage(s, st.id))} />
                {confirm === st.id ? (
                  <Chip
                    label={`👋 Chắc chắn? (−${formatMoney(st.wage)})`}
                    name={`Xác nhận cho ${st.name} nghỉ việc`}
                    danger
                    onPress={() => {
                      setConfirm(null);
                      onSelect(null);
                      act((s) => fire(s, st.id));
                    }}
                  />
                ) : (
                  <Chip label="👋" name={`Cho ${st.name} nghỉ việc`} onPress={() => setConfirm(st.id)} />
                )}
              </View>
            </Pressable>
          );
        })}

        <Pressable onPress={() => setHiring(!hiring)} style={styles.hireHead} accessibilityRole="button" accessibilityLabel={hiring ? 'Ẩn danh sách thuê' : 'Thuê thêm người'}>
          <Text style={styles.hireHeadText}>
            {hiring ? '▾' : '▸'} ➕ Thuê thêm ({game.candidates.length})
          </Text>
        </Pressable>
        {hiring &&
          game.candidates.map((c) => (
            <View key={c.id} style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.avatar}>{c.student ? '🎓' : ROLE_EMOJI[c.role]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {c.name} · {c.student ? 'Sinh viên (chọn vai)' : ROLE_LABEL[c.role]}
                  </Text>
                  <Text style={styles.status}>
                    🛠️ {c.skill} · 💰 {formatMoney(c.wage)}/ngày
                  </Text>
                </View>
              </View>
              {full ? (
                <Text style={styles.muted}>🚫 Quán đã đủ {MAX_STAFF} người</Text>
              ) : c.student ? (
                <RolePicker game={game} prefix="Thuê làm " onPick={(r) => act((s) => void hire(s, c.id, r))} />
              ) : (
                <View style={styles.btns}>
                  <Chip label="✅ Thuê" name={`Thuê ${c.name}`} onPress={() => act((s) => void hire(s, c.id))} />
                </View>
              )}
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

function Chip({ label, name, onPress, disabled, danger }: { label: string; name: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.chip, danger && styles.chipDanger, disabled && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel={name}>
      <Text style={[styles.chipText, danger && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    maxHeight: '46%',
    backgroundColor: colors.cream,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.chunkyShadow,
    borderBottomWidth: 5,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 16, fontWeight: '900', color: colors.brown },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.chunkyShadow },
  closeText: { fontSize: 16, fontWeight: '900', color: colors.brown },
  body: { paddingHorizontal: 10, paddingBottom: 12, gap: 8 },
  muted: { fontSize: 13, color: colors.muted, fontWeight: '700' },
  row: { backgroundColor: '#fff', borderRadius: 14, padding: 8, borderWidth: 2, borderColor: colors.border, gap: 6 },
  rowSel: { borderColor: '#FFB300', backgroundColor: '#FFF8E1' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { fontSize: 26 },
  name: { fontSize: 14, fontWeight: '900', color: colors.brown },
  status: { fontSize: 12, fontWeight: '700', color: colors.muted },
  btns: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.warnBg, borderWidth: 1, borderColor: colors.border },
  chipDanger: { backgroundColor: colors.bad, borderColor: colors.bad },
  chipText: { fontSize: 13, fontWeight: '800', color: colors.brown },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  role: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: '#F1F8E9', borderWidth: 1, borderColor: '#C5E1A5' },
  roleOn: { backgroundColor: colors.good, borderColor: colors.good },
  roleWait: { backgroundColor: '#FFF3E0', borderColor: colors.accent },
  roleText: { fontSize: 12, fontWeight: '800', color: colors.brown },
  hireHead: { paddingVertical: 6 },
  hireHeadText: { fontSize: 14, fontWeight: '900', color: colors.primaryDark },
});
