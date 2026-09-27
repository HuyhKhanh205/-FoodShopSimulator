import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { INGREDIENTS, RECIPES } from '../../game/data';
import { DISH_KIND_LABEL, resolveCombo } from '../../game/dishes';
import { playerCookCombo } from '../../game/engine';
import type { GameMutation } from '../../game/GameContext';
import { usableQty } from '../../game/helpers';
import { unlockedIngredients } from '../../game/progression';
import { trendHeat } from '../../game/trend';
import type { GameState, IngredientId, Station } from '../../game/types';
import IconTile from '../kid/IconTile';
import TutorialGlow from '../kid/TutorialGlow';
import { colors } from '../ui';

const MAX_POT = 4;

/** Nguyên liệu có sẵn để bỏ vào nồi (đồ cần sơ chế thì phải có phần đã thái). */
function available(s: GameState, id: IngredientId): number {
  return INGREDIENTS[id].needsPrep ? s.run?.prepped[id] ?? 0 : usableQty(s, id);
}

/**
 * Nồi tự chọn: chạm nguyên liệu để bỏ vào (tối đa 4), xem trước món sẽ ra rồi bấm 🔥 Nấu.
 * Ô món trong menu = điền nhanh đủ nguyên liệu. Bỏ 🧅 ra = món "không hành".
 */
export default function PotBuilder({
  game,
  station,
  slotId,
  act,
  targets,
}: {
  game: GameState;
  station: Station;
  slotId: string;
  act: (fn: GameMutation) => void;
  targets: string[];
}) {
  const [pot, setPot] = useState<IngredientId[]>([]);
  const [error, setError] = useState<string | null>(null);
  const toggle = (id: IngredientId) => {
    setError(null);
    setPot((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_POT ? p : [...p, id]));
  };
  const menu = game.unlockedRecipes.map((id) => RECIPES[id]).filter((r) => r && r.station === station);
  const preview = pot.length ? resolveCombo(game, pot) : null;
  const missing = pot.filter((i) => available(game, i) < 1);
  const wrongStation = preview && preview.recipe.station !== station;
  const inMenu = preview ? game.unlockedRecipes.includes(preview.recipe.id) : false;
  const kind = preview?.recipe.kind ?? 'chuan';
  const cook = () => {
    // Kiểm tra trên bản sao để báo lỗi ngay, rồi áp dụng thật.
    const err = playerCookCombo(JSON.parse(JSON.stringify(game)), pot, slotId);
    if (err) {
      setError(err);
      return;
    }
    const chosen = [...pot];
    act((s) => void playerCookCombo(s, chosen, slotId));
    setPot([]);
  };

  return (
    <View style={{ gap: 8 }}>
      {/* Nồi + xem trước */}
      <View style={styles.potRow}>
        <View style={styles.pot}>
          {Array.from({ length: MAX_POT }, (_, i) => {
            const id = pot[i];
            return (
              <Pressable
                key={i}
                onPress={() => id && toggle(id)}
                style={[styles.slot, id && styles.slotFull, id && missing.includes(id) && styles.slotMissing]}
                accessibilityRole="button"
                accessibilityLabel={id ? `Lấy ra ${INGREDIENTS[id].name}` : 'Ô nồi trống'}
              >
                <Text style={styles.slotText}>{id ? INGREDIENTS[id].emoji : '＋'}</Text>
              </Pressable>
            );
          })}
        </View>
        <TutorialGlow on={targets.includes('kitchen.cook') && pot.length > 0} radius={16}>
          <IconTile
            icon="🔥"
            label="Nấu"
            name="Nấu nồi này"
            tone="primary"
            disabled={!preview || missing.length > 0 || Boolean(wrongStation)}
            onPress={cook}
          />
        </TutorialGlow>
      </View>
      {preview && (
        <View style={[styles.preview, kind === 'quai_di' && styles.previewMonster]} accessibilityLabel={`Sẽ ra món ${preview.recipe.name}`}>
          <Text style={styles.previewEmoji}>{preview.recipe.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewName} numberOfLines={1}>
              {preview.recipe.name}
              {preview.noGarnish ? ' 🚫🧅' : ''}
              {trendHeat(game, preview.recipe.id) > 0 ? ' 🔥' : ''}
            </Text>
            <Text style={styles.previewSub}>
              {DISH_KIND_LABEL[kind]} · {inMenu ? '✅ có trong menu' : '⚠️ chưa có trong menu'}
              {missing.length ? ` · thiếu ${missing.map((m) => INGREDIENTS[m].emoji + (INGREDIENTS[m].needsPrep ? '🔪' : '')).join('')}` : ''}
              {wrongStation ? (preview.recipe.station === 'counter' ? ' · 🧋 làm ở quầy' : ' · 🔥 nấu trên bếp') : ''}
            </Text>
          </View>
        </View>
      )}
      {error && <Text style={styles.error}>⚠️ {error}</Text>}
      {/* Món trong menu: điền nhanh */}
      <View style={styles.wrap}>
        {menu.map((r) => (
          <TutorialGlow key={r.id} on={targets.includes(`kitchen.recipe:${r.id}`) && pot.length === 0}>
            <IconTile
              icon={r.emoji}
              name={`${r.name} (bỏ vào nồi)`}
              size="sm"
              badge={trendHeat(game, r.id) > 0 ? '🔥' : undefined}
              onPress={() => {
                setError(null);
                setPot(Object.keys(r.ingredients) as IngredientId[]);
              }}
            />
          </TutorialGlow>
        ))}
      </View>
      {/* Nguyên liệu bỏ vào nồi */}
      <View style={styles.wrap}>
        {unlockedIngredients(game).map((id) => {
          const n = available(game, id);
          return (
            <IconTile
              key={id}
              icon={INGREDIENTS[id].emoji}
              name={`Bỏ ${INGREDIENTS[id].name} vào nồi`}
              size="sm"
              sub={INGREDIENTS[id].needsPrep ? `🔪${n}` : `📦${n}`}
              selected={pot.includes(id)}
              disabled={n < 1 && !pot.includes(id)}
              onPress={() => toggle(id)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  potRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pot: { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: '#5D4037', borderRadius: 18, padding: 8, justifyContent: 'center' },
  slot: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFull: { backgroundColor: '#FFF3E0', borderStyle: 'solid', borderColor: colors.accent },
  slotMissing: { borderColor: colors.bad, opacity: 0.6 },
  slotText: { fontSize: 24, color: '#fff' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.goodBg, borderRadius: 14, padding: 8 },
  previewMonster: { backgroundColor: '#F3E5F5' },
  previewEmoji: { fontSize: 30 },
  previewName: { fontSize: 15, fontWeight: '900', color: colors.text },
  previewSub: { fontSize: 12, fontWeight: '700', color: colors.muted },
  error: { color: colors.bad, fontWeight: '800' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 6 },
});
