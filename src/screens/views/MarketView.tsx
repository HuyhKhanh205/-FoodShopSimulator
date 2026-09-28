import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Hud from '../../components/Hud';
import HelpButton from '../../components/kid/HelpButton';
import IconTile from '../../components/kid/IconTile';
import TutorialGlow, { useTutorialTargets } from '../../components/kid/TutorialGlow';
import RiverPath from '../../components/kid/RiverPath';
import { NotebookButton } from '../../components/notebook/NotebookSheet';
import { Button, ProgressBar, colors } from '../../components/ui';
import { levelOf, levelProgress, mysteryRecipes } from '../../game/progression';
import { trendHeat } from '../../game/trend';
import { RECIPES, CLOSE_HOUR, DAY_MS, OPEN_HOUR } from '../../game/data';
import { discardExpired, openShop, payDebt, returnToShop, shopClosed } from '../../game/engine';
import { activeDeals, checkout, suggestBasket } from '../../game/market';
import type { Basket, VendorId } from '../../game/market';
import MarketScene3D from '../../components/market/MarketScene3D';
import StallSheet from '../../components/market/StallSheet';
import { BasketBar, StallGrid } from '../../components/market/BasketBar';
import { hasWebGL } from '../../three/webgl';
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
  const { act, sceneMode, setSceneMode } = useGame();
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const level = levelOf(game.xp);
  const has3D = useMemo(hasWebGL, []);
  const simple = !has3D || sceneMode === 'simple';
  // Giỏ hàng (chưa trả tiền) và sạp đang mở.
  const [basket, setBasket] = useState<Basket>({});
  const [stall, setStall] = useState<VendorId | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const deals = activeDeals(game);
  const pay = () => {
    const err = checkout(JSON.parse(JSON.stringify(game)), basket);
    if (err) {
      setPayError(err);
      return;
    }
    const b = basket;
    act((s) => void checkout(s, b));
    setBasket({});
    setPayError(null);
  };
  const sceneW = wide ? Math.min(width - 24, 900) : width;
  const sceneH = Math.round(Math.min(400, height * 0.4));

  const expired = expiredQty(game);
  // Đi chợ giữa giờ bán: đồng hồ vẫn chạy, quán có thể đang treo biển tạm đóng.
  const midday = game.phase === 'open' && Boolean(game.run?.ownerAway);
  const closed = midday && shopClosed(game);
  const waiting = game.run?.customers.length ?? 0;
  const [showDebt, setShowDebt] = useState(false);
  const targets = useTutorialTargets();

  const menuTiles = (
    <View style={styles.tiles}>
      {game.unlockedRecipes.map((id) => {
        const r = RECIPES[id];
        const n = portionsFromStock(game, id);
        return (
          <IconTile
            key={id}
            size="sm"
            icon={r.emoji}
            name={`${r.name}: đủ ${n} phần`}
            badge={trendHeat(game, id) > 0 ? `🔥${n}` : n}
            style={n === 0 ? styles.tileEmpty : undefined}
          />
        );
      })}
    </View>
  );

  return (
    <View style={styles.flex}>
      <Hud game={game} />
      <View style={styles.headRow}>
        <Text style={styles.heading} numberOfLines={1}>
          {midday ? '🛒 Chợ' : `☀️ Ngày ${game.day}`}
        </Text>
        {has3D && (
          <Pressable
            onPress={() => setSceneMode(simple ? '3d' : 'simple')}
            style={styles.modeBtn}
            accessibilityRole="button"
            accessibilityLabel={simple ? 'Chợ 3D' : 'Chợ đơn giản'}
          >
            <Text style={styles.modeText}>{simple ? '🌴 3D' : '🔲 Đơn giản'}</Text>
          </Pressable>
        )}
        <NotebookButton game={game} style={styles.nbBtn} />
        <HelpButton topic="market" />
      </View>
      <RiverPath
        game={game}
        compact
        style={styles.river}
        onGo={(next) => {
          // "Mua theo menu" trên đường sông: điền sẵn giỏ luôn (rồi chỉ vào 💳 Trả tiền).
          if (next.target === 'market.pay') {
            setPayError(null);
            setBasket(suggestBasket(game));
          }
        }}
      />
      {simple ? (
        <StallGrid game={game} onStall={setStall} deals={deals} />
      ) : (
        <View style={{ height: sceneH, alignSelf: 'center' }}>
          <MarketScene3D game={game} onStall={setStall} width={sceneW} height={sceneH} />
        </View>
      )}
      <ScrollView contentContainerStyle={styles.content}>
        {midday && (
          <View style={[styles.banner, closed ? styles.bannerClosed : styles.bannerOpen]}>
            <Text style={styles.bannerTitle}>
              🕐 {formatClock(game.run!.elapsed, DAY_MS, OPEN_HOUR, CLOSE_HOUR)} · {closed ? '🚪 Quán đóng tạm' : '👥 Có người trông quán'}
              {waiting ? ` · 🪑 ${waiting}` : ''}
            </Text>
            <TutorialGlow on={targets.includes('market.back')} style={{ alignSelf: 'flex-start' }}>
              <IconTile icon="🏃" label="Về quán" tone="primary" onPress={() => act((s) => returnToShop(s))} />
            </TutorialGlow>
          </View>
        )}
        {!midday && game.day <= 3 && (
          <View style={styles.intro} accessibilityLabel="Ngày làm quen: khách ít, không có sự cố">
            <Text style={styles.introText}>🐣 Ngày làm quen {game.day}/3 · 👤 {game.day === 1 ? '·' : game.day === 2 ? '··' : '···'}</Text>
          </View>
        )}
        {game.trend && trendHeat(game) > 0 && RECIPES[game.trend.recipeId] && (
          <View style={styles.trend} accessibilityLabel={`Món đang trend: ${RECIPES[game.trend.recipeId].name}`}>
            <Text style={styles.trendText}>
              🔥 Trend: {RECIPES[game.trend.recipeId].emoji} {RECIPES[game.trend.recipeId].name}
            </Text>
            <View style={{ flex: 1 }}>
              <ProgressBar value={trendHeat(game)} color={colors.bad} height={10} />
            </View>
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

        {/* Cấp độ + Bếp thử món */}
        <View style={styles.levelRow}>
          <Text style={styles.levelText}>⭐ {level}</Text>
          <View style={{ flex: 1 }}>
            <ProgressBar value={levelProgress(game.xp)} color={colors.accent} height={10} />
          </View>
          <IconTile
            icon="📖"
            label="Sổ món"
            name="Sổ món và menu"
            size="sm"
            badge={mysteryRecipes(game).length || undefined}
            onPress={() => navigation.navigate('Lab')}
          />
        </View>

        {/* Món hôm nay: số trên hình = số bát nấu được */}
        {menuTiles}

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
          <TutorialGlow on={targets.includes('market.open')} style={{ alignSelf: 'stretch' }}>
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
          </TutorialGlow>
        )}
      </ScrollView>
      <BasketBar
        game={game}
        basket={basket}
        targets={targets}
        error={payError}
        onMenu={() => {
          setPayError(null);
          setBasket(suggestBasket(game));
        }}
        onPay={pay}
        onClear={() => setBasket({})}
      />
      <StallSheet game={game} vendor={stall} basket={basket} setBasket={setBasket} act={act} onClose={() => setStall(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 12, paddingBottom: 40, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 6, gap: 8 },
  modeBtn: { marginLeft: 'auto', backgroundColor: colors.cream, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 2, borderColor: colors.chunkyShadow },
  modeText: { fontWeight: '900', color: colors.brown },
  nbBtn: { backgroundColor: colors.cream, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 2, borderColor: colors.chunkyShadow, flexDirection: 'row', gap: 4 },
  river: { marginHorizontal: 12, marginTop: 6 },
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
  trend: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFEBEE', borderRadius: 14, borderWidth: 2, borderColor: colors.bad, padding: 10 },
  trendText: { fontSize: 16, fontWeight: '900', color: colors.bad },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 6 },
  levelText: { fontSize: 20, fontWeight: '900', color: colors.primaryDark },
  unusedMark: { fontSize: 14, marginTop: -18 },
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
