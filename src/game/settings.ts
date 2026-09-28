import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { DEFAULT_PROFILE } from './profile';
import type { PlayerProfile } from './types';

/**
 * Cài đặt của người chơi (lưu trên máy, không gắn với bản lưu):
 * giọng Chú Tư bật / tắt, âm lượng, chất lượng đồ hoạ. Kho nhỏ đọc được cả ngoài React (speech.ts, Canvas).
 */
export interface Settings {
  voice: boolean;
  volume: 'low' | 'mid' | 'high';
  /** Tiết kiệm pin = vẽ 3D ở độ phân giải thấp hơn. */
  quality: 'saver' | 'pretty';
  /** Tên đồ vật trong quán: 'auto' = chỉ hiện khi đứng gần / có việc; 'always' = luôn hiện. */
  labels: 'auto' | 'always';
}

const SETTINGS_KEY = 'foodshop.settings';
const LOOK_KEY = 'foodshop.profile';
export const DEFAULT_SETTINGS: Settings = { voice: true, volume: 'mid', quality: 'pretty', labels: 'auto' };
export const VOLUME_GAIN: Record<Settings['volume'], number> = { low: 0.4, mid: 0.75, high: 1 };

let state: Settings = { ...DEFAULT_SETTINGS };
const listeners = new Set<() => void>();

export const settingsStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  set(patch: Partial<Settings>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(state)).catch(() => {});
  },
};

/** Đọc cài đặt đã lưu (gọi một lần khi mở game). */
export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      state = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      listeners.forEach((l) => l());
    }
  } catch {
    // giữ mặc định
  }
}

export function useSettings(): Settings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
}

/** Độ phân giải tối đa cho Canvas 3D theo chất lượng. */
export function maxDpr(): number {
  return state.quality === 'saver' ? 1 : 2;
}

// ---------- Ngoại hình chủ quán (tách khỏi bản lưu) ----------

/** Các trường ngoại hình (không gồm tên người / tên quán). */
export type Appearance = Omit<PlayerProfile, 'name' | 'shopName'>;

export function lookOf(p: PlayerProfile): Appearance {
  const { name: _n, shopName: _s, ...look } = p;
  return look;
}

export async function loadLook(): Promise<Appearance> {
  try {
    const raw = await AsyncStorage.getItem(LOOK_KEY);
    if (raw) return { ...lookOf(DEFAULT_PROFILE), ...JSON.parse(raw) };
  } catch {
    // mặc định
  }
  return lookOf(DEFAULT_PROFILE);
}

export async function saveLook(look: Appearance) {
  await AsyncStorage.setItem(LOOK_KEY, JSON.stringify(lookOf({ ...DEFAULT_PROFILE, ...look }))).catch(() => {});
}
