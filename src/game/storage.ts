import AsyncStorage from '@react-native-async-storage/async-storage';
import { RECIPES } from './data';
import { DEFAULT_PROFILE } from './profile';
import { syncDishes } from './dishes';
import { xpForRecipes } from './progression';
import { newVendors } from './market';
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
    // Bản lưu cũ chưa có nhân vật: dùng nhân vật mặc định.
    const profile = { ...DEFAULT_PROFILE, ...(data.profile ?? {}) };
    // Bản lưu trước khi có cấp độ: mở đủ cấp cho các món đã có, bỏ qua hướng dẫn ngày đầu.
    syncDishes({ dishes: data.dishes ?? {} } as GameState);
    const unlockedRecipes = (data.unlockedRecipes ?? []).filter((id) => RECIPES[id]);
    const old = data.xp === undefined;
    return {
      ...data,
      profile,
      unlockedRecipes,
      xp: data.xp ?? xpForRecipes(unlockedRecipes),
      chefQueue: data.chefQueue ?? [],
      tutorial: data.tutorial ?? { step: 0, done: old },
      labFails: data.labFails ?? 0,
      labHints: data.labHints ?? {},
      dishes: data.dishes ?? {},
      discovered: data.discovered ?? [...unlockedRecipes],
      launched: data.launched ?? {},
      trend: data.trend ?? null,
      vendors: data.vendors ?? newVendors(),
      run: null,
      phase: data.phase === 'open' ? 'market' : data.phase,
    };
  } catch {
    return null;
  }
}

export async function clearSave(): Promise<void> {
  await AsyncStorage.removeItem(SAVE_KEY);
}
