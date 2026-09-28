import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import EventModal from '../components/EventModal';
import Toast from '../components/Toast';
import NotebookSheet from '../components/notebook/NotebookSheet';
import { colors } from '../components/ui';
import { useGame } from '../game/GameContext';
import MarketView from './views/MarketView';
import ShopMapView from './views/ShopMapView';
import ShopView from './views/ShopView';
import SummaryView from './views/SummaryView';

/** Màn chơi chính: hiển thị theo giai đoạn trong ngày (chợ → mở cửa → tổng kết). */
export default function GameScreen() {
  const navigation = useNavigation();
  const { game, viewMode } = useGame();

  useEffect(() => {
    if (!game) navigation.navigate('Home');
  }, [game, navigation]);

  if (!game) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        {(game.phase === 'market' || (game.phase === 'open' && game.run?.ownerAway)) && <MarketView />}
        {game.phase === 'open' && !game.run?.ownerAway && (viewMode === 'map' ? <ShopMapView /> : <ShopView />)}
        {game.phase === 'summary' && <SummaryView />}
      </View>
      <NotebookSheet />
      <EventModal />
      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  body: { flex: 1, backgroundColor: colors.bg },
});
