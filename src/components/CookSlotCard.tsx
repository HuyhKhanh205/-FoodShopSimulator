import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { burnGrace, RECIPES } from '../game/data';
import type { CookSlot, Staff } from '../game/types';
import { Button, ProgressBar, colors } from './ui';

export default function CookSlotCard({
  slot,
  index,
  blocked,
  staff,
  onTakeOut,
}: {
  slot: CookSlot;
  index: number;
  blocked: boolean;
  staff: Staff[];
  onTakeOut: () => void;
}) {
  const title = slot.station === 'stove' ? `🔥 Bếp ${index + 1}` : `🥤 Quầy ${index + 1}`;
  const job = slot.job;
  if (!job) {
    return (
      <View style={[styles.card, styles.empty]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.muted}>{blocked ? '⛔ Không dùng được' : 'Trống'}</Text>
      </View>
    );
  }
  const r = RECIPES[job.recipeId];
  const done = job.progress >= job.cookTime;
  const burnRatio = (job.progress - job.cookTime) / burnGrace(job.cookTime);
  const byStaff = job.by !== 'player' ? staff.find((s) => s.id === job.by) : undefined;

  let status = 'Đang nấu...';
  let color: string = colors.accent;
  if (done && r.burns) {
    status = burnRatio > 0.5 ? '⚠️ Sắp cháy!' : '✅ Chín rồi!';
    color = burnRatio > 0.5 ? colors.bad : colors.good;
  }
  const progress = done && r.burns ? 1 - burnRatio : job.progress / job.cookTime;

  return (
    <View style={[styles.card, done && r.burns && { borderColor: color }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.dish}>
        {r.emoji} {r.name}
        {job.noGarnish ? ' 🚫hành' : ''}
      </Text>
      <Text style={[styles.status, { color }]}>{blocked && slot.station === 'stove' ? '⛔ Tạm dừng' : status}</Text>
      <ProgressBar value={progress} color={color} height={6} style={{ marginVertical: 6 }} />
      {byStaff ? (
        <Text style={styles.muted}>👨‍🍳 {byStaff.name} phụ trách</Text>
      ) : (
        <Button small label={done ? 'Nhấc ra' : 'Nhấc sớm (sống)'} variant={done ? 'primary' : 'secondary'} onPress={onTakeOut} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 8,
    width: 150,
    minHeight: 120,
  },
  empty: { borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  title: { fontWeight: '800', color: colors.text, fontSize: 13 },
  dish: { color: colors.text, marginTop: 4 },
  status: { fontWeight: '700', fontSize: 12, marginTop: 2 },
  muted: { color: colors.muted, fontSize: 12 },
});
