import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newGame, putDownAll, tick } from './engine';
import type { NewGameOptions } from './engine';
import { loadSettings } from './settings';
import { defaultRng } from './helpers';
import { clearSave, loadGame, saveGame, writeSave } from './storage';
import type { GameState, Rng } from './types';

/** Hàm thay đổi state (được phép sửa trực tiếp bản sao). Trả về chuỗi = thông báo lỗi cho người chơi. */
export type GameMutation = (s: GameState, rng: Rng) => string | null | void | boolean;

interface Store {
  game: GameState | null;
  toast: { id: number; text: string } | null;
}

type Action =
  | { type: 'set'; game: GameState | null }
  | { type: 'mutate'; fn: GameMutation }
  | { type: 'tick'; dt: number }
  | { type: 'clearToast' };

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function reducer(store: Store, action: Action): Store {
  switch (action.type) {
    case 'set':
      return { game: action.game, toast: null };
    case 'clearToast':
      return { ...store, toast: null };
    case 'tick': {
      if (!store.game) return store;
      const draft = clone(store.game);
      tick(draft, action.dt, defaultRng);
      return { ...store, game: draft };
    }
    case 'mutate': {
      if (!store.game) return store;
      const draft = clone(store.game);
      const result = action.fn(draft, defaultRng);
      const toast = typeof result === 'string' ? { id: Date.now(), text: result } : store.toast;
      return { game: draft, toast };
    }
    default:
      return store;
  }
}

/** map: điều khiển nhân vật trên bản đồ; panel: bảng điều khiển bấm nút. */
export type ViewMode = 'map' | 'panel';
const VIEW_MODE_KEY = 'foodshop.viewMode';
/** Cảnh quán: 3d = KayKit nhìn isometric; simple = mặt bằng 2D, chạm trạm là làm luôn. */
export type SceneMode = '3d' | 'simple';
const SCENE_MODE_KEY = 'foodshop.sceneMode';

interface GameContextValue {
  game: GameState | null;
  toast: Store['toast'];
  hasSave: boolean;
  loading: boolean;
  paused: boolean;
  setPaused: (p: boolean) => void;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  sceneMode: SceneMode;
  setSceneMode: (m: SceneMode) => void;
  act: (fn: GameMutation) => void;
  startNewGame: (opts?: NewGameOptions) => void;
  continueGame: () => Promise<boolean>;
  /** Tóm tắt bản lưu cho thẻ "Chơi tiếp" ở màn đầu. */
  saveInfo: SaveInfo | null;
  /** Ghi đè bản lưu bằng bản nhập từ mã sao lưu. */
  importGame: (state: GameState) => Promise<void>;
  /** Đọc lại bản lưu (sau khi đổi nhân vật từ màn đầu...). */
  refreshSave: () => Promise<void>;
}

export interface SaveInfo {
  shopName: string;
  day: number;
  money: number;
}
const infoOf = (g: GameState): SaveInfo => ({ shopName: g.profile.shopName, day: g.day, money: g.money });

const GameContext = createContext<GameContextValue | undefined>(undefined);

const TICK_MS = 200;

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [store, dispatch] = useReducer(reducer, { game: null, toast: null });
  const [hasSave, setHasSave] = useState(false);
  const [saveInfo, setSaveInfo] = useState<SaveInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [viewMode, setViewModeState] = useState<ViewMode>('map');
  const [sceneMode, setSceneModeState] = useState<SceneMode>('3d');
  const game = store.game;

  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_KEY)
      .then((v) => {
        if (v === 'map' || v === 'panel') setViewModeState(v);
      })
      .catch(() => {});
    AsyncStorage.getItem(SCENE_MODE_KEY)
      .then((v) => {
        if (v === '3d' || v === 'simple') setSceneModeState(v);
      })
      .catch(() => {});
    void loadSettings();
    loadGame().then((saved) => {
      setHasSave(Boolean(saved));
      setSaveInfo(saved ? infoOf(saved) : null);
      setLoading(false);
    });
  }, []);

  // Đồng hồ game: chạy khi quán mở cửa, không tạm dừng và không có sự kiện chờ quyết định.
  const running = game?.phase === 'open' && !game.activeEvent && !game.eventResult && !paused;
  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(now - last, 500);
      last = now;
      dispatch({ type: 'tick', dt });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  // Tự động lưu (ngoài giờ mở cửa).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!game || game.phase === 'open') return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveGame(game)
        .then(() => {
          setHasSave(true);
          setSaveInfo(infoOf(game));
        })
        .catch(() => {});
    }, 300);
  }, [game]);

  // Thông báo tự tắt sau 2.5 giây.
  useEffect(() => {
    if (!store.toast) return;
    const id = setTimeout(() => dispatch({ type: 'clearToast' }), 2500);
    return () => clearTimeout(id);
  }, [store.toast]);

  const act = useCallback((fn: GameMutation) => dispatch({ type: 'mutate', fn }), []);

  const setViewMode = useCallback((m: ViewMode) => {
    setViewModeState(m);
    AsyncStorage.setItem(VIEW_MODE_KEY, m).catch(() => {});
    // Bảng điều khiển không có khái niệm "cầm trên tay": đặt hết món về quầy.
    if (m === 'panel') dispatch({ type: 'mutate', fn: (s) => putDownAll(s) });
  }, []);

  const setSceneMode = useCallback((m: SceneMode) => {
    setSceneModeState(m);
    AsyncStorage.setItem(SCENE_MODE_KEY, m).catch(() => {});
  }, []);

  const startNewGame = useCallback((opts?: NewGameOptions) => {
    clearSave().catch(() => {});
    setPaused(false);
    dispatch({ type: 'set', game: newGame(defaultRng, opts) });
  }, []);

  const importGame = useCallback(async (state: GameState) => {
    await writeSave(state);
    setHasSave(true);
    setSaveInfo(infoOf(state));
    dispatch({ type: 'set', game: null });
  }, []);

  const refreshSave = useCallback(async () => {
    const saved = await loadGame();
    setHasSave(Boolean(saved));
    setSaveInfo(saved ? infoOf(saved) : null);
  }, []);

  const continueGame = useCallback(async () => {
    const saved = await loadGame();
    if (!saved) return false;
    setPaused(false);
    dispatch({ type: 'set', game: saved });
    return true;
  }, []);

  const value = useMemo(
    () => ({ game, toast: store.toast, hasSave, loading, paused, setPaused, viewMode, setViewMode, sceneMode, setSceneMode, act, startNewGame, continueGame, saveInfo, importGame, refreshSave }),
    [game, store.toast, hasSave, loading, paused, viewMode, setViewMode, sceneMode, setSceneMode, act, startNewGame, continueGame, saveInfo, importGame, refreshSave]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame phải được gọi bên trong GameProvider');
  return ctx;
}

/** Dùng trong màn hình chỉ hiển thị khi đã có game. */
export function useGameState(): GameState {
  const { game } = useGame();
  if (!game) throw new Error('Chưa bắt đầu game');
  return game;
}
