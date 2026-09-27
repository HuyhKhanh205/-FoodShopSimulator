import { useSyncExternalStore } from 'react';
import type { HelpTopic } from '../../game/help';

/**
 * Kho nhỏ cho trạng thái giao diện mà đầu bếp dẫn đường cần biết (không lưu vào bản lưu):
 * đang ở màn bếp hay không, và yêu cầu đọc hướng dẫn của một màn (nút ❗).
 */
interface UiState {
  fpOpen: boolean;
  help: { topic: HelpTopic; at: number } | null;
}

let state: UiState = { fpOpen: false, help: null };
const listeners = new Set<() => void>();

function set(patch: Partial<UiState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const tutorialUi = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setFpOpen: (v: boolean) => {
    if (state.fpOpen !== v) set({ fpOpen: v });
  },
  requestHelp: (topic: HelpTopic) => set({ help: { topic, at: Date.now() } }),
  clearHelp: () => set({ help: null }),
};

export function useTutorialUi(): UiState {
  return useSyncExternalStore(tutorialUi.subscribe, tutorialUi.get, tutorialUi.get);
}
