import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CLOSE_HOUR, DAY_MS, OPEN_HOUR } from '../../game/data';
import { isPeak, playerClean } from '../../game/engine';
import { useGame, useGameState } from '../../game/GameContext';
import { formatClock, formatMoney } from '../../game/helpers';
import GoMarketButton from '../GoMarketButton';
import { colors } from '../ui';

function Pill({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'warn' | 'bad' }) {
  return <View style={[styles.pill, tone === 'warn' && styles.pillWarn, tone === 'bad' && styles.pillBad]}>{children}</View>;
}

function IconButton({ label, onPress, active, disabled, size }: { label: string; onPress: () => void; active?: boolean; disabled?: boolean; size: number }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.iconBtn, { width: size, height: size, borderRadius: size / 2 }, active && styles.iconBtnActive, disabled && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.94 }] }]}
    >
      <Text style={styles.iconText}>{label}</Text>
    </Pressable>
  );
}

/** Chỉ số nổi trên cảnh 3D: giờ, tiền, danh tiếng, vệ sinh, cảnh báo và nút điều khiển. */
export default function MapHud({ compact }: { compact: boolean }) {
  const btn = compact ? 36 : 40;
  const game = useGameState();
  const { act, paused, setPaused, setViewMode } = useGame();
  const run = game.run!;
  const dayRatio = Math.min(1, run.elapsed / DAY_MS);
  const clean = Math.round(game.cleanliness);
  const cleanReady = run.elapsed >= run.cleanReadyAt;
  const warnings = [
    isPeak(run.elapsed) ? { text: '🔥 Giờ cao điểm', tone: 'warn' as const } : null,
    run.elapsed < run.powerOutUntil ? { text: '🔌 Cúp điện', tone: 'bad' as const } : null,
    run.elapsed < run.gasOutUntil ? { text: '🛢️ Hết gas', tone: 'bad' as const } : null,
  ].filter(Boolean) as { text: string; tone: 'warn' | 'bad' }[];
  // Hai tin mới nhất, hiện trong 6 giây.
  const fresh = run.log.filter((l) => run.elapsed - l.t < 6000).slice(0, 2);

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View pointerEvents="box-none" style={styles.row}>
        <View style={styles.pills}>
          <Pill>
            <Text style={styles.pillText}>🕐 {formatClock(run.elapsed, DAY_MS, OPEN_HOUR, CLOSE_HOUR)}</Text>
            <View style={styles.dayTrack}>
              <View style={[styles.dayFill, { width: `${dayRatio * 100}%` }]} />
            </View>
          </Pill>
          <Pill>
            <Text style={styles.pillText}>💰 {formatMoney(game.money)}</Text>
          </Pill>
          <Pill tone={clean < 40 ? 'bad' : 'plain'}>
            <Text style={styles.pillText}>
              <Text style={{ color: colors.accent }}>★</Text> {game.reputation.toFixed(1)} · 🧽 {clean}%
            </Text>
          </Pill>
        </View>
        <View style={styles.buttons}>
          <GoMarketButton render={(onPress) => <IconButton size={btn} label="🛒" onPress={onPress} />} />
          <IconButton size={btn} label="🧽" disabled={!cleanReady} onPress={() => act((s) => playerClean(s))} />
          <IconButton size={btn} label="📋" onPress={() => setViewMode('panel')} />
          <IconButton size={btn} label={paused ? '▶️' : '⏸️'} active={paused} onPress={() => setPaused(!paused)} />
        </View>
      </View>
      {warnings.length > 0 && (
        <View style={styles.pills}>
          {warnings.map((w) => (
            <Pill key={w.text} tone={w.tone}>
              <Text style={styles.pillText}>{w.text}</Text>
            </Pill>
          ))}
        </View>
      )}
      {fresh.map((l) => (
        <Text
          key={l.id}
          numberOfLines={1}
          style={[styles.toast, { opacity: 1 - (run.elapsed - l.t) / 6000 }, l.tone === 'bad' && { color: '#FFCDD2' }, l.tone === 'good' && { color: '#C8E6C9' }]}
        >
          {l.text}
        </Text>
      ))}
      {paused && (
        <View style={styles.pausedBox}>
          <Text style={styles.paused}>⏸️ Tạm dừng</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, padding: 8, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flexShrink: 1 },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(62,39,35,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  pillWarn: { backgroundColor: '#FFF3E0', borderColor: colors.accent },
  pillBad: { backgroundColor: '#FFEBEE', borderColor: colors.bad },
  pillText: { fontSize: 12, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  dayTrack: { height: 3, borderRadius: 2, backgroundColor: '#EFEBE9', marginTop: 3, overflow: 'hidden' },
  dayFill: { height: 3, backgroundColor: colors.primary },
  buttons: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(62,39,35,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  iconBtnActive: { backgroundColor: colors.primary },
  iconText: { fontSize: 18 },
  toast: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    color: '#fff',
    backgroundColor: 'rgba(62,39,35,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  pausedBox: { alignSelf: 'center', marginTop: 40, backgroundColor: 'rgba(62,39,35,0.8)', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 10 },
  paused: { color: '#fff', fontSize: 18, fontWeight: '900' },
});
