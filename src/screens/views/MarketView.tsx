import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Hud from '../../components/Hud';
import HelpButton from '../../components/kid/HelpButton';
import IconTile from '../../components/kid/IconTile';
import TutorialGlow, { useTutorialTargets } from '../../components/kid/TutorialGlow';
import { tutorialUi } from '../../components/kid/tutorialUi';
import NextButton from '../../components/kid/NextButton';
import { dayFlow } from '../../game/dayflow';
import { currentStep } from '../../game/tutorial';
import { basketTotal } from '../../game/market';
import { shows } from '../../game/unlocks';
import { NotebookButton } from '../../components/notebook/NotebookSheet';
import { HudChip, RoundButton, hud } from '../../components/HudBits';
import { Button, ProgressBar, colors } from '../../components/ui';
import { levelOf, levelProgress, mysteryRecipes } from '../../game/progression';
import { trendHeat } from '../../game/trend';
import { RECIPES, CLOSE_HOUR, DAY_MS, OPEN_HOUR } from '../../game/data';
import { discardExpired, goStreet, openShop, returnToShop, shopClosed } from '../../game/engine';
import DebtPanel from '../../components/DebtPanel';
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
  // Cảnh chợ lấp toàn bộ vùng giữa (đo bằng onLayout); mọi thứ khác là lớp nổi nhỏ.
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [more, setMore] = useState(false);
  // Bong bóng Chú Tư (tin, trợ giúp) đứng trên thanh giỏ + cụm nút 🏮 để không che nút.
  useEffect(() => {
    tutorialUi.setBottomInset(118);
    return () => tutorialUi.setBottomInset(0);
  }, []);

  const expired = expiredQty(game);
  // Đi chợ giữa giờ bán: đồng hồ vẫn chạy, quán có thể đang treo biển tạm đóng.
  const midday = game.phase === 'open' && Boolean(game.run?.ownerAway);
  const closed = midday && shopClosed(game);
  const waiting = game.run?.customers.length ?? 0;
  const [showDebt, setShowDebt] = useState(false);
  const targets = useTutorialTargets();
  /** Đã đủ đồ để mở cửa (đường sông gợi ý 🏮) — nút Mở cửa to lên. */
  const ready = !midday && (dayFlow(game).next.target === 'market.open' || targets.includes('market.open'));
  const quick = shows(game, 'quickBuy');
  // Nút 👉 Làm tiếp: mua theo menu → 💳 trả tiền → 🏮 mở cửa (giữa giờ bán: 🏃 về quán).
  // Lúc Chú Tư dẫn đi chào các sạp / mua tay ngày đầu thì ẩn, kẻo lẫn.
  const step = currentStep(game);
  const tutMarket = Boolean(step && (step.id === 'hello' || step.id === 'buy' || step.id === 'buy-hand' || step.id.startsWith('meet-')));
  const units = basketTotal(game, basket).units;
  const meetId = step?.id.startsWith('meet-') ? (step.id.slice(5) as VendorId) : null;
  const nextBtn = (() => {
    if (tutMarket) return null;
    if (midday && units === 0) return { label: '🏃 Về quán', go: () => act((s) => returnToShop(s)) };
    if (units > 0) return { label: `💳 Trả tiền ${formatMoney(basketTotal(game, basket).cost)}`, go: pay };
    if (dayFlow(game).next.target === 'market.open') return { label: '🏮 Mở cửa', go: () => act((s, rng) => openShop(s, rng)) };
    if (quick)
      return {
        label: '🧾 Mua theo menu',
        go: () => {
          setPayError(null);
          setBasket(suggestBasket(game));
        },
      };
    return { label: '🛒 Chạm sạp để mua đồ', go: () => tutorialUi.glow('market.stalls'), off: true };
  })();
  useEffect(() => {
    tutorialUi.setTopInset(nextBtn ? 62 : 0);
    return () => tutorialUi.setTopInset(0);
  }, [Boolean(nextBtn)]);
  // Sáng ngày 2: nút 🧾 Theo menu sáng lên một lần (Chú Tư vừa giới thiệu).
  useEffect(() => {
    if (!quick || midday || game.flags?.quickIntro) return;
    tutorialUi.glow('market.menu', 8000);
    act((s) => {
      s.flags = { ...(s.flags ?? {}), quickIntro: s.day };
    });
  }, [quick, midday, game.flags?.quickIntro, act]);
  // Hướng dẫn mua tay cần biết giỏ + sạp đang mở.
  useEffect(() => {
    tutorialUi.setMarket(basket, stall);
  }, [basket, stall]);
  useEffect(() => () => tutorialUi.setMarket({}, null), []);

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

  const clock = midday ? formatClock(game.run!.elapsed, DAY_MS, OPEN_HOUR, CLOSE_HOUR) : '';
  const moreDot = expired > 0 || mysteryRecipes(game).length > 0;

  return (
    <View style={styles.flex}>
      <View style={styles.flex} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {simple ? (
          <ScrollView contentContainerStyle={styles.gridPad}>
            <StallGrid game={game} onStall={setStall} deals={deals} />
          </ScrollView>
        ) : (
          area.w > 0 && <MarketScene3D game={game} onStall={setStall} width={area.w} height={area.h} insets={{ top: nextBtn ? (midday ? 128 : 114) : 52, bottom: 70 }} meet={meetId} />
        )}

        {/* Góc trên: 1 hàng chip nhỏ + nút tròn; đường sông gợi ý việc tiếp theo ngay dưới */}
        <View pointerEvents="box-none" style={styles.top}>
          <View pointerEvents="box-none" style={styles.topRow}>
            <View pointerEvents="none" style={styles.chips}>
              <HudChip label={`Ngày ${game.day}${shows(game, 'debt') ? `, hạn trả nợ ngày ${game.debtDueDay}` : ''}`}>
                <Text style={hud.chipText}>📅 {shows(game, 'debt') ? `${game.day}/${game.debtDueDay}` : game.day}</Text>
              </HudChip>
              {!midday && game.day <= 3 && (
                <HudChip tone="warn" label={`Ngày làm quen ${game.day} trên 3: khách ít, không có sự cố`}>
                  <Text style={hud.chipText}>🐣 {game.day}/3</Text>
                </HudChip>
              )}
              <HudChip tone={game.money < 0 ? 'bad' : 'plain'} label={`Tiền ${formatMoney(game.money)}`}>
                <Text style={hud.chipText}>💰 {formatMoney(game.money)}</Text>
              </HudChip>
              {midday && (
                <HudChip tone={closed ? 'bad' : 'good'} label={closed ? 'Quán đóng tạm' : 'Có người trông quán'}>
                  <Text style={hud.chipText}>
                    🕐 {clock} · {closed ? '🚪' : '👥'}
                    {waiting ? ` 🪑${waiting}` : ''}
                  </Text>
                </HudChip>
              )}
            </View>
            <View style={styles.buttons}>
              {has3D && shows(game, 'modeToggle') && (
                <RoundButton label={simple ? '🌴' : '🔲'} name={simple ? 'Chợ 3D' : 'Chợ đơn giản'} onPress={() => setSceneMode(simple ? '3d' : 'simple')} />
              )}
              {shows(game, 'notebook') && <NotebookButton game={game} style={[hud.round, styles.nb]} label="" />}
              {!shows(game, 'more') && <RoundButton label="🏠" name="Về menu" onPress={() => navigation.navigate('Home')} />}
              <HelpButton topic="market" />
            </View>
          </View>
          {nextBtn && <NextButton label={nextBtn.label} onPress={nextBtn.go} disabled={Boolean(nextBtn.off)} />}
        </View>

        {/* Góc phải dưới: 🏮 Mở cửa (to khi đã đủ đồ) / 🏃 Về quán, 🚶 Ra phố, 📋 Thêm */}
        <View pointerEvents="box-none" style={styles.cluster}>
          {(shows(game, 'more') || midday) && <RoundButton label="📋" name="Thêm: cấp, món, nhân viên, nâng cấp, nợ" onPress={() => setMore(!more)} active={more} dot={moreDot} />}
          {shows(game, 'street') && <RoundButton label="🚶" name="Ra khu phố" onPress={() => act((s) => goStreet(s, 'market'))} />}
          {midday ? (
            <TutorialGlow on={targets.includes('market.back')} radius={24}>
              <Pressable onPress={() => act((s) => returnToShop(s))} style={[styles.big, styles.bigOn]} accessibilityRole="button" accessibilityLabel="Về quán">
                <Text style={styles.bigText}>🏃 Về quán</Text>
              </Pressable>
            </TutorialGlow>
          ) : (
            <TutorialGlow on={targets.includes('market.open')} radius={24}>
              <Pressable
                onPress={() => act((s, rng) => openShop(s, rng))}
                disabled={Boolean(game.activeEvent || game.eventResult)}
                style={[styles.big, ready && styles.bigOn]}
                accessibilityRole="button"
                accessibilityLabel="Mở cửa bán hàng"
              >
                <Text style={[styles.bigText, !ready && { color: colors.brown }]}>🏮 {ready ? 'Mở cửa!' : 'Mở cửa'}</Text>
              </Pressable>
            </TutorialGlow>
          )}
        </View>

        {/* 📋 Ngăn kéo: mọi thứ phụ (trước đây nằm dưới cảnh chợ) */}
        {more && (
          <View style={[styles.drawer, wide && styles.drawerWide]} accessibilityLabel="Ngăn thêm">
            <View style={styles.drawerHead}>
              <Text style={styles.drawerTitle}>📋 {midday ? 'Chợ' : `Ngày ${game.day}`}</Text>
              <RoundButton label="✕" name="Đóng ngăn thêm" onPress={() => setMore(false)} />
            </View>
            <ScrollView contentContainerStyle={styles.content}>
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
        {shows(game, 'lab') && (
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
        )}

        {/* Món hôm nay: số trên hình = số bát nấu được */}
        {menuTiles}

        {!midday && (
          <View style={styles.tiles}>
            {expired > 0 && (
              <IconTile icon="🗑️" label="Đồ hỏng" name="Vứt đồ hỏng" badge={expired} tone="danger" onPress={() => act((s) => discardExpired(s))} />
            )}
            {shows(game, 'manage') && (
            <IconTile
              icon="💳"
              label={game.debt > 0 ? formatMoney(game.debt) : '🎉'}
              name="Khoản vay"
              sub={game.debt > 0 ? `📅 ${game.debtDueDay}` : undefined}
              selected={showDebt}
              onPress={() => setShowDebt((v) => !v)}
            />
            )}
            {(shows(game, 'staff') || game.staff.length > 0) && (
              <IconTile icon="👥" label="Người giúp" name="Nhân viên" badge={game.staff.length} onPress={() => navigation.navigate('Staff')} />
            )}
            {shows(game, 'manage') && <IconTile icon="🔧" label="Nâng cấp" name="Nâng cấp" onPress={() => navigation.navigate('Upgrades')} />}
            {shows(game, 'manage') && <IconTile icon="🧑‍🍳" label="Chủ quán" name="Nhân vật" onPress={() => navigation.navigate('Character')} />}
            <IconTile icon="🏠" label="Menu" name="Về menu" onPress={() => navigation.navigate('Home')} />
          </View>
        )}
        {!midday && showDebt && <DebtPanel />}
            </ScrollView>
          </View>
        )}
      </View>
      <BasketBar
        game={game}
        basket={basket}
        targets={targets}
        error={payError}
        onMenu={
          quick
            ? () => {
                setPayError(null);
                setBasket(suggestBasket(game));
              }
            : undefined
        }
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
  gridPad: { paddingTop: 110, paddingBottom: 90 },
  top: { position: 'absolute', left: 8, right: 8, top: 6, gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  buttons: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  nb: { paddingHorizontal: 0, paddingVertical: 0 },
  cluster: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  big: { minHeight: 48, borderRadius: 24, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,246,233,0.95)', borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 4 },
  bigOn: { backgroundColor: colors.primary, borderColor: colors.primaryDark, minHeight: 56, paddingHorizontal: 22 },
  bigText: { fontSize: 17, fontWeight: '900', color: '#fff' },
  drawer: { position: 'absolute', left: 6, right: 6, bottom: 6, maxHeight: '64%', backgroundColor: colors.bg, borderRadius: 20, borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 5, overflow: 'hidden' },
  drawerWide: { left: undefined, width: 380, top: 6, maxHeight: undefined },
  drawerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8 },
  drawerTitle: { fontSize: 17, fontWeight: '900', color: colors.brown },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 6, gap: 8 },
  introChip: { fontSize: 13, fontWeight: '900', color: colors.primaryDark, backgroundColor: '#FFF8E1', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.accent, overflow: 'hidden' },
  modeBtn: { backgroundColor: colors.cream, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 2, borderColor: colors.chunkyShadow },
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
