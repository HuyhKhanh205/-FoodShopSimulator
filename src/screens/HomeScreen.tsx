import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Button, Panel, colors } from '../components/ui';
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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.logo}>🍜</Text>
        <Text style={styles.title}>Quán Ăn Của Tôi</Text>
        <Text style={styles.subtitle}>Game giả lập mở quán ăn</Text>

        <View style={styles.buttons}>
          {hasSave && <Button label="▶️  Chơi tiếp" onPress={onContinue} disabled={loading} />}
          <Button
            label={confirmNew ? '⚠️ Bấm lần nữa để xóa bản lưu và chơi mới' : '🆕  Chơi mới'}
            variant={hasSave ? 'secondary' : 'primary'}
            onPress={onNew}
            disabled={loading}
          />
        </View>

        <Panel title="📖 Cách chơi" style={styles.help}>
          <Text style={styles.p}>
            Bạn vay {formatMoney(START_DEBT)} để mở một quán ăn nhỏ. Hãy trả hết nợ trước ngày {DEBT_DUE_DAY}!
          </Text>
          <Text style={styles.h}>☀️ Buổi sáng — đi chợ</Text>
          <Text style={styles.p}>Mua nguyên liệu. Giá thay đổi mỗi ngày, đồ tươi chỉ để được 1–2 ngày. Đồ hết hạn phải vứt, để trong kho mà gặp thanh tra là bị phạt.</Text>
          <Text style={styles.h}>🔪 Sơ chế → 🔥 Nấu → 🍽️ Phục vụ</Text>
          <Text style={styles.p}>
            Thịt, rau, hành phải sơ chế trước. Chọn món để nấu trên bếp, nhấc ra đúng lúc (sớm quá thì sống, lâu quá thì cháy). Chọn món
            đã xong rồi bấm vào khách để mang ra. Khách dặn "không hành" thì nhớ bật nút 🚫 Không hành!
          </Text>
          <Text style={styles.h}>👀 Bếp của tôi</Text>
          <Text style={styles.p}>
            Tới thớt hay bếp là vào màn bếp nhìn qua mắt chủ quán: dãy bếp ở trên, thớt ở dưới trong cùng một cảnh. Chạm vào nồi để chọn
            bếp và khuấy, chạm liên tục vào thớt để thái. Nhấc món ra thì cầm trên tay, bấm "Ra phục vụ" để mang ra.
          </Text>
          <Text style={styles.h}>🗺️ Góc nhìn nhân vật</Text>
          <Text style={styles.p}>
            Khi mở cửa, bạn điều khiển chủ quán đi trong bản đồ quán: chạm vào thớt, bếp, quầy ra món, bàn khách để đi tới và thao tác. Trên máy tính
            dùng WASD / phím mũi tên để đi, E hoặc Space để thao tác. Cầm tối đa 2 món, tới bàn là tự đưa món khách gọi. Nút "📋 Bảng" để đổi sang
            bảng điều khiển bấm nút.
          </Text>
          <Text style={styles.h}>👥 Nhân viên</Text>
          <Text style={styles.p}>
            Thuê đầu bếp, phụ bếp, phục vụ để quán chạy nhanh hơn — nhưng họ có thể làm sai: nấu nhầm món, để cháy, quên ghi chú, mang nhầm bàn.
            Tay nghề thấp, tâm trạng tệ, giờ cao điểm thì càng dễ sai. Trả lương thấp quá họ sẽ nghỉ việc.
          </Text>
          <Text style={styles.h}>🎲 Tình huống bất ngờ</Text>
          <Text style={styles.p}>
            Cúp điện, hết gas, thanh tra, chuột, khách bùng tiền, food reviewer ẩn danh, đơn công ty, ngày lễ, mưa bão, quán đối thủ, nhân viên
            đòi tăng lương hay ăn vụng... Mỗi lựa chọn đều có hậu quả.
          </Text>
        </Panel>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, alignItems: 'center' },
  logo: { fontSize: 72, marginTop: 20 },
  title: { fontSize: 32, fontWeight: '900', color: colors.primaryDark },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 24 },
  buttons: { width: '100%', maxWidth: 420, gap: 10, marginBottom: 24 },
  help: { width: '100%', maxWidth: 640 },
  h: { fontWeight: '800', color: colors.text, marginTop: 10, marginBottom: 2 },
  p: { color: colors.text, lineHeight: 20 },
});
