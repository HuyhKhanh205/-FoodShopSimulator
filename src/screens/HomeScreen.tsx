import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import HelpButton from '../components/kid/HelpButton';
import IconTile from '../components/kid/IconTile';
import { colors } from '../components/ui';
import { DEBT_DUE_DAY, START_DEBT } from '../game/data';
import { useGame } from '../game/GameContext';
import { preloadModels } from '../three/models';

// Nạp sẵn mô hình 3D ngay khi mở game.
preloadModels();
import { formatMoney } from '../game/helpers';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { hasSave, loading, startNewGame, continueGame } = useGame();
  const [confirmNew, setConfirmNew] = useState(false);

  const onContinue = async () => {
    if (await continueGame()) navigation.navigate('Game');
  };
  const onNew = () => {
    if (hasSave && !confirmNew) {
      setConfirmNew(true);
      return;
    }
    startNewGame();
    setConfirmNew(false);
    navigation.navigate('Character', { first: true });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.helpCorner}>
        <HelpButton topic="home" />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.logo}>🍜</Text>
        <Text style={styles.title}>Quán Ăn Của Tôi</Text>
        <Text style={styles.subtitle}>🛒 → 🔪 → 🔥 → 🍽️ → ⭐</Text>

        <View style={styles.buttons}>
          {hasSave && (
            <IconTile icon="▶️" label="Chơi tiếp" name="Chơi tiếp" size="lg" tone="primary" onPress={onContinue} disabled={loading} style={styles.bigTile} />
          )}
          <IconTile
            icon={confirmNew ? '⚠️' : '🆕'}
            label={confirmNew ? 'Bấm lần nữa' : 'Chơi mới'}
            name="Chơi mới"
            sub={confirmNew ? 'xoá bản cũ' : undefined}
            size="lg"
            tone={hasSave ? (confirmNew ? 'danger' : 'plain') : 'primary'}
            onPress={onNew}
            disabled={loading}
            style={styles.bigTile}
          />
        </View>
        <Text style={styles.note}>
          💳 {formatMoney(START_DEBT)} · 📅 {DEBT_DUE_DAY}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  helpCorner: { position: 'absolute', top: 12, right: 12, zIndex: 2 },
  content: { padding: 20, alignItems: 'center' },
  logo: { fontSize: 88, marginTop: 30 },
  title: { fontSize: 32, fontWeight: '900', color: colors.primaryDark, textAlign: 'center' },
  subtitle: { fontSize: 26, marginTop: 6, marginBottom: 28 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginBottom: 24 },
  bigTile: { width: 150, height: 130 },
  note: { color: colors.muted, fontSize: 14, fontWeight: '700' },
});
