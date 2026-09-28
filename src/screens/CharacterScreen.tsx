import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import CharacterPreview from '../components/scene/CharacterPreview';
import { profileLook } from '../components/scene/looks';
import HelpButton from '../components/kid/HelpButton';
import IconTile from '../components/kid/IconTile';
import { Button, Panel, colors } from '../components/ui';
import { setProfile } from '../game/engine';
import { useGame } from '../game/GameContext';
import { defaultRng } from '../game/helpers';
import { CLOTH_COLORS, DEFAULT_PROFILE, GENDERS, HAIR_COLORS, HAIR_STYLES, HATS, PROFILE_MODELS, SKIN_TONES, randomProfile } from '../game/profile';
import { loadLook, lookOf, saveLook } from '../game/settings';
import { loadGame, writeSave } from '../game/storage';
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

/**
 * Nhân vật chủ quán. Mở từ màn đầu (`from: 'home'`): chỉ sửa ngoại hình, lưu riêng (và cập nhật bản lưu đang có).
 * Mở trong game (ô 🧑‍🍳 Chủ quán): sửa cả tên người / tên quán.
 */
export default function CharacterScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Character'>>();
  const fromHome = route.params?.from === 'home';
  const { game, act, refreshSave } = useGame();
  const { width } = useWindowDimensions();
  const wide = width >= 800;
  const [draft, setDraft] = useState<PlayerProfile>(() => ({ ...(game && !fromHome ? game.profile : DEFAULT_PROFILE) }));
  const [showNames, setShowNames] = useState(false);
  const gl = useMemo(hasWebGL, []);
  // Từ màn đầu: nạp ngoại hình đã lưu riêng.
  useEffect(() => {
    if (fromHome) loadLook().then((l) => setDraft((d) => ({ ...d, ...l })));
  }, [fromHome]);
  if (!game && !fromHome) return null;

  const set = <K extends keyof PlayerProfile>(k: K, v: PlayerProfile[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    await saveLook(lookOf(draft));
    if (fromHome) {
      // Cập nhật luôn ngoại hình trong bản lưu đang có (giữ tên người / tên quán).
      const saved = await loadGame();
      if (saved) {
        await writeSave({ ...saved, profile: { ...saved.profile, ...lookOf(draft) } });
        await refreshSave();
      }
    } else act((s) => setProfile(s, draft));
    navigation.goBack();
  };

  const preview = (
    <View style={{ gap: 10 }}>
      <CharacterPreview look={profileLook(draft)} model={draft.model === 'custom' ? undefined : draft.model} enabled={gl} />
      {!fromHome && <Text style={styles.nameBig}>{draft.name.trim() || 'Chủ quán'}</Text>}
      {!fromHome && <Text style={styles.shopBig}>🏮 {draft.shopName.trim() || 'Quán Ăn Của Tôi'}</Text>}
      <View style={styles.previewBtns}>
        <IconTile icon="🎲" label="Đổi" name="Ngẫu nhiên" onPress={() => setDraft((d) => randomProfile(defaultRng, d))} />
        {!fromHome && <IconTile icon="✏️" label="Tên" name="Đặt tên" selected={showNames} onPress={() => setShowNames((v) => !v)} />}
        <IconTile icon="✅" label="Lưu" name="Lưu nhân vật" tone="primary" onPress={save} />
      </View>
    </View>
  );

  const form = (
    <View style={{ gap: 4 }}>
      {showNames && (
      <Panel title="✏️">
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
      )}

      <Panel title="👤">
        <Chips items={PROFILE_MODELS} value={draft.model} onChange={(v) => set('model', v)} />
      </Panel>

      <Panel>
        {draft.model === 'custom' && (
          <>
            <Field label="🚻">
              <Chips items={GENDERS} value={draft.gender} onChange={(v) => set('gender', v)} />
            </Field>
            <Field label="💇">
              <Chips items={HAIR_STYLES} value={draft.hairStyle} onChange={(v) => set('hairStyle', v)} />
            </Field>
          </>
        )}
        <Field label="💇 🎨">
          <Swatches colors={HAIR_COLORS} value={draft.hairColor} onChange={(c) => set('hairColor', c)} />
        </Field>
        <Field label="🖐️">
          <Swatches colors={SKIN_TONES} value={draft.skin} onChange={(c) => set('skin', c)} />
        </Field>
      </Panel>

      <Panel>
        <Field label="👕">
          <Swatches colors={CLOTH_COLORS} value={draft.shirt} onChange={(c) => set('shirt', c)} />
        </Field>
        <Field label={draft.model === 'custom' ? '🥼' : '🧣'}>
          <Swatches colors={CLOTH_COLORS} value={draft.apron} onChange={(c) => set('apron', c)} />
        </Field>
        <Field label="👖">
          <Swatches colors={CLOTH_COLORS} value={draft.pants} onChange={(c) => set('pants', c)} />
        </Field>
      </Panel>

      <Panel>
        <Field label="🎩">
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
          <Field label="🎩 🎨">
            <Swatches colors={CLOTH_COLORS} value={draft.hatColor} onChange={(c) => set('hatColor', c)} />
          </Field>
        )}
        {draft.model === 'custom' && (
        <Field label="👓">
          <Chips
            items={[
              { key: 'no', label: '🚫' },
              { key: 'yes', label: '👓' },
            ]}
            value={draft.glasses ? 'yes' : 'no'}
            onChange={(v) => set('glasses', v === 'yes')}
          />
        </Field>
        )}
      </Panel>

      <Button label="✅ Lưu" onPress={save} />
      <Button variant="ghost" label="Huỷ" onPress={() => navigation.goBack()} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel="Quay lại">
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>🧑‍🍳 {fromHome ? 'Nhân vật của bạn' : 'Chủ quán'}</Text>
        <HelpButton topic="character" />
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
  header: { padding: 10, paddingHorizontal: 14, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewBtns: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: '900', color: '#fff' },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  backText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  contentWide: { flexDirection: 'row', alignItems: 'flex-start', maxWidth: 1000, width: '100%', alignSelf: 'center' },
  colPreview: { width: 320 },
  colForm: { flex: 1 },
  nameBig: { fontSize: 22, fontWeight: '900', color: colors.text, textAlign: 'center' },
  shopBig: { fontSize: 15, fontWeight: '700', color: colors.primaryDark, textAlign: 'center' },
  field: { gap: 6, marginBottom: 12 },
  label: { fontSize: 20, fontWeight: '700', color: colors.muted },
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
