import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KIND_LABEL, RECIPES } from '../game/data';
import type { Customer } from '../game/types';
import { ProgressBar, colors, patienceColor } from './ui';

export default function CustomerCard({ customer, highlight, onPress }: { customer: Customer; highlight: boolean; onPress: () => void }) {
  const ratio = customer.patience / customer.maxPatience;
  const label = KIND_LABEL[customer.kind];
  const mood = ratio > 0.6 ? '🙂' : ratio > 0.3 ? '😐' : '😠';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, highlight && styles.highlight, pressed && { opacity: 0.8 }]}>
      <View style={styles.header}>
        <Text style={styles.avatar}>{customer.emoji}</Text>
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1}>
            {customer.name}
          </Text>
          <Text style={styles.meta}>
            {customer.size > 1 ? `👥 ${customer.size} người` : '1 người'}
            {label ? ` · ${label}` : ''}
          </Text>
        </View>
        <Text style={styles.mood}>{mood}</Text>
      </View>
      <View style={styles.items}>
        {customer.items.map((it, i) => {
          const r = RECIPES[it.recipeId];
          return (
            <View key={i} style={[styles.item, it.served && styles.itemServed]}>
              <Text style={styles.itemText}>
                {it.served ? '✅' : r.emoji} {r.name}
              </Text>
              {it.noGarnish && !it.served && <Text style={styles.note}>🚫 không hành</Text>}
            </View>
          );
        })}
      </View>
      <ProgressBar value={ratio} color={patienceColor(ratio)} height={6} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 10,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: 8,
  },
  highlight: { borderColor: colors.good, backgroundColor: colors.goodBg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  avatar: { fontSize: 26 },
  flex: { flex: 1 },
  name: { fontWeight: '800', color: colors.text },
  meta: { fontSize: 11, color: colors.muted },
  mood: { fontSize: 20 },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  item: { backgroundColor: colors.warnBg, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  itemServed: { backgroundColor: '#EEEEEE' },
  itemText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  note: { fontSize: 10, color: colors.bad, fontWeight: '800' },
});
