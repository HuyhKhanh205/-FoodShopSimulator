import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import HomeScene3D from '../components/home/HomeScene3D';
import { colors } from '../components/ui';
import { useGame } from '../game/GameContext';
import { formatMoney } from '../game/helpers';
import { loadLook } from '../game/settings';
import type { Appearance } from '../game/settings';
import { preloadModels } from '../three/models';

// Nạp sẵn mô hình 3D ngay khi mở game.
preloadModels();

/**
 * Màn đầu: nền chợ bên sông 3D sống động (Chú Tư + chủ quán vẫy chào), bảng hiệu gỗ,
 * thẻ ▶ Chơi tiếp (khi có bản lưu) và 4 ô: Chơi mới, Nhân vật, Hướng dẫn, Cài đặt.
 */
export default function HomeScreen() {
  const navigation = useNavigation();
  const focused = useIsFocused();
  const { width, height } = useWindowDimensions();
  const { hasSave, saveInfo, loading, continueGame } = useGame();
  const [confirmNew, setConfirmNew] = useState(false);
  const [look, setLook] = useState<Appearance | null>(null);
  // Đọc lại ngoại hình mỗi lần quay về màn đầu (vừa sửa nhân vật).
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadLook().then((l) => alive && setLook(l));
      return () => {
        alive = false;
      };
    }, [])
  );

  const onContinue = async () => {
    if (await continueGame()) navigation.navigate('Game');
  };
  const onNew = () => {
    if (hasSave) setConfirmNew(true);
    else navigation.navigate('NewGame');
  };

  return (
    <View style={styles.root}>
      {/* Nền 3D chỉ vẽ khi đang ở màn đầu (không chạy ngầm lúc chơi). */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {focused && look && <HomeScene3D width={width} height={height} look={look} />}
      </View>
      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        <View style={styles.sign} accessibilityRole="header">
          <View style={styles.ropes}>
            <View style={styles.rope} />
            <View style={styles.rope} />
          </View>
          <Text style={styles.logo}>🍜</Text>
          <Text style={styles.title}>Quán Ăn Của Tôi</Text>
          <Text style={styles.subtitle}>🛶 Quán nhỏ bên sông · 🛒 🔪 🔥 🍽️ ⭐</Text>
        </View>

        <View style={{ flex: 1 }} pointerEvents="none" />

        <View style={styles.panel}>
          {hasSave && saveInfo && (
            <Pressable
              onPress={onContinue}
              disabled={loading}
              style={({ pressed }) => [styles.continue, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Chơi tiếp ${saveInfo.shopName}, ngày ${saveInfo.day}`}
            >
              <Text style={styles.continueIcon}>▶</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.continueTitle}>Chơi tiếp</Text>
                <Text style={styles.continueSub} numberOfLines={1}>
                  🏮 {saveInfo.shopName} · Ngày {saveInfo.day} · 💰 {formatMoney(saveInfo.money)}
                </Text>
              </View>
            </Pressable>
          )}
          <View style={styles.grid}>
            <MenuTile icon="🆕" label="Chơi mới" primary={!hasSave} onPress={onNew} disabled={loading} />
            <MenuTile icon="🧑‍🍳" label="Nhân vật" onPress={() => navigation.navigate('Character', { from: 'home' })} />
            <MenuTile icon="📖" label="Hướng dẫn" onPress={() => navigation.navigate('Guide')} />
            <MenuTile icon="⚙️" label="Cài đặt" onPress={() => navigation.navigate('Settings')} />
          </View>
        </View>
      </SafeAreaView>

      <Modal transparent animationType="fade" visible={confirmNew} onRequestClose={() => setConfirmNew(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogIcon}>⚠️</Text>
            <Text style={styles.dialogTitle}>Mở quán mới?</Text>
            <Text style={styles.dialogText}>
              Quán “{saveInfo?.shopName}” (ngày {saveInfo?.day}) sẽ bị xoá khi khai trương quán mới.
            </Text>
            <Pressable
              onPress={() => {
                setConfirmNew(false);
                navigation.navigate('Settings');
              }}
              style={[styles.dBtn, styles.dBtnSoft]}
              accessibilityRole="button"
            >
              <Text style={styles.dBtnSoftText}>📤 Sao lưu trước</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setConfirmNew(false);
                navigation.navigate('NewGame');
              }}
              style={[styles.dBtn, styles.dBtnDanger]}
              accessibilityRole="button"
              accessibilityLabel="Vẫn chơi mới"
            >
              <Text style={styles.dBtnText}>🆕 Vẫn chơi mới</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmNew(false)} style={styles.dCancel} accessibilityRole="button">
              <Text style={styles.dCancelText}>Huỷ</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MenuTile({ icon, label, onPress, primary, disabled }: { icon: string; label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.tile, primary && styles.tilePrimary, pressed && styles.pressed, disabled && { opacity: 0.5 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.tileIcon}>{icon}</Text>
      <Text style={[styles.tileLabel, primary && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const WOOD = '#8D5A2B';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#BDE3F2' },
  safe: { flex: 1, padding: 14 },
  sign: {
    alignSelf: 'center',
    marginTop: 18,
    backgroundColor: '#FFF3DC',
    borderRadius: 22,
    borderWidth: 4,
    borderColor: WOOD,
    borderBottomWidth: 8,
    paddingHorizontal: 22,
    paddingVertical: 10,
    alignItems: 'center',
    maxWidth: 420,
  },
  ropes: { position: 'absolute', top: -24, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between' },
  rope: { width: 4, height: 22, backgroundColor: WOOD, borderRadius: 2 },
  logo: { fontSize: 44 },
  title: { fontSize: 30, fontWeight: '900', color: colors.primaryDark, textAlign: 'center' },
  subtitle: { fontSize: 14, fontWeight: '800', color: colors.brown, marginTop: 2 },
  panel: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 10, backgroundColor: 'rgba(255,246,233,0.94)', borderRadius: 26, padding: 12, borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 6 },
  continue: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 6, borderColor: colors.primaryDark },
  continueIcon: { fontSize: 30, color: '#fff', fontWeight: '900' },
  continueTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  continueSub: { fontSize: 13, fontWeight: '800', color: '#FFE0B2' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: '45%', minHeight: 84, backgroundColor: '#fff', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 6, gap: 2 },
  tilePrimary: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  tileIcon: { fontSize: 32 },
  tileLabel: { fontSize: 16, fontWeight: '900', color: colors.brown },
  pressed: { transform: [{ translateY: 3 }] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: colors.cream, borderRadius: 24, padding: 18, gap: 10, alignItems: 'stretch', maxWidth: 420, width: '100%', alignSelf: 'center' },
  dialogIcon: { fontSize: 40, textAlign: 'center' },
  dialogTitle: { fontSize: 22, fontWeight: '900', color: colors.brown, textAlign: 'center' },
  dialogText: { fontSize: 15, fontWeight: '700', color: colors.brown, textAlign: 'center', marginBottom: 4 },
  dBtn: { borderRadius: 18, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 5 },
  dBtnSoft: { backgroundColor: '#fff', borderWidth: 2, borderColor: colors.chunkyShadow },
  dBtnSoftText: { fontSize: 16, fontWeight: '900', color: colors.brown },
  dBtnDanger: { backgroundColor: colors.bad, borderColor: '#8E0000' },
  dBtnText: { fontSize: 16, fontWeight: '900', color: '#fff' },
  dCancel: { alignItems: 'center', paddingVertical: 8 },
  dCancelText: { fontSize: 15, fontWeight: '800', color: colors.muted },
});
