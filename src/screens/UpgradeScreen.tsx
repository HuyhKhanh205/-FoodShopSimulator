import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import HelpButton from '../components/kid/HelpButton';
import { Button, Panel, colors } from '../components/ui';
import { INGREDIENTS, RECIPES, RECIPE_IDS, UPGRADES } from '../game/data';
import { buyUpgrade, upgradeInfo } from '../game/engine';
import { useGame } from '../game/GameContext';
import { formatMoney } from '../game/helpers';
import type { IngredientId } from '../game/types';

export default function UpgradeScreen() {
  const navigation = useNavigation();
  const { game, act } = useGame();
  if (!game) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Button small variant="ghost" label="⬅" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>🔧</Text>
        <Text style={styles.money}>💰 {formatMoney(game.money)}</Text>
        <HelpButton topic="upgrades" />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Panel title="🏠">
          {UPGRADES.map((u) => {
            const { level, next, cost } = upgradeInfo(game, u.key);
            return (
              <View key={u.key} style={styles.row}>
                <Text style={styles.emoji}>{u.emoji}</Text>
                <View style={styles.flex}>
                  <Text style={styles.name}>{u.name}</Text>
                  <Text style={styles.muted}>
                    {u.describe(level)}
                    {next !== undefined ? `  ➡  ${u.describe(next)}` : ''}
                  </Text>
                </View>
                {next !== undefined && cost !== undefined ? (
                  <Button small label={formatMoney(cost)} disabled={game.money < cost} onPress={() => act((s) => void buyUpgrade(s, u.key))} />
                ) : (
                  <Text style={styles.max}>⭐ MAX</Text>
                )}
              </View>
            );
          })}
        </Panel>

        <Panel title="📖">
          <View style={styles.row}>
            <Text style={styles.emoji}>🧪</Text>
            <View style={styles.flex}>
              <Text style={styles.name}>Bếp thử món</Text>
              <Text style={styles.ingr}>{game.unlockedRecipes.map((id) => RECIPES[id].emoji).join(' ')}</Text>
            </View>
            <Button small label="🧪 Thử món" onPress={() => navigation.navigate('Lab')} />
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
  content: { padding: 12, paddingBottom: 40, maxWidth: 760, width: '100%', alignSelf: 'center' },
  ingr: { fontSize: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F7EDE2' },
  emoji: { fontSize: 28, width: 36, textAlign: 'center' },
  flex: { flex: 1 },
  name: { fontWeight: '800', color: colors.text },
  muted: { color: colors.muted, fontSize: 12 },
  next: { color: colors.good, fontSize: 12, fontWeight: '600' },
  max: { color: colors.muted, fontWeight: '700' },
});
