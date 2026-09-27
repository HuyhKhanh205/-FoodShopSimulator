import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Hud from '../../components/Hud';
import HelpButton from '../../components/kid/HelpButton';
import IconTile from '../../components/kid/IconTile';
import { Button, colors } from '../../components/ui';
import { INGREDIENTS, RECIPES, CLOSE_HOUR, DAY_MS, OPEN_HOUR } from '../../game/data';
import { buy, discardExpired, openShop, payDebt, returnToShop, returnableQty, shopClosed, unbuy } from '../../game/engine';
import { useGame, useGameState } from '../../game/GameContext';
import { expiredQty, formatMoney, usableQty, formatClock } from '../../game/helpers';
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
  // Đi chợ giữa giờ bán: đồng hồ vẫn chạy, quán có thể đang treo biển tạm đóng.
  const midday = game.phase === 'open' && Boolean(game.run?.ownerAway);
  const closed = midday && shopClosed(game);
  const waiting = game.run?.customers.length ?? 0;
  const [showDebt, setShowDebt] = useState(false);

  const menuTiles = (
    <View style={styles.tiles}>
      {game.unlockedRecipes.map((id) => {
        const r = RECIPES[id];
        const n = portionsFromStock(game, id);
        return <IconTile key={id} size="sm" icon={r.emoji} name={`${r.name}: đủ ${n} phần`} badge={n} style={n === 0 ? styles.tileEmpty : undefined} />;
      })}
    </View>
  );

  return (
    <View style={styles.flex}>
      <Hud game={game} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headRow}>
          <Text style={styles.heading}>{midday ? '🛒 Chợ' : `☀️ Chợ · ngày ${game.day}`}</Text>
          <HelpButton topic="market" />
        </View>
        {midday && (
          <View style={[styles.banner, closed ? styles.bannerClosed : styles.bannerOpen]}>
            <Text style={styles.bannerTitle}>
              🕐 {formatClock(game.run!.elapsed, DAY_MS, OPEN_HOUR, CLOSE_HOUR)} · {closed ? '🚪 Quán đóng tạm' : '👥 Có người trông quán'}
              {waiting ? ` · 🪑 ${waiting}` : ''}
            </Text>
            <IconTile icon="🏃" label="Về quán" tone="primary" onPress={() => act((s) => returnToShop(s))} style={{ alignSelf: 'flex-start' }} />
          </View>
        )}
        {!midday && game.day <= 3 && (
          <View style={styles.intro} accessibilityLabel="Ngày làm quen: khách ít, không có sự cố">
            <Text style={styles.introText}>🐣 Ngày làm quen {game.day}/3 · 👤 {game.day === 1 ? '·' : game.day === 2 ? '··' : '···'}</Text>
          </View>
        )}
        {game.mods.labels.length > 0 && (
          <View style={styles.tags}>
            {game.mods.labels.map((l) => (
              <Text key={l} style={styles.tag}>
                {l}
              </Text>
            ))}
          </View>
        )}

        {/* Món hôm nay: số trên hình = số bát nấu được */}
        {menuTiles}

        {/* Thẻ nguyên liệu */}
        <View style={styles.cards}>
          {ingredientIds.map((id) => {
            const ing = INGREDIENTS[id];
            const price = game.prices[id];
            const unavailable = game.mods.unavailable.includes(id);
            const pricey = price > ing.basePrice * 1.15;
            const cheap = price < ing.basePrice * 0.9;
            const stock = usableQty(game, id);
            return (
              <View key={id} style={[styles.card, wide && styles.cardWide]} accessibilityLabel={ing.name}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardEmoji}>{ing.emoji}</Text>
                  {ing.needsPrep && <Text style={styles.prepMark}>🔪</Text>}
                  <View style={[styles.stock, stock === 0 && styles.stockEmpty]}>
                    <Text style={styles.stockText}>📦 {stock}</Text>
                  </View>
                </View>
                <Text style={[styles.price, pricey && { color: colors.bad }, cheap && { color: colors.good }]} numberOfLines={1}>
                  {unavailable ? '🚫' : formatMoney(price)}
                  {pricey && !unavailable ? ' ↑' : cheap ? ' ↓' : ''}
                </Text>
                <View style={styles.buyBtns}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Bớt 1 ${ing.name}`}
                    disabled={returnableQty(game, id) === 0}
                    onPress={() => act((s) => void unbuy(s, id, 1))}
                    style={({ pressed }) => [styles.buy, styles.buyLess, returnableQty(game, id) === 0 && { opacity: 0.3 }, pressed && { transform: [{ scale: 0.94 }] }]}
                  >
                    <Text style={styles.buyText}>−</Text>
                  </Pressable>
                  {[1, 5].map((q) => (
                    <Pressable
                      key={q}
                      accessibilityRole="button"
                      accessibilityLabel={`Mua ${q} ${ing.name}`}
                      disabled={unavailable || game.money < price * q}
                      onPress={() => act((s) => void buy(s, id, q))}
                      style={({ pressed }) => [styles.buy, q === 5 && styles.buyMore, (unavailable || game.money < price * q) && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.94 }] }]}
                    >
                      <Text style={[styles.buyText, q === 5 && { color: '#fff' }]}>+{q}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {!midday && (
          <View style={styles.tiles}>
            {expired > 0 && (
              <IconTile icon="🗑️" label="Đồ hỏng" name="Vứt đồ hỏng" badge={expired} tone="danger" onPress={() => act((s) => discardExpired(s))} />
            )}
            <IconTile
              icon="💳"
              label={game.debt > 0 ? formatMoney(game.debt) : '🎉'}
              name="Khoản vay"
              sub={game.debt > 0 ? `📅 ${game.debtDueDay}` : undefined}
              selected={showDebt}
              onPress={() => setShowDebt((v) => !v)}
            />
            <IconTile icon="👥" label="Người giúp" name="Nhân viên" badge={game.staff.length} onPress={() => navigation.navigate('Staff')} />
            <IconTile icon="🔧" label="Nâng cấp" name="Nâng cấp" onPress={() => navigation.navigate('Upgrades')} />
            <IconTile icon="🧑‍🍳" label="Chủ quán" name="Nhân vật" onPress={() => navigation.navigate('Character')} />
            <IconTile icon="🏠" label="Menu" name="Về menu" onPress={() => navigation.navigate('Home')} />
          </View>
        )}
        {!midday && showDebt && (
          <View style={styles.debtBox}>
            <Text style={styles.debtText}>
              💳 {formatMoney(game.debt)} · 📅 {game.debtDueDay}
            </Text>
            <View style={styles.inline}>
              <Button small label="Trả 500.000đ" disabled={game.debt <= 0 || game.money < 500_000} onPress={() => act((s) => payDebt(s, 500_000))} />
              <Button small variant="secondary" label="Trả hết có thể" disabled={game.debt <= 0 || game.money <= 0} onPress={() => act((s) => payDebt(s, s.money))} />
            </View>
          </View>
        )}
        {!midday && (
          <IconTile
            icon="🏮"
            label="Mở cửa"
            name="Mở cửa bán hàng"
            size="lg"
            tone="primary"
            onPress={() => act((s, rng) => openShop(s, rng))}
            disabled={Boolean(game.activeEvent)}
            style={styles.openBtn}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 12, paddingBottom: 40, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 22, fontWeight: '900', color: colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: colors.warnBg, color: colors.primaryDark, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontWeight: '700', overflow: 'hidden' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 6 },
  tileEmpty: { backgroundColor: '#FFEBEE' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    padding: 10,
    gap: 6,
  },
  cardWide: { width: 170, flexGrow: 0 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardEmoji: { fontSize: 40 },
  prepMark: { fontSize: 16, marginTop: -18 },
  stock: { marginLeft: 'auto', backgroundColor: colors.goodBg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  stockEmpty: { backgroundColor: colors.badBg },
  stockText: { fontWeight: '900', color: colors.text, fontSize: 15 },
  price: { fontWeight: '800', color: colors.muted, fontSize: 13 },
  buyBtns: { flexDirection: 'row', gap: 8 },
  buy: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.warnBg,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyLess: { backgroundColor: '#fff', borderColor: colors.border },
  intro: { backgroundColor: '#FFF8E1', borderRadius: 14, borderWidth: 2, borderColor: colors.accent, padding: 10 },
  introText: { fontSize: 17, fontWeight: '900', color: colors.primaryDark },
  buyMore: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  buyText: { fontSize: 20, fontWeight: '900', color: colors.primaryDark },
  inline: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  debtBox: { backgroundColor: '#fff', borderRadius: 16, padding: 12, gap: 8, borderWidth: 1, borderColor: colors.border },
  debtText: { fontSize: 18, fontWeight: '900', color: colors.text },
  openBtn: { alignSelf: 'stretch', minHeight: 100 },
  banner: { borderRadius: 16, padding: 14, gap: 8, borderWidth: 2 },
  bannerClosed: { backgroundColor: colors.badBg, borderColor: colors.bad },
  bannerOpen: { backgroundColor: colors.goodBg, borderColor: colors.good },
  bannerTitle: { fontSize: 17, fontWeight: '900', color: colors.text },
});
