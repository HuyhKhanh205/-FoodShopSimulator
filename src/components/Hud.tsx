import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatMoney } from '../game/helpers';
import type { GameState } from '../game/types';
import { Stars, colors } from './ui';

/** Thanh chỉ số trên cùng (bằng biểu tượng): 📅 ngày / hạn nợ, 💰 tiền, 💳 nợ, ⭐ danh tiếng, 🧽 vệ sinh. */
export default function Hud({ game, extra }: { game: GameState; extra?: React.ReactNode }) {
  const clean = Math.round(game.cleanliness);
  return (
    <View style={styles.hud}>
      <Item icon="📅" value={`${game.day}/${game.debtDueDay}`} />
      <Item icon="💰" value={formatMoney(game.money)} valueColor={game.money < 0 ? '#FFCDD2' : '#fff'} />
      <Item icon="💳" value={game.debt > 0 ? formatMoney(game.debt) : '🎉'} />
      <View style={styles.item}>
        <Stars value={game.reputation} size={16} />
      </View>
      <Item icon="🧽" value={`${clean}%`} valueColor={clean < 40 ? '#FFCDD2' : '#fff'} />
      {extra}
    </View>
  );
}

function Item({ icon, value, valueColor = '#fff' }: { icon: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.item}>
      <Text style={[styles.value, { color: valueColor }]}>
        {icon} {value}
      </Text>
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
  item: { flexDirection: 'row', alignItems: 'center' },
  label: { color: '#FFE0B2', fontSize: 11, fontWeight: '600' },
  value: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
