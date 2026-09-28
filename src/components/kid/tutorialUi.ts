import { useSyncExternalStore } from 'react';
import type { HelpTopic } from '../../game/help';

/**
 * Kho nhỏ cho trạng thái giao diện mà đầu bếp dẫn đường cần biết (không lưu vào bản lưu):
 * đang ở màn bếp hay không, và yêu cầu đọc hướng dẫn của một màn (nút ❗).
 */
export type NotebookTab = 'tasks' | 'diary' | 'bag';

interface UiState {
  fpOpen: boolean;
  help: { topic: HelpTopic; at: number } | null;
  /** Sổ tay chủ quán đang mở ở tab nào (null = đóng). */
  notebook: NotebookTab | null;
  /** Đường sông: chỗ đang được chỉ vào sau khi bấm "▶ Tiếp tục" (hết hạn lúc `until`). */
  flowGlow: { target: string; until: number } | null;
}

let state: UiState = { fpOpen: false, help: null, notebook: null, flowGlow: null };
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
  openNotebook: (tab: NotebookTab = 'tasks') => set({ notebook: tab }),
  closeNotebook: () => set({ notebook: null }),
  glow: (target: string, ms = 4000) => {
    const until = Date.now() + ms;
    set({ flowGlow: { target, until } });
    setTimeout(() => {
      if (state.flowGlow?.until === until) set({ flowGlow: null });
    }, ms);
  },
};

/** Mục tiêu tutorial + chỗ đường sông đang chỉ. */
export function withFlowGlow(targets: string[], ui: UiState): string[] {
  return ui.flowGlow ? [...targets, ui.flowGlow.target] : targets;
}

export function useTutorialUi(): UiState {
  return useSyncExternalStore(tutorialUi.subscribe, tutorialUi.get, tutorialUi.get);
}
