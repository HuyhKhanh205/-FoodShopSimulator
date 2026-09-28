import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameProvider } from './src/game/GameContext';
import { RootStackParamList } from './src/navigation/types';
import HomeScreen from './src/screens/HomeScreen';
import GameScreen from './src/screens/GameScreen';
import StaffScreen from './src/screens/StaffScreen';
import UpgradeScreen from './src/screens/UpgradeScreen';
import CharacterScreen from './src/screens/CharacterScreen';
import LabScreen from './src/screens/LabScreen';
import NewGameScreen from './src/screens/NewGameScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import GuideScreen from './src/screens/GuideScreen';
import ChefGuide from './src/components/kid/ChefGuide';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  // Màn đang mở (để bếp trưởng biết lúc nào nên xuất hiện).
  const [route, setRoute] = useState('Home');
  const onState = () => setRoute(navigationRef.getCurrentRoute()?.name ?? 'Home');
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <GameProvider>
        <NavigationContainer ref={navigationRef} onReady={onState} onStateChange={onState}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Game" component={GameScreen} />
            <Stack.Screen name="Staff" component={StaffScreen} />
            <Stack.Screen name="Upgrades" component={UpgradeScreen} />
            <Stack.Screen name="Character" component={CharacterScreen} />
            <Stack.Screen name="Lab" component={LabScreen} />
            <Stack.Screen name="NewGame" component={NewGameScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Guide" component={GuideScreen} />
          </Stack.Navigator>
          <ChefGuide route={route} openLab={() => navigationRef.isReady() && navigationRef.navigate('Lab')} />
        </NavigationContainer>
      </GameProvider>
    </SafeAreaProvider>
  );
}
