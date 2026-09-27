import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import HelpButton from '../components/kid/HelpButton';
import IconTile from '../components/kid/IconTile';
import { Button, ProgressBar, colors } from '../components/ui';
import { INGREDIENTS, INGREDIENT_TIER, RECIPES, RECIPE_IDS, recipeLevel } from '../game/data';
import { useGame } from '../game/GameContext';
import { experiment, levelOf, levelProgress, mysteryRecipes, unlockedIngredients } from '../game/progression';
import type { LabResult } from '../game/progression';
import type { IngredientId } from '../game/types';

const MAX_POT = 4;

/**
 * Bếp thử món: chọn 2–4 nguyên liệu bỏ vào nồi thử rồi bấm Nấu thử.
 * Đúng công thức → món mới vào menu; thiếu / thừa một thứ → "gần đúng rồi!".
 */
export default function LabScreen() {
  const navigation = useNavigation();
  const { game, act } = useGame();
  const [pot, setPot] = useState<IngredientId[]>([]);
  const [result, setResult] = useState<LabResult | null>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!result) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, [result, pop]);

  if (!game) return null;
  const level = levelOf(game.xp);
  const ingredients = unlockedIngredients(game);
  const mysteries = mysteryRecipes(game);
  const locked = RECIPE_IDS.filter((id) => recipeLevel(id) > level);

  const toggle = (id: IngredientId) => {
    setResult(null);
    setPot((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_POT ? p : [...p, id]));
  };

  const cook = () => {
    Animated.sequence(
      [8, -8, 6, -6, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 70, useNativeDriver: true }))
    ).start();
    // Tính kết quả trên bản sao để hiện ngay (reducer chạy sau), rồi áp dụng thật.
    const r = experiment(JSON.parse(JSON.stringify(game)), pot);
    const chosen = [...pot];
    act((s) => void experiment(s, chosen));
    setResult(r);
    if (r.kind === 'new' || r.kind === 'known') setPot([]);
  };

  let resultView: React.ReactNode = null;
  if (result) {
    const body =
      result.kind === 'new' ? (
        <>
          <Text style={styles.resultBig}>🎉 {RECIPES[result.recipeId].emoji}</Text>
          <Text style={styles.resultTitle}>{RECIPES[result.recipeId].name}!</Text>
          <Text style={styles.resultText}>✅ Đã thêm vào menu</Text>
        </>
      ) : result.kind === 'known' ? (
        <>
          <Text style={styles.resultBig}>{RECIPES[result.recipeId].emoji}</Text>
          <Text style={styles.resultText}>Món này có trong menu rồi 👍</Text>
        </>
      ) : result.kind === 'near' ? (
        <>
          <Text style={styles.resultBig}>🤏</Text>
          <Text style={styles.resultTitle}>Gần đúng rồi!</Text>
          <Text style={styles.resultText}>Thử thêm hoặc bớt 1 thứ</Text>
        </>
      ) : (
        <>
          <Text style={styles.resultBig}>🤔</Text>
          <Text style={styles.resultText}>Chưa ra món gì, thử cách khác nhé</Text>
        </>
      );
    resultView = (
      <Animated.View
        style={[styles.result, result.kind === 'new' && styles.resultNew, { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}
        accessibilityLabel="Kết quả thử món"
      >
        {body}
      </Animated.View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Button small variant="ghost" label="⬅" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>🧪 Bếp thử món</Text>
        <HelpButton topic="lab" />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Cấp độ */}
        <View style={styles.levelBox}>
          <Text style={styles.levelText}>⭐ Cấp {level}</Text>
          <View style={{ flex: 1 }}>
            <ProgressBar value={levelProgress(game.xp)} color={colors.accent} height={10} />
          </View>
        </View>

        {/* Nồi thử */}
        <Animated.View style={[styles.pot, { transform: [{ translateX: shake }] }]}>
          <Text style={styles.potIcon}>🍲</Text>
          <View style={styles.potItems}>
            {Array.from({ length: MAX_POT }, (_, i) => {
              const id = pot[i];
              return (
                <Pressable
                  key={i}
                  onPress={() => id && toggle(id)}
                  style={[styles.slot, id && styles.slotFull]}
                  accessibilityRole="button"
                  accessibilityLabel={id ? `Bỏ ra ${INGREDIENTS[id].name}` : 'Ô trống'}
                >
                  <Text style={styles.slotText}>{id ? INGREDIENTS[id].emoji : '＋'}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
        <IconTile
          icon="🧪"
          label="Nấu thử"
          name="Nấu thử"
          size="lg"
          tone="primary"
          disabled={pot.length < 2}
          onPress={cook}
          style={styles.cookBtn}
        />
        {resultView}

        {/* Nguyên liệu đã mở khoá */}
        <View style={styles.grid}>
          {ingredients.map((id) => (
            <IconTile
              key={id}
              icon={INGREDIENTS[id].emoji}
              name={INGREDIENTS[id].name}
              size="sm"
              selected={pot.includes(id)}
              badge={INGREDIENT_TIER[id] === level && level > 1 ? 'MỚI' : undefined}
              onPress={() => toggle(id)}
            />
          ))}
        </View>

        {/* Sổ công thức */}
        <Text style={styles.section}>📖</Text>
        <View style={styles.grid}>
          {game.unlockedRecipes.map((id) => (
            <View key={id} style={styles.recipe} accessibilityLabel={`${RECIPES[id].name}: ${Object.keys(RECIPES[id].ingredients).map((i) => INGREDIENTS[i as IngredientId].name).join(', ')}`}>
              <Text style={styles.recipeEmoji}>{RECIPES[id].emoji}</Text>
              <Text style={styles.recipeIngr}>{Object.keys(RECIPES[id].ingredients).map((i) => INGREDIENTS[i as IngredientId].emoji).join('')}</Text>
            </View>
          ))}
          {mysteries.map((id) => {
            const n = Object.keys(RECIPES[id].ingredients).length;
            const shown = (Object.keys(RECIPES[id].ingredients) as IngredientId[]).slice(0, game.labHints[id] ?? 0);
            return (
              <View key={id} style={[styles.recipe, styles.mystery]} accessibilityLabel={`Món bí ẩn: ${n} nguyên liệu`}>
                <Text style={styles.recipeEmoji}>❓</Text>
                <Text style={styles.recipeIngr}>
                  {shown.map((i) => INGREDIENTS[i].emoji).join('')}
                  {'▫️'.repeat(n - shown.length)}
                </Text>
              </View>
            );
          })}
          {locked.length > 0 && (
            <View style={[styles.recipe, styles.locked]} accessibilityLabel={`${locked.length} món mở ở cấp cao hơn`}>
              <Text style={styles.recipeEmoji}>🔒</Text>
              <Text style={styles.recipeIngr}>×{locked.length}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: '900', color: colors.text },
  content: { padding: 14, gap: 14, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' },
  levelBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  levelText: { fontSize: 18, fontWeight: '900', color: colors.primaryDark },
  pot: { backgroundColor: '#5D4037', borderRadius: 24, padding: 14, alignItems: 'center', gap: 8 },
  potIcon: { fontSize: 40 },
  potItems: { flexDirection: 'row', gap: 10 },
  slot: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFull: { backgroundColor: '#FFF3E0', borderStyle: 'solid', borderColor: colors.accent },
  slotText: { fontSize: 28, color: '#fff' },
  cookBtn: { alignSelf: 'stretch', minHeight: 90 },
  result: { backgroundColor: '#fff', borderRadius: 20, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: colors.border },
  resultNew: { borderColor: colors.good, backgroundColor: colors.goodBg },
  resultBig: { fontSize: 52 },
  resultTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
  resultText: { fontSize: 16, fontWeight: '700', color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 6 },
  section: { fontSize: 24, marginTop: 6 },
  recipe: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: colors.border, padding: 8, alignItems: 'center', minWidth: 76 },
  mystery: { borderStyle: 'dashed', backgroundColor: '#FFF8E1' },
  locked: { opacity: 0.5 },
  recipeEmoji: { fontSize: 30 },
  recipeIngr: { fontSize: 14 },
});
