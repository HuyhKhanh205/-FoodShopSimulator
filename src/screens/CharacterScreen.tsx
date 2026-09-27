import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import CharacterPreview from '../components/scene/CharacterPreview';
import { profileLook } from '../components/scene/looks';
import { Button, Panel, colors } from '../components/ui';
import { setProfile } from '../game/engine';
import { useGame } from '../game/GameContext';
import { defaultRng } from '../game/helpers';
import { CLOTH_COLORS, GENDERS, HAIR_COLORS, HAIR_STYLES, HATS, PROFILE_MODELS, SKIN_TONES, randomProfile } from '../game/profile';
import type { PlayerProfile } from '../game/types';
import type { RootStackParamList } from '../navigation/types';
import { hasWebGL } from '../three/webgl';

function Chips<T extends string>({ items, value, onChange }: { items: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.wrap}>
      {items.map((it) => (
        <Pressable
          key={it.key}
          onPress={() => onChange(it.key)}
          style={[styles.chip, value === it.key && styles.chipOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: value === it.key }}
        >
          <Text style={[styles.chipText, value === it.key && styles.chipTextOn]}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Swatches({ colors: list, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <View style={styles.wrap}>
      {list.map((c) => (
        <Pressable
          key={c}
          onPress={() => onChange(c)}
          accessibilityRole="button"
          accessibilityLabel={`Màu ${c}`}
          style={[styles.swatch, { backgroundColor: c }, value.toLowerCase() === c.toLowerCase() && styles.swatchOn]}
        />
      ))}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

/** Tạo / sửa nhân vật chủ quán và tên quán. */
export default function CharacterScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Character'>>();
  const first = Boolean(route.params?.first);
  const { game, act } = useGame();
  const { width } = useWindowDimensions();
  const wide = width >= 800;
  const [draft, setDraft] = useState<PlayerProfile>(() => ({ ...game!.profile }));
  const gl = useMemo(hasWebGL, []);
  if (!game) return null;

  const set = <K extends keyof PlayerProfile>(k: K, v: PlayerProfile[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = () => {
    act((s) => setProfile(s, draft));
    if (first) navigation.navigate('Game');
    else navigation.goBack();
  };

  const preview = (
    <View style={{ gap: 10 }}>
      <CharacterPreview look={profileLook(draft)} model={draft.model === 'custom' ? undefined : draft.model} enabled={gl} />
      <Text style={styles.nameBig}>{draft.name.trim() || 'Chủ quán'}</Text>
      <Text style={styles.shopBig}>🏮 {draft.shopName.trim() || 'Quán Ăn Của Tôi'}</Text>
      <Button variant="secondary" label="🎲 Ngẫu nhiên" onPress={() => setDraft((d) => randomProfile(defaultRng, d))} />
    </View>
  );

  const form = (
    <View style={{ gap: 4 }}>
      <Panel title="📛 Tên">
        <Field label="Tên chủ quán">
          <TextInput
            nativeID="player-name"
            value={draft.name}
            onChangeText={(t) => set('name', t.slice(0, 24))}
            placeholder="Ví dụ: Khánh"
            style={styles.input}
            placeholderTextColor={colors.muted}
          />
        </Field>
        <Field label="Tên quán">
          <TextInput
            nativeID="shop-name"
            value={draft.shopName}
            onChangeText={(t) => set('shopName', t.slice(0, 32))}
            placeholder="Ví dụ: Phở Gánh Bà Tư"
            style={styles.input}
            placeholderTextColor={colors.muted}
          />
        </Field>
      </Panel>

      <Panel title="🎭 Kiểu nhân vật">
        <Chips items={PROFILE_MODELS} value={draft.model} onChange={(v) => set('model', v)} />
        <Text style={[styles.label, { marginTop: 8 }]}>
          {draft.model === 'custom'
            ? 'Tự tạo: đổi được giới tính, kiểu tóc, màu da, màu quần áo và kính.'
            : 'Nhân vật 3D có hoạt ảnh (mô hình KayKit). Màu tóc, da, áo, khăn, quần bên dưới được tô lên mô hình; có thể đội thêm mũ.'}
        </Text>
      </Panel>

      <Panel title="🧑 Ngoại hình">
        {draft.model === 'custom' && (
          <>
            <Field label="Giới tính">
              <Chips items={GENDERS} value={draft.gender} onChange={(v) => set('gender', v)} />
            </Field>
            <Field label="Kiểu tóc">
              <Chips items={HAIR_STYLES} value={draft.hairStyle} onChange={(v) => set('hairStyle', v)} />
            </Field>
          </>
        )}
        <Field label="Màu tóc">
          <Swatches colors={HAIR_COLORS} value={draft.hairColor} onChange={(c) => set('hairColor', c)} />
        </Field>
        <Field label="Màu da">
          <Swatches colors={SKIN_TONES} value={draft.skin} onChange={(c) => set('skin', c)} />
        </Field>
      </Panel>

      <Panel title="👕 Trang phục">
        <Field label="Áo">
          <Swatches colors={CLOTH_COLORS} value={draft.shirt} onChange={(c) => set('shirt', c)} />
        </Field>
        <Field label={draft.model === 'custom' ? 'Tạp dề' : 'Khăn / viền áo'}>
          <Swatches colors={CLOTH_COLORS} value={draft.apron} onChange={(c) => set('apron', c)} />
        </Field>
        <Field label="Quần">
          <Swatches colors={CLOTH_COLORS} value={draft.pants} onChange={(c) => set('pants', c)} />
        </Field>
      </Panel>

      <Panel title="🎩 Mũ & phụ kiện">
        <Field label="Mũ">
          <Chips
            items={HATS}
            value={draft.hat}
            onChange={(v) =>
              // Màu gợi ý theo loại mũ: nón lá màu lá khô, mũ đầu bếp màu trắng.
              setDraft((d) => ({ ...d, hat: v, hatColor: v === 'conical' ? '#E6C98A' : v === 'chef' ? '#FFFFFF' : d.hatColor }))
            }
          />
        </Field>
        {draft.hat !== 'none' && (
          <Field label="Màu mũ">
            <Swatches colors={CLOTH_COLORS} value={draft.hatColor} onChange={(c) => set('hatColor', c)} />
          </Field>
        )}
        {draft.model === 'custom' && (
        <Field label="Kính">
          <Chips
            items={[
              { key: 'no', label: 'Không đeo' },
              { key: 'yes', label: '👓 Đeo kính' },
            ]}
            value={draft.glasses ? 'yes' : 'no'}
            onChange={(v) => set('glasses', v === 'yes')}
          />
        </Field>
        )}
      </Panel>

      <Button label={first ? '🏮 Vào quán' : '✅ Lưu nhân vật'} onPress={save} />
      {!first && <Button variant="ghost" label="Huỷ" onPress={() => navigation.goBack()} />}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{first ? '🧑‍🍳 Tạo nhân vật của bạn' : '🧑‍🍳 Nhân vật & tên quán'}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]}>
        <View style={wide ? styles.colPreview : undefined}>{preview}</View>
        <View style={wide ? styles.colForm : undefined}>{form}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 14, backgroundColor: colors.primary },
  title: { fontSize: 18, fontWeight: '900', color: '#fff' },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  contentWide: { flexDirection: 'row', alignItems: 'flex-start', maxWidth: 1000, width: '100%', alignSelf: 'center' },
  colPreview: { width: 320 },
  colForm: { flex: 1 },
  nameBig: { fontSize: 22, fontWeight: '900', color: colors.text, textAlign: 'center' },
  shopBig: { fontSize: 15, fontWeight: '700', color: colors.primaryDark, textAlign: 'center' },
  field: { gap: 6, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#fff',
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.warnBg },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextOn: { color: colors.primaryDark, fontWeight: '800' },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)' },
  swatchOn: { borderWidth: 4, borderColor: colors.primary, transform: [{ scale: 1.1 }] },
});
