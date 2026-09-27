import React from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Hud from '../../components/Hud';
import { Button, Panel, colors } from '../../components/ui';
import { INGREDIENTS, RECIPES } from '../../game/data';
import { buy, discardExpired, openShop, payDebt } from '../../game/engine';
import { useGame, useGameState } from '../../game/GameContext';
import { expiredQty, formatMoney, usableQty } from '../../game/helpers';
import type { GameState, IngredientId } from '../../game/types';

/** Số phần tối đa nấu được từ kho hiện tại (chưa tính sơ chế). */
function portionsFromStock(s: GameState, recipeId: keyof typeof RECIPES) {
  const r = RECIPES[recipeId];
  return Math.min(
    ...(Object.entries(r.ingredients) as [IngredientId, number][]).map(([id, q]) => Math.floor(usableQty(s, id) / q))
  );
}

export default function MarketView() {
  const navigation = useNavigation();
  const game = useGameState();
  const { act } = useGame();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  // Nguyên liệu dùng cho thực đơn hiện tại lên trước.
  const used = new Set<IngredientId>();
  for (const id of game.unlockedRecipes) for (const ing of Object.keys(RECIPES[id].ingredients)) used.add(ing as IngredientId);
  const ingredientIds = (Object.keys(INGREDIENTS) as IngredientId[]).filter((id) => used.has(id));

  const expired = expiredQty(game);

  return (
    <View style={styles.flex}>
      <Hud game={game} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>☀️ {game.profile.shopName} · sáng ngày {game.day}</Text>
        {game.mods.labels.length > 0 && (
          <View style={styles.tags}>
            {game.mods.labels.map((l) => (
              <Text key={l} style={styles.tag}>
                {l}
              </Text>
            ))}
          </View>
        )}

        <View style={[styles.columns, wide && styles.columnsWide]}>
          <View style={wide ? styles.colMain : undefined}>
            <Panel title="🛒 Chợ nguyên liệu" right={<Text style={styles.muted}>giá / phần</Text>}>
              {ingredientIds.map((id) => {
                const ing = INGREDIENTS[id];
                const price = game.prices[id];
                const unavailable = game.mods.unavailable.includes(id);
                const pricey = price > ing.basePrice * 1.15;
                const cheap = price < ing.basePrice * 0.9;
                const shelf = ing.shelfLife + (ing.perishable ? game.upgrades.fridge : 0);
                return (
                  <View key={id} style={styles.row}>
                    <Text style={styles.emoji}>{ing.emoji}</Text>
                    <View style={styles.flex}>
                      <Text style={styles.name}>
                        {ing.name} {ing.needsPrep ? <Text style={styles.prepTag}>cần sơ chế</Text> : null}
                      </Text>
                      <Text style={styles.muted}>
                        Kho: {usableQty(game, id)} · để được {shelf >= 30 ? 'lâu' : `${shelf} ngày`}
                      </Text>
                    </View>
                    <Text style={[styles.price, pricey && { color: colors.bad }, cheap && { color: colors.good }]}>
                      {unavailable ? 'Hết hàng' : formatMoney(price)}
                      {pricey && !unavailable ? ' ↑' : cheap ? ' ↓' : ''}
                    </Text>
                    <View style={styles.buyBtns}>
                      {[1, 5, 10].map((q) => (
                        <Button
                          key={q}
                          small
                          variant="secondary"
                          label={`+${q}`}
                          disabled={unavailable || game.money < price * q}
                          onPress={() => act((s) => void buy(s, id, q))}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </Panel>
          </View>

          <View style={wide ? styles.colSide : undefined}>
            <Panel title="📋 Thực đơn hôm nay">
              {game.unlockedRecipes.map((id) => {
                const r = RECIPES[id];
                const n = portionsFromStock(game, id);
                return (
                  <View key={id} style={styles.menuRow}>
                    <Text style={styles.name}>
                      {r.emoji} {r.name}
                    </Text>
                    <Text style={[styles.menuCount, n === 0 && { color: colors.bad }]}>đủ {n} phần</Text>
                  </View>
                );
              })}
              <Text style={[styles.muted, { marginTop: 6 }]}>Mẹo: giờ trưa và tối rất đông. Mua dư một chút nhưng đồ tươi sẽ hỏng nhanh!</Text>
            </Panel>

            {expired > 0 && (
              <Panel title="🦠 Đồ hết hạn" style={{ backgroundColor: colors.badBg }}>
                <Text style={styles.p}>Có {expired} phần nguyên liệu đã hỏng. Thanh tra thấy là phạt nặng!</Text>
                <Button label="🗑️ Vứt đồ hỏng" variant="danger" onPress={() => act((s) => discardExpired(s))} />
              </Panel>
            )}

            <Panel title="💳 Khoản vay">
              <Text style={styles.p}>
                Còn nợ {formatMoney(game.debt)} — hạn chót cuối ngày {game.debtDueDay}.
              </Text>
              <View style={styles.inline}>
                <Button small label="Trả 500.000đ" disabled={game.debt <= 0 || game.money < 500_000} onPress={() => act((s) => payDebt(s, 500_000))} />
                <Button small variant="secondary" label="Trả tối đa" disabled={game.debt <= 0 || game.money <= 0} onPress={() => act((s) => payDebt(s, s.money))} />
              </View>
            </Panel>

            <View style={styles.navBtns}>
              <Button variant="secondary" label={`👥 Nhân viên (${game.staff.length})`} onPress={() => navigation.navigate('Staff')} />
              <Button variant="secondary" label="🔧 Nâng cấp & công thức" onPress={() => navigation.navigate('Upgrades')} />
              <Button variant="secondary" label={`🧑‍🍳 Nhân vật: ${game.profile.name}`} onPress={() => navigation.navigate('Character')} />
              <Button label="🏮 Mở cửa bán hàng" onPress={() => act((s, rng) => openShop(s, rng))} disabled={Boolean(game.activeEvent)} />
              <Button variant="ghost" label="🏠 Về menu (đã tự lưu)" onPress={() => navigation.navigate('Home')} />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 12, paddingBottom: 40 },
  heading: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag: { backgroundColor: colors.warnBg, color: colors.primaryDark, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontWeight: '700', overflow: 'hidden' },
  columns: { gap: 12 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  colMain: { flex: 3 },
  colSide: { flex: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F7EDE2', gap: 8 },
  emoji: { fontSize: 24, width: 32, textAlign: 'center' },
  name: { fontWeight: '700', color: colors.text },
  prepTag: { fontSize: 11, color: colors.info, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 12 },
  price: { fontWeight: '700', color: colors.text, minWidth: 70, textAlign: 'right' },
  buyBtns: { flexDirection: 'row', gap: 4 },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  menuCount: { fontWeight: '700', color: colors.good },
  p: { color: colors.text, marginBottom: 8 },
  inline: { flexDirection: 'row', gap: 8 },
  navBtns: { gap: 8 },
});
