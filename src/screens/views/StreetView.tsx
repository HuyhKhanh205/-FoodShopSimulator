import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DebtPanel from '../../components/DebtPanel';
import Hud from '../../components/Hud';
import IconTile from '../../components/kid/IconTile';
import NextButton from '../../components/kid/NextButton';
import StreetScene3D from '../../components/street/StreetScene3D';
import { Button, colors } from '../../components/ui';
import { CLOSE_HOUR, DAY_MS, OPEN_HOUR } from '../../game/data';
import { shopClosed, streetGo } from '../../game/engine';
import { useGame, useGameState } from '../../game/GameContext';
import { formatClock } from '../../game/helpers';
import { STREET_PLACES } from '../../game/street';
import type { StreetPlaceId } from '../../game/street';
import { hasWebGL } from '../../three/webgl';

const INTRO = '🏘️ Khu phố đây con! 🍜 Quán mình · 🛒 Chợ · 🏠 Nhà chú (thử món) · 🏪 Tiệm đồ quán (nâng cấp) · 🏦 Ngân hàng (trả nợ). Chạm nhà nào là đi tới nhà đó!';

/**
 * 🏘️ Khu phố: đi bộ giữa 5 nơi. Giờ bán thì đồng hồ vẫn chạy như lúc đi chợ
 * (có nhân viên trông quán, không thì quán treo biển tạm đóng).
 */
export default function StreetView() {
  const navigation = useNavigation();
  const game = useGameState();
  const { act, sceneMode } = useGame();
  const { width, height } = useWindowDimensions();
  const [bank, setBank] = useState(false);
  const [walkTo, setWalkTo] = useState<{ id: StreetPlaceId; seq: number } | null>(null);
  const has3D = useMemo(hasWebGL, []);
  const simple = !has3D || sceneMode === 'simple';
  const from = game.streetFrom ?? 'shop';
  const open = game.phase === 'open';
  const closed = open && shopClosed(game);

  // Lần đầu ra phố: Chú Tư giới thiệu 5 nơi.
  useEffect(() => {
    if (!game.flags?.streetIntro) {
      act((s) => {
        s.flags = { ...(s.flags ?? {}), streetIntro: s.day };
        s.chefQueue.push({ kind: 'news', text: INTRO });
      });
    }
  }, [game.flags?.streetIntro, act]);

  const enter = (id: StreetPlaceId) => {
    if (id === 'shop' || id === 'market') act((s) => streetGo(s, id));
    else if (id === 'uncle') navigation.navigate('Lab' as never);
    else if (id === 'tools') navigation.navigate('Upgrades' as never);
    else setBank(true);
  };

  // Nhãn gợi ý: giờ bán thì về quán, chưa mở cửa thì ra chợ mua đồ.
  const goal: StreetPlaceId = open ? 'shop' : 'market';
  const goalPlace = STREET_PLACES.find((p) => p.id === goal)!;
  const sceneH = Math.max(260, height - 310);
  return (
    <View style={styles.flex}>
      <Hud game={game} />
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>
          🏘️ Khu phố
        </Text>
        {open && game.run && (
          <Text style={[styles.status, closed ? styles.closed : styles.ok]} numberOfLines={1}>
            🕐 {formatClock(game.run.elapsed, DAY_MS, OPEN_HOUR, CLOSE_HOUR)} · {closed ? '🚪 Quán tạm đóng' : '👥 Có người trông quán'}
          </Text>
        )}
      </View>
      <NextButton label={`${goalPlace.emoji} ${goalPlace.verb}`} style={{ marginBottom: 6 }} />
      {!simple && (
        <View style={styles.places}>
          {STREET_PLACES.map((p) => (
            <Pressable key={p.id} onPress={() => setWalkTo({ id: p.id, seq: Date.now() })} style={styles.place} accessibilityRole="button" accessibilityLabel={`Đi tới ${p.name}`}>
              <Text style={styles.placeIcon}>{p.emoji}</Text>
              <Text style={styles.placeName} numberOfLines={1}>
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {simple ? (
        <View style={styles.grid}>
          {STREET_PLACES.map((p) => (
            <IconTile key={p.id} icon={p.emoji} label={p.name} name={`${p.name}: ${p.verb}`} sub={p.verb} size="lg" onPress={() => enter(p.id)} />
          ))}
        </View>
      ) : (
        <StreetScene3D game={game} from={from} width={width} height={sceneH} onEnter={enter} walkTo={walkTo} guide={goal} />
      )}
      {/* Đi tắt: về quán / vào chợ */}
      <View style={styles.bar}>
        <Pressable onPress={() => enter('shop')} style={styles.round} accessibilityRole="button" accessibilityLabel="Về quán">
          <Text style={styles.roundIcon}>🍜</Text>
          <Text style={styles.roundLabel}>Về quán</Text>
        </Pressable>
        <Pressable onPress={() => enter('market')} style={styles.round} accessibilityRole="button" accessibilityLabel="Vào chợ">
          <Text style={styles.roundIcon}>🛒</Text>
          <Text style={styles.roundLabel}>Chợ</Text>
        </Pressable>
      </View>
      {bank && (
        <Modal transparent animationType="none" visible onRequestClose={() => setBank(false)}>
          <Pressable style={styles.backdrop} onPress={() => setBank(false)}>
            <Pressable style={styles.card} onPress={() => {}} accessibilityLabel="Ngân hàng">
              <Text style={styles.cardEmoji}>🏦</Text>
              <Text style={styles.cardTitle}>Ngân hàng</Text>
              <DebtPanel big />
              <Button label="👋 Ra phố" variant="secondary" onPress={() => setBank(false)} />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#CFE8F0' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  title: { fontSize: 20, fontWeight: '900', color: colors.brown },
  status: { flex: 1, fontSize: 12, fontWeight: '800', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', textAlign: 'right' },
  closed: { backgroundColor: colors.badBg, color: colors.bad },
  ok: { backgroundColor: colors.goodBg, color: colors.good },
  places: { flexDirection: 'row', gap: 6, paddingHorizontal: 8, paddingBottom: 6 },
  place: { flex: 1, alignItems: 'center', backgroundColor: colors.cream, borderRadius: 12, paddingVertical: 4, borderWidth: 2, borderColor: colors.chunkyShadow },
  placeIcon: { fontSize: 18 },
  placeName: { fontSize: 10, fontWeight: '800', color: colors.brown },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16, justifyContent: 'center', alignContent: 'center' },
  bar: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 6 },
  round: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 4 },
  roundIcon: { fontSize: 20, lineHeight: 22 },
  roundLabel: { fontSize: 10, fontWeight: '900', color: colors.brown },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, width: '100%', maxWidth: 420, gap: 10, alignItems: 'stretch' },
  cardEmoji: { fontSize: 48, textAlign: 'center' },
  cardTitle: { fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'center' },
});
