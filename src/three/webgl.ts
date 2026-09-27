import { Platform } from 'react-native';

/** Trình duyệt có WebGL không (trên iOS/Android luôn có qua expo-gl). */
export function hasWebGL(): boolean {
  if (Platform.OS !== 'web') return true;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
