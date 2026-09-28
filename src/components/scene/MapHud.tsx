import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CLOSE_HOUR, DAY_MS, OPEN_HOUR, RECIPES } from '../../game/data';
import { trendHeat } from '../../game/trend';
import { isPeak } from '../../game/engine';
import { useGame, useGameState } from '../../game/GameContext';
import { formatClock, formatMoney } from '../../game/helpers';
import HelpButton from '../kid/HelpButton';
import { colors } from '../ui';
import { shows } from '../../game/unlocks';

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

/**
 * HUD màn quán (dùng chung cho 3D và Đơn giản): một dải kem to ở trên cùng —
 * giờ, tiền, ★ / độ sạch; nút chuyển Đơn giản / 3D ở giữa; chỉ giữ ⏸ và ❗.
 * Các nút khác (Chợ, Lau, Kho, Bố trí...) nằm ở thanh hành động có nhãn phía dưới.
 */
export default function MapHud({ canToggle = true, below }: { compact?: boolean; canToggle?: boolean; below?: React.ReactNode }) {
  const btn = 42;
  const game = useGameState();
  const { paused, setPaused, sceneMode, setSceneMode } = useGame();
  const run = game.run!;
  const dayRatio = Math.min(1, run.elapsed / DAY_MS);
  const clean = Math.round(game.cleanliness);
  // Món đặc biệt hôm nay (XP ×2).
  const special = shows(game, 'notebook') && game.missions?.day === game.day && game.missions.special ? RECIPES[game.missions.special] : null;
  const warnings = [
    isPeak(run.elapsed) ? { text: '🔥 Đông khách', tone: 'warn' as const } : null,
    run.elapsed < run.powerOutUntil ? { text: '🔌 Cúp điện', tone: 'bad' as const } : null,
    run.elapsed < run.gasOutUntil ? { text: '🛢️ Hết gas', tone: 'bad' as const } : null,
    game.trend && trendHeat(game) > 0 && RECIPES[game.trend.recipeId]
      ? { text: `🔥 ${RECIPES[game.trend.recipeId].emoji} ${Math.round(trendHeat(game) * 100)}%`, tone: 'warn' as const }
      : null,
    special ? { text: `🌟 ${special.emoji} ×2`, tone: 'warn' as const } : null,
  ].filter(Boolean) as { text: string; tone: 'warn' | 'bad' }[];
  // Hai tin mới nhất, hiện trong 6 giây.
  const fresh = run.log.filter((l) => run.elapsed - l.t < 6000).slice(0, 1);

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.strip}>
        <View style={[styles.stats, !canToggle && { paddingRight: 84 }]}>
          <View style={styles.stat} accessibilityLabel={`Giờ ${formatClock(run.elapsed, DAY_MS, OPEN_HOUR, CLOSE_HOUR)}`}>
            <Text style={styles.statText}>🕐 {formatClock(run.elapsed, DAY_MS, OPEN_HOUR, CLOSE_HOUR)}</Text>
            <View style={styles.dayTrack}>
              <View style={[styles.dayFill, { width: `${dayRatio * 100}%` }]} />
            </View>
          </View>
          <Text style={[styles.statText, styles.stat]} numberOfLines={1}>
            💰 {formatMoney(game.money)}
          </Text>
          <Text style={[styles.statText, styles.stat, clean < 40 && { color: colors.bad }]} numberOfLines={1}>
            <Text style={{ color: colors.accent }}>★</Text> {game.reputation.toFixed(1)}
            {shows(game, 'clean') ? ` · 🧽 ${clean}%` : ''}
          </Text>
        </View>
        {!canToggle && (
          <View style={[styles.controls, { position: 'absolute', right: 8, top: 5 }]}>
            <IconButton size={36} label={paused ? '▶️' : '⏸️'} active={paused} onPress={() => setPaused(!paused)} />
            <HelpButton topic="shop" style={{ width: 36, height: 36, borderRadius: 18 }} />
          </View>
        )}
        {canToggle && (
        <View style={styles.controls}>
          {canToggle ? (
            <View style={styles.segment} accessibilityRole="radiogroup">
              {(['simple', '3d'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setSceneMode(m)}
                  style={[styles.segBtn, sceneMode === m && styles.segOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sceneMode === m }}
                  accessibilityLabel={m === 'simple' ? 'Chế độ Đơn giản' : 'Chế độ 3D'}
                >
                  <Text style={[styles.segText, sceneMode === m && styles.segTextOn]}>{m === 'simple' ? 'Đơn giản' : '3D'}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <IconButton size={btn} label={paused ? '▶️' : '⏸️'} active={paused} onPress={() => setPaused(!paused)} />
          <HelpButton topic="shop" style={{ width: btn, height: btn, borderRadius: btn / 2 }} />
        </View>
        )}
      </View>
      {below}
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
          <Text style={styles.paused}>⏸️</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, padding: 8, gap: 6 },
  strip: {
    backgroundColor: colors.cream,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 2,
    borderColor: colors.chunkyShadow,
    borderBottomWidth: 5,
  },
  stats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, minHeight: 36 },
  stat: { flexShrink: 1 },
  statText: { fontSize: 16, fontWeight: '900', color: colors.brown, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  segment: { flex: 1, flexDirection: 'row', backgroundColor: '#EFE2CF', borderRadius: 21, padding: 3, height: 42 },
  segBtn: { flex: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.brown },
  segText: { fontSize: 15, fontWeight: '900', color: colors.brown },
  segTextOn: { color: colors.cream },
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
  dayTrack: { height: 4, borderRadius: 2, backgroundColor: '#EFE2CF', marginTop: 3, overflow: 'hidden' },
  dayFill: { height: 4, backgroundColor: colors.primary },
  buttons: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.chunkyShadow,
    borderBottomWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  iconBtnActive: { backgroundColor: colors.primary },
  iconText: { fontSize: 20 },
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
