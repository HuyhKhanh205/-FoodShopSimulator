import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateSave } from './migrate';
import type { GameState } from './types';

const SAVE_KEY = 'foodshop.save.v1';

/**
 * Chỉ lưu khi không trong giờ mở cửa. Nếu thoát app giữa ngày,
 * lần sau sẽ quay lại buổi sáng của ngày đó (đồ đã mua vẫn còn).
 */
export async function saveGame(state: GameState): Promise<void> {
  if (state.phase === 'open') return;
  const data: GameState = { ...state, run: null };
  await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export async function loadGame(): Promise<GameState | null> {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as GameState;
    if (data.version !== 1) return null;
    return migrateSave(data);
  } catch {
    return null;
  }
}

/** Ghi đè bản lưu bằng một trạng thái (dùng khi nhập mã sao lưu). */
export async function writeSave(state: GameState): Promise<void> {
  await AsyncStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, run: null, phase: state.phase === 'open' ? 'market' : state.phase }));
}

export async function clearSave(): Promise<void> {
  await AsyncStorage.removeItem(SAVE_KEY);
}
