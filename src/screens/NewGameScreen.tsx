import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../components/ui';
import { INGREDIENTS, RECIPES, STARTERS } from '../game/data';
import { useGame } from '../game/GameContext';
import { defaultRng, formatMoney } from '../game/helpers';
import { OWNER_NAME_IDEAS, SHOP_NAME_IDEAS, randomIdea } from '../game/profile';
import { loadLook } from '../game/settings';
import type { Appearance } from '../game/settings';
import type { IngredientId, RecipeId } from '../game/types';

/**
 * Chơi mới = setup quán cơ bản (2 bước): ① tên quán + tên chủ (có 🎲 gợi ý), ② món đặc trưng khởi đầu.
 * Ngoại hình lấy từ màn Nhân vật (tách riêng ở màn đầu).
 */
export default function NewGameScreen() {
  const navigation = useNavigation();
  const { startNewGame } = useGame();
  const [step, setStep] = useState<1 | 2>(1);
  const [shopName, setShopName] = useState(() => randomIdea(defaultRng, SHOP_NAME_IDEAS));
  const [name, setName] = useState(() => randomIdea(defaultRng, OWNER_NAME_IDEAS));
  const [starter, setStarter] = useState<RecipeId>(STARTERS[0].id);
  const [look, setLook] = useState<Appearance | null>(null);
  useEffect(() => {
    loadLook().then(setLook);
  }, []);

  const open = () => {
    startNewGame({ starter, profile: { ...(look ?? {}), name: name.trim() || 'Chủ quán', shopName: shopName.trim() || 'Quán Ăn Của Tôi' } });
    navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'Game' }] });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => (step === 2 ? setStep(1) : navigation.goBack())} style={styles.back} accessibilityRole="button" accessibilityLabel="Quay lại">
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>🆕 Mở quán mới</Text>
        <View style={styles.steps}>
          <Text style={[styles.dot, step === 1 && styles.dotOn]}>①</Text>
          <Text style={[styles.dot, step === 2 && styles.dotOn]}>②</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Bảng hiệu xem trước */}
        <View style={styles.sign}>
          <Text style={styles.signLantern}>🏮</Text>
          <Text style={styles.signName} numberOfLines={2}>
            {shopName.trim() || 'Quán Ăn Của Tôi'}
          </Text>
          <Text style={styles.signOwner}>Chủ quán: {name.trim() || 'Chủ quán'}</Text>
          {step === 2 && (
            <Text style={styles.signDish}>
              Món đặc trưng: {RECIPES[starter].emoji} {RECIPES[starter].name}
            </Text>
          )}
        </View>

        {step === 1 ? (
          <View style={styles.card}>
            <Text style={styles.label}>🏮 Tên quán</Text>
            <View style={styles.row}>
              <TextInput value={shopName} onChangeText={(t) => setShopName(t.slice(0, 32))} style={styles.input} placeholder="Ví dụ: Phở Gánh Bà Tư" placeholderTextColor={colors.muted} accessibilityLabel="Tên quán" />
              <Dice label="Gợi ý tên quán" onPress={() => setShopName((v) => randomIdea(defaultRng, SHOP_NAME_IDEAS, v))} />
            </View>
            <Text style={styles.label}>🧑‍🍳 Tên chủ quán</Text>
            <View style={styles.row}>
              <TextInput value={name} onChangeText={(t) => setName(t.slice(0, 24))} style={styles.input} placeholder="Ví dụ: Bé Na" placeholderTextColor={colors.muted} accessibilityLabel="Tên chủ quán" />
              <Dice label="Gợi ý tên chủ quán" onPress={() => setName((v) => randomIdea(defaultRng, OWNER_NAME_IDEAS, v))} />
            </View>
            <Text style={styles.hint}>👕 Muốn đổi áo, tóc, mũ? Vào ô 🧑‍🍳 Nhân vật ở màn đầu.</Text>
            <BigButton label="Tiếp ▶" onPress={() => setStep(2)} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={styles.question}>Quán mình bán món gì trước?</Text>
            {STARTERS.map((st) => {
              const r = RECIPES[st.id];
              const on = starter === st.id;
              return (
                <Pressable
                  key={st.id}
                  onPress={() => setStarter(st.id)}
                  style={[styles.dish, on && styles.dishOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${r.name}: ${st.tag}`}
                >
                  <Text style={styles.dishEmoji}>{r.emoji}</Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.row}>
                      <Text style={styles.dishName}>{r.name}</Text>
                      <Text style={[styles.tag, on && styles.tagOn]}>{st.tag}</Text>
                    </View>
                    <Text style={styles.dishIngs}>{(Object.keys(r.ingredients) as IngredientId[]).map((i) => INGREDIENTS[i].emoji).join(' + ')} · 💰 {formatMoney(r.price)}</Text>
                    <Text style={styles.dishBlurb}>{st.blurb}</Text>
                  </View>
                  <Text style={styles.check}>{on ? '✅' : '⚪'}</Text>
                </Pressable>
              );
            })}
            <Text style={styles.hint}>🧋 Trà đá luôn có trong menu. Món khác mở dần khi lên cấp ⭐.</Text>
            <BigButton label="🏮 Khai trương!" onPress={open} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Dice({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.dice, pressed && { transform: [{ rotate: '20deg' }] }]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.diceText}>🎲</Text>
    </Pressable>
  );
}

function BigButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.big, pressed && { transform: [{ translateY: 3 }] }]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.bigText}>{label}</Text>
    </Pressable>
  );
}

const WOOD = '#8D5A2B';
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingHorizontal: 14, backgroundColor: colors.primary },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  title: { flex: 1, fontSize: 19, fontWeight: '900', color: '#fff' },
  steps: { flexDirection: 'row', gap: 4 },
  dot: { fontSize: 20, color: 'rgba(255,255,255,0.5)', fontWeight: '900' },
  dotOn: { color: '#fff' },
  content: { padding: 16, gap: 14, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' },
  sign: { backgroundColor: '#FFF3DC', borderRadius: 20, borderWidth: 4, borderColor: WOOD, borderBottomWidth: 8, padding: 14, alignItems: 'center', gap: 2 },
  signLantern: { fontSize: 34 },
  signName: { fontSize: 26, fontWeight: '900', color: colors.primaryDark, textAlign: 'center' },
  signOwner: { fontSize: 14, fontWeight: '800', color: colors.brown },
  signDish: { fontSize: 14, fontWeight: '800', color: colors.good, marginTop: 2 },
  card: { backgroundColor: colors.cream, borderRadius: 20, borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 5, padding: 14, gap: 8 },
  label: { fontSize: 16, fontWeight: '900', color: colors.brown, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 2, borderColor: colors.chunkyShadow, paddingHorizontal: 12, paddingVertical: 11, fontSize: 17, fontWeight: '700', color: colors.brown },
  dice: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#fff', borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 5, alignItems: 'center', justifyContent: 'center' },
  diceText: { fontSize: 26 },
  hint: { fontSize: 13, fontWeight: '700', color: colors.muted },
  question: { fontSize: 20, fontWeight: '900', color: colors.brown, textAlign: 'center' },
  dish: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 20, borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 6, padding: 12 },
  dishOn: { borderColor: colors.primary, backgroundColor: '#FFF3E0' },
  dishEmoji: { fontSize: 48 },
  dishName: { fontSize: 18, fontWeight: '900', color: colors.brown },
  tag: { fontSize: 11, fontWeight: '900', color: colors.brown, backgroundColor: '#F1E1C8', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  tagOn: { backgroundColor: colors.primary, color: '#fff' },
  dishIngs: { fontSize: 15, fontWeight: '800', color: colors.brown },
  dishBlurb: { fontSize: 12, fontWeight: '700', color: colors.muted },
  check: { fontSize: 24 },
  big: { marginTop: 6, backgroundColor: colors.primary, borderRadius: 20, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 6, borderColor: colors.primaryDark },
  bigText: { fontSize: 20, fontWeight: '900', color: '#fff' },
});
