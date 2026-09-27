import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CLOSE_HOUR, DAY_MS, OPEN_HOUR } from '../game/data';
import { isPeak, playerClean } from '../game/engine';
import { useGame, useGameState } from '../game/GameContext';
import { formatClock } from '../game/helpers';
import { Button, ProgressBar, colors } from './ui';

/** Thanh dưới Hud khi mở cửa: đồng hồ, cảnh báo, lau dọn, tạm dừng, đổi chế độ xem. */
export default function ShopTopBar({ showClean = true }: { showClean?: boolean }) {
  const game = useGameState();
  const { act, paused, setPaused, viewMode, setViewMode } = useGame();
  const run = game.run!;
  const powerOut = run.elapsed < run.powerOutUntil;
  const gasOut = run.elapsed < run.gasOutUntil;
  const cleanReady = run.elapsed >= run.cleanReadyAt;

  return (
    <View style={styles.topBar}>
      <View style={styles.flex}>
        <Text style={styles.clock} numberOfLines={1}>
          🕐 {formatClock(run.elapsed, DAY_MS, OPEN_HOUR, CLOSE_HOUR)} {isPeak(run.elapsed) ? <Text style={styles.warn}>· Cao điểm!</Text> : null}
          {powerOut ? <Text style={styles.warn}> · 🔌 Cúp điện</Text> : null}
          {gasOut ? <Text style={styles.warn}> · 🛢️ Hết gas</Text> : null}
        </Text>
        <ProgressBar value={run.elapsed / DAY_MS} height={5} color={colors.primary} />
      </View>
      {showClean && (
        <Button small variant="secondary" label={cleanReady ? '🧽 Lau' : '🧽 ...'} disabled={!cleanReady} onPress={() => act((s) => playerClean(s))} />
      )}
      <Button
        small
        variant="secondary"
        label={viewMode === 'map' ? '📋 Bảng' : '🗺️ Bản đồ'}
        onPress={() => setViewMode(viewMode === 'map' ? 'panel' : 'map')}
      />
      <Button small variant={paused ? 'primary' : 'secondary'} label={paused ? '▶️' : '⏸️'} onPress={() => setPaused(!paused)} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: '#FFF3E0',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  flex: { flex: 1 },
  clock: { fontWeight: '800', color: colors.text, marginBottom: 4 },
  warn: { color: colors.bad },
});
