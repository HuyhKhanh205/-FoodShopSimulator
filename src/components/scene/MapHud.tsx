import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CLOSE_HOUR, DAY_MS, OPEN_HOUR, RECIPES } from '../../game/data';
import { trendHeat } from '../../game/trend';
import { closeEarly, isPeak } from '../../game/engine';
import { useState } from 'react';
import { useGame, useGameState } from '../../game/GameContext';
import { formatClock, formatMoney } from '../../game/helpers';
import { settingsStore, useSettings } from '../../game/settings';
import { shows } from '../../game/unlocks';
import { tutorialUi } from '../kid/tutorialUi';
import { colors } from '../ui';

/** Nhãn nhỏ nổi trên cảnh (không tạo thành khối che màn hình). */
function Chip({ children, tone = 'plain', label }: { children: React.ReactNode; tone?: 'plain' | 'warn' | 'bad'; label?: string }) {
  return (
    <View style={[styles.chip, tone === 'warn' && styles.chipWarn, tone === 'bad' && styles.chipBad]} accessibilityLabel={label}>
      {children}
    </View>
  );
}

function RoundButton({ label, name, onPress, active }: { label: string; name: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.round, active && styles.roundActive, pressed && { transform: [{ scale: 0.92 }] }]}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <Text style={styles.roundText}>{label}</Text>
    </Pressable>
  );
}

/**
 * HUD màn quán (3D và Đơn giản): chỉ vài nhãn nhỏ ở góc — 🕐 giờ, 💰 tiền, ★ sao (🧽 khi đã mở) — và 2 nút tròn ⏸ / ❗.
 * Đổi chế độ, giọng đọc... nằm trong menu ⏸ Tạm dừng để màn chơi không bị che.
 */
export default function MapHud({ canToggle = true, below }: { compact?: boolean; canToggle?: boolean; below?: React.ReactNode }) {
  const game = useGameState();
  const { paused, setPaused } = useGame();
  const run = game.run!;
  const dayRatio = Math.min(1, run.elapsed / DAY_MS);
  const clean = Math.round(game.cleanliness);
  const clock = formatClock(run.elapsed, DAY_MS, OPEN_HOUR, CLOSE_HOUR);
  // Món đặc biệt hôm nay (XP ×2).
  const special = shows(game, 'notebook') && game.missions?.day === game.day && game.missions.special ? RECIPES[game.missions.special] : null;
  const warnings = [
    isPeak(run.elapsed) ? { text: '🔥 Đông khách', tone: 'warn' as const } : null,
    run.elapsed < run.powerOutUntil ? { text: '🔌 Cúp điện', tone: 'bad' as const } : null,
    run.elapsed < run.gasOutUntil ? { text: '🛢️ Hết gas', tone: 'bad' as const } : null,
    game.trend && trendHeat(game) > 0 && RECIPES[game.trend.recipeId] ? { text: `🔥 ${RECIPES[game.trend.recipeId].emoji}`, tone: 'warn' as const } : null,
    special ? { text: `🌟 ${special.emoji}×2`, tone: 'warn' as const } : null,
  ].filter(Boolean) as { text: string; tone: 'warn' | 'bad' }[];
  // Tin mới nhất, hiện trong 5 giây.
  const fresh = run.log.filter((l) => run.elapsed - l.t < 5000).slice(0, 1);

  return (
    <>
      <View pointerEvents="box-none" style={styles.wrap}>
        <View pointerEvents="box-none" style={styles.top}>
          <View pointerEvents="none" style={styles.chips}>
            <Chip label={`Giờ ${clock}`}>
              <Text style={styles.chipText}>🕐 {clock}</Text>
              <View style={styles.dayTrack}>
                <View style={[styles.dayFill, { width: `${dayRatio * 100}%` }]} />
              </View>
            </Chip>
            <Chip label={`Tiền ${formatMoney(game.money)}`}>
              <Text style={styles.chipText}>💰 {formatMoney(game.money)}</Text>
            </Chip>
            <Chip label={`Danh tiếng ${game.reputation.toFixed(1)} sao`}>
              <Text style={styles.chipText}>
                <Text style={{ color: colors.accent }}>★</Text> {game.reputation.toFixed(1)}
              </Text>
            </Chip>
            {shows(game, 'clean') && (
              <Chip tone={clean < 40 ? 'bad' : 'plain'} label={`Độ sạch ${clean}%`}>
                <Text style={styles.chipText}>🧽 {clean}%</Text>
              </Chip>
            )}
            {warnings.map((w) => (
              <Chip key={w.text} tone={w.tone}>
                <Text style={styles.chipText}>{w.text}</Text>
              </Chip>
            ))}
          </View>
          <View style={styles.buttons}>
            <RoundButton label="⏸️" name="Tạm dừng" onPress={() => setPaused(true)} />
            <RoundButton label="!" name="Hướng dẫn" onPress={() => tutorialUi.requestHelp('shop')} />
          </View>
        </View>
        {!paused && below}
        {!paused &&
          fresh.map((l) => (
            <Text
              key={l.id}
              numberOfLines={1}
              pointerEvents="none"
              style={[styles.toast, { opacity: 1 - (run.elapsed - l.t) / 5000 }, l.tone === 'bad' && { color: '#FFCDD2' }, l.tone === 'good' && { color: '#C8E6C9' }]}
            >
              {l.text}
            </Text>
          ))}
      </View>
      {paused && <PauseMenu canToggle={canToggle} onResume={() => setPaused(false)} />}
    </>
  );
}

/** Menu ⏸ Tạm dừng: ít lựa chọn, chữ to, che mờ cảnh phía sau. */
function PauseMenu({ canToggle, onResume }: { canToggle: boolean; onResume: () => void }) {
  const { sceneMode, setSceneMode, act, game } = useGame();
  const settings = useSettings();
  const [askClose, setAskClose] = useState(false);
  const seated = game?.run?.customers.length ?? 0;
  return (
    <View style={styles.backdrop}>
      <View style={styles.menu} accessibilityLabel="Tạm dừng">
        <Text style={styles.menuTitle}>⏸️ Tạm dừng</Text>
        <Pressable onPress={onResume} style={({ pressed }) => [styles.resume, pressed && { transform: [{ translateY: 3 }] }]} accessibilityRole="button" accessibilityLabel="Chơi tiếp">
          <Text style={styles.resumeText}>▶ Chơi tiếp</Text>
        </Pressable>
        {canToggle && (
          <MenuRow
            icon={sceneMode === '3d' ? '🌴' : '🔲'}
            label={sceneMode === '3d' ? 'Cảnh 3D' : 'Cảnh Đơn giản'}
            action={sceneMode === '3d' ? 'Đổi sang Đơn giản' : 'Đổi sang 3D'}
            onPress={() => setSceneMode(sceneMode === '3d' ? 'simple' : '3d')}
          />
        )}
        <MenuRow
          icon={settings.voice ? '🔊' : '🔇'}
          label={settings.voice ? 'Giọng Chú Tư: bật' : 'Giọng Chú Tư: tắt'}
          action={settings.voice ? 'Tắt' : 'Bật'}
          onPress={() => settingsStore.set({ voice: !settings.voice })}
        />
        <MenuRow
          icon="🏷️"
          label={settings.labels === 'always' ? 'Tên đồ vật: luôn hiện' : 'Tên đồ vật: khi đứng gần'}
          action={settings.labels === 'always' ? 'Gọn lại' : 'Luôn hiện'}
          onPress={() => settingsStore.set({ labels: settings.labels === 'always' ? 'auto' : 'always' })}
        />
        {askClose ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmText}>🌙 Đóng cửa sớm, sang tổng kết?{seated ? ` ${seated} bàn khách đang chờ sẽ ra về.` : ''}</Text>
            <View style={styles.confirmRow}>
              <Pressable
                onPress={() => {
                  onResume();
                  act((s) => void closeEarly(s));
                }}
                style={[styles.confirmBtn, { backgroundColor: colors.brown }]}
                accessibilityRole="button"
                accessibilityLabel="Nghỉ sớm luôn"
              >
                <Text style={[styles.confirmBtnText, { color: colors.cream }]}>🌙 Nghỉ luôn</Text>
              </Pressable>
              <Pressable onPress={() => setAskClose(false)} style={styles.confirmBtn} accessibilityRole="button" accessibilityLabel="Bán tiếp">
                <Text style={styles.confirmBtnText}>Bán tiếp</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <MenuRow icon="🌙" label="Nghỉ sớm, qua ngày" action="Đóng cửa" onPress={() => setAskClose(true)} />
        )}
        <MenuRow
          icon="❗"
          label="Cách chơi"
          action="Xem"
          onPress={() => {
            onResume();
            tutorialUi.requestHelp('shop');
          }}
        />
      </View>
    </View>
  );
}

function MenuRow({ icon, label, action, onPress }: { icon: string; label: string; action: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { transform: [{ translateY: 2 }] }]} accessibilityRole="button" accessibilityLabel={`${label}: ${action}`}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.rowAction}>{action}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, padding: 8, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: {
    backgroundColor: 'rgba(255,246,233,0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(62,47,42,0.15)',
  },
  chipWarn: { backgroundColor: 'rgba(255,243,224,0.95)', borderColor: colors.accent },
  chipBad: { backgroundColor: 'rgba(255,235,238,0.95)', borderColor: colors.bad },
  chipText: { fontSize: 13, fontWeight: '900', color: colors.brown, fontVariant: ['tabular-nums'] },
  dayTrack: { height: 3, borderRadius: 2, backgroundColor: '#EFE2CF', marginTop: 2, overflow: 'hidden' },
  dayFill: { height: 3, backgroundColor: colors.primary },
  buttons: { flexDirection: 'row', gap: 6 },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,246,233,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.chunkyShadow,
    borderBottomWidth: 3,
  },
  roundActive: { backgroundColor: colors.primary },
  roundText: { fontSize: 17, fontWeight: '900', color: colors.brown },
  toast: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    color: '#fff',
    backgroundColor: 'rgba(62,39,35,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9,
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
  },
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(40,25,15,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  menu: { width: '100%', maxWidth: 360, backgroundColor: colors.cream, borderRadius: 24, padding: 16, gap: 10, borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 6 },
  menuTitle: { fontSize: 22, fontWeight: '900', color: colors.brown, textAlign: 'center' },
  resume: { backgroundColor: colors.primary, borderRadius: 18, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 6, borderColor: colors.primaryDark },
  resumeText: { fontSize: 22, fontWeight: '900', color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 4 },
  rowIcon: { fontSize: 24 },
  confirm: { backgroundColor: '#FFF3DC', borderRadius: 16, padding: 12, gap: 8, borderWidth: 2, borderColor: colors.accent },
  confirmText: { fontSize: 15, fontWeight: '800', color: colors.brown },
  confirmRow: { flexDirection: 'row', gap: 8 },
  confirmBtn: { flex: 1, borderRadius: 14, paddingVertical: 11, alignItems: 'center', backgroundColor: '#fff', borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 4 },
  confirmBtnText: { fontSize: 15, fontWeight: '900', color: colors.brown },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.brown },
  rowAction: { fontSize: 14, fontWeight: '900', color: colors.primaryDark },
});
