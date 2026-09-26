import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatMoney } from '../game/helpers';
import type { GameState } from '../game/types';
import { Stars, colors } from './ui';

/** Thanh chỉ số trên cùng: ngày, tiền, nợ, danh tiếng, vệ sinh. */
export default function Hud({ game, extra }: { game: GameState; extra?: React.ReactNode }) {
  const clean = Math.round(game.cleanliness);
  return (
    <View style={styles.hud}>
      <Item label={`Ngày ${game.day}/${game.debtDueDay}`} value={formatMoney(game.money)} valueColor={game.money < 0 ? '#FFCDD2' : '#fff'} />
      <Item label="Nợ còn" value={game.debt > 0 ? formatMoney(game.debt) : 'Đã trả hết 🎉'} />
      <View style={styles.item}>
        <Text style={styles.label}>Danh tiếng {game.reputation.toFixed(1)}</Text>
        <Stars value={game.reputation} size={15} />
      </View>
      <Item label="Vệ sinh" value={`${clean}%`} valueColor={clean < 40 ? '#FFCDD2' : '#fff'} />
      {extra}
    </View>
  );
}

function Item({ label, value, valueColor = '#fff' }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.item}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 14,
    alignItems: 'center',
  },
  item: { minWidth: 70 },
  label: { color: '#FFE0B2', fontSize: 11, fontWeight: '600' },
  value: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
