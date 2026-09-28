import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { speak } from '../components/kid/speech';
import { colors } from '../components/ui';
import { STAGES } from '../game/dayflow';
import { useGame } from '../game/GameContext';
import { formatMoney } from '../game/helpers';
import { exportSave, importSave } from '../game/migrate';
import { settingsStore, useSettings } from '../game/settings';
import { loadGame } from '../game/storage';
import type { GameState } from '../game/types';

/** Công tắc nhiều lựa chọn (chunky). */
function Segment<T extends string>({ value, items, onChange, label }: { value: T; items: { key: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {items.map((it) => (
        <Pressable
          key={it.key}
          onPress={() => onChange(it.key)}
          style={[styles.segBtn, value === it.key && styles.segOn]}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === it.key }}
          accessibilityLabel={`${label}: ${it.label}`}
        >
          <Text style={[styles.segText, value === it.key && styles.segTextOn]}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.rowBox}>
      <Text style={styles.rowTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** Tải chuỗi thành file (bản web). Có thể bị chặn trong khung Artifact — luôn có cách sao chép mã. */
function downloadText(name: string, text: string): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  try {
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}

/** Đang chạy trong khung nhúng (vd Artifact): trình xem không cho tải file → chỉ dùng sao chép mã. */
const IN_FRAME = (() => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
})();

/** Chọn file .json (bản web). */
function pickFile(): Promise<string | null> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,.txt';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ''));
      r.onerror = () => resolve(null);
      r.readAsText(f);
    };
    input.click();
  });
}

const slug = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'quan';

/** Cài đặt: âm thanh & giọng Chú Tư, đồ hoạ, sao lưu tiến độ (xuất / nhập mã, chỉ trên máy). */
export default function SettingsScreen() {
  const navigation = useNavigation();
  const settings = useSettings();
  const { game, sceneMode, setSceneMode, importGame } = useGame();
  const [code, setCode] = useState('');
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const [preview, setPreview] = useState<{ state: GameState } | { error: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const makeCode = async () => {
    const s = game ?? (await loadGame());
    if (!s) {
      setExportMsg('Chưa có quán nào để sao lưu.');
      return null;
    }
    const text = exportSave(s);
    setCode(text);
    return { s, text };
  };
  const onDownload = async () => {
    const r = await makeCode();
    if (!r) return;
    const ok = downloadText(`quan-an-${slug(r.s.profile.shopName)}-ngay-${r.s.day}.json`, r.text);
    setExportMsg(ok ? '📥 Đã tải file sao lưu. Nếu không thấy file, bấm 📋 Sao chép mã.' : 'Máy này không tải file được — bấm 📋 Sao chép mã nha.');
  };
  const onCopy = async () => {
    const r = await makeCode();
    if (!r) return;
    try {
      await navigator.clipboard.writeText(r.text);
      setExportMsg('📋 Đã chép mã! Dán vào ghi chú / tin nhắn để cất giữ.');
    } catch {
      setExportMsg('Không chép tự động được — hãy giữ tay vào ô mã bên dưới để chọn và chép.');
    }
  };
  const check = (text: string) => {
    setDone(null);
    const r = importSave(text);
    setPreview(r.ok ? { state: r.state } : { error: r.error });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel="Quay lại">
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>⚙️ Cài đặt</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.section}>🔊 Âm thanh & giọng Chú Tư</Text>
          <Row title="Giọng Chú Tư">
            <Segment label="Giọng Chú Tư" value={settings.voice ? 'on' : 'off'} items={[{ key: 'on', label: '🔊 Bật' }, { key: 'off', label: '🔇 Tắt' }]} onChange={(v) => settingsStore.set({ voice: v === 'on' })} />
          </Row>
          {settings.voice && (
            <Row title="Âm lượng">
              <Segment
                label="Âm lượng"
                value={settings.volume}
                items={[
                  { key: 'low', label: 'Nhỏ' },
                  { key: 'mid', label: 'Vừa' },
                  { key: 'high', label: 'To' },
                ]}
                onChange={(v) => settingsStore.set({ volume: v })}
              />
            </Row>
          )}
          {settings.voice && (
            <Pressable onPress={() => speak(STAGES[0].say)} style={styles.soft} accessibilityRole="button" accessibilityLabel="Nghe thử">
              <Text style={styles.softText}>🔊 Nghe thử</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>🎮 Đồ hoạ</Text>
          <Row title="Cảnh quán & chợ">
            <Segment label="Cảnh" value={sceneMode} items={[{ key: '3d', label: '🌴 3D' }, { key: 'simple', label: '🔲 Đơn giản' }]} onChange={setSceneMode} />
          </Row>
          <Row title="Chất lượng">
            <Segment label="Chất lượng" value={settings.quality} items={[{ key: 'saver', label: '🔋 Tiết kiệm pin' }, { key: 'pretty', label: '✨ Đẹp' }]} onChange={(v) => settingsStore.set({ quality: v })} />
          </Row>
          <Text style={styles.note}>Máy chạy chậm, nóng? Chọn 🔲 Đơn giản hoặc 🔋 Tiết kiệm pin.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>💾 Sao lưu tiến độ</Text>
          <Text style={styles.note}>🔒 Tiến độ chỉ lưu trong máy này. Sao lưu để chuyển sang máy khác hoặc giữ phòng khi xoá dữ liệu trình duyệt.</Text>
          <View style={styles.btnRow}>
            {!IN_FRAME && (
              <Pressable onPress={onDownload} style={styles.primary} accessibilityRole="button" accessibilityLabel="Tải file sao lưu">
                <Text style={styles.primaryText}>📤 Tải file</Text>
              </Pressable>
            )}
            <Pressable onPress={onCopy} style={styles.soft} accessibilityRole="button" accessibilityLabel="Sao chép mã sao lưu">
              <Text style={styles.softText}>📋 Sao chép mã</Text>
            </Pressable>
          </View>
          {exportMsg && <Text style={styles.msg}>{exportMsg}</Text>}
          {code !== '' && <TextInput value={code} editable={false} multiline style={[styles.code, { maxHeight: 90 }]} selectTextOnFocus accessibilityLabel="Mã sao lưu" />}

          <Text style={[styles.rowTitle, { marginTop: 10 }]}>📥 Nhập bản sao lưu</Text>
          <View style={styles.btnRow}>
            {Platform.OS === 'web' && (
              <Pressable
                onPress={async () => {
                  const t = await pickFile();
                  if (t) {
                    setPaste(t);
                    check(t);
                  }
                }}
                style={styles.soft}
                accessibilityRole="button"
                accessibilityLabel="Chọn file sao lưu"
              >
                <Text style={styles.softText}>📂 Chọn file</Text>
              </Pressable>
            )}
          </View>
          <TextInput
            value={paste}
            onChangeText={(t) => {
              setPaste(t);
              setPreview(null);
            }}
            multiline
            placeholder="…hoặc dán mã sao lưu vào đây"
            placeholderTextColor={colors.muted}
            style={styles.code}
            accessibilityLabel="Dán mã sao lưu"
          />
          <Pressable onPress={() => check(paste)} disabled={!paste.trim()} style={[styles.soft, !paste.trim() && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Kiểm tra mã">
            <Text style={styles.softText}>🔎 Kiểm tra mã</Text>
          </Pressable>
          {preview && 'error' in preview && <Text style={[styles.msg, { color: colors.bad }]}>⚠️ {preview.error}</Text>}
          {preview && 'state' in preview && (
            <View style={styles.preview}>
              <Text style={styles.previewTitle}>🏮 {preview.state.profile.shopName}</Text>
              <Text style={styles.previewSub}>
                Ngày {preview.state.day} · 💰 {formatMoney(preview.state.money)} · 🎟️ {preview.state.tickets} · ⭐ {preview.state.hopeStars} · ✍️ {preview.state.diary.length} trang
              </Text>
              <Text style={styles.note}>Dùng bản này sẽ thay quán đang lưu trong máy.</Text>
              <Pressable
                onPress={async () => {
                  await importGame(preview.state);
                  setDone(`✅ Đã nhập quán “${preview.state.profile.shopName}”. Về màn đầu bấm ▶ Chơi tiếp nha!`);
                  setPreview(null);
                  setPaste('');
                }}
                style={styles.primary}
                accessibilityRole="button"
                accessibilityLabel="Dùng bản sao lưu này"
              >
                <Text style={styles.primaryText}>✅ Dùng bản này</Text>
              </Pressable>
            </View>
          )}
          {done && <Text style={[styles.msg, { color: colors.good }]}>{done}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingHorizontal: 14, backgroundColor: colors.primary },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  title: { flex: 1, fontSize: 19, fontWeight: '900', color: '#fff' },
  content: { padding: 14, gap: 14, paddingBottom: 40, maxWidth: 600, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: colors.cream, borderRadius: 20, borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 5, padding: 14, gap: 10 },
  section: { fontSize: 18, fontWeight: '900', color: colors.brown },
  rowBox: { gap: 6 },
  rowTitle: { fontSize: 14, fontWeight: '900', color: colors.brown },
  segment: { flexDirection: 'row', backgroundColor: '#EFE2CF', borderRadius: 18, padding: 3, gap: 3 },
  segBtn: { flex: 1, borderRadius: 15, paddingVertical: 10, alignItems: 'center' },
  segOn: { backgroundColor: colors.brown },
  segText: { fontSize: 14, fontWeight: '900', color: colors.brown },
  segTextOn: { color: colors.cream },
  note: { fontSize: 12, fontWeight: '700', color: colors.muted },
  btnRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  primary: { flexGrow: 1, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', borderBottomWidth: 5, borderColor: colors.primaryDark },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  soft: { flexGrow: 1, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 5 },
  softText: { color: colors.brown, fontWeight: '900', fontSize: 15 },
  msg: { fontSize: 13, fontWeight: '800', color: colors.brown },
  code: { minHeight: 70, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.chunkyShadow, padding: 8, fontSize: 11, color: colors.brown, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, textAlignVertical: 'top' },
  preview: { backgroundColor: '#FFF3DC', borderRadius: 14, padding: 10, gap: 6, borderWidth: 2, borderColor: colors.accent },
  previewTitle: { fontSize: 17, fontWeight: '900', color: colors.primaryDark },
  previewSub: { fontSize: 13, fontWeight: '800', color: colors.brown },
});
