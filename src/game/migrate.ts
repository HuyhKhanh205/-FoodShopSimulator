import { RECIPES, START_UPGRADES, UPGRADES } from './data';
import { DEFAULT_PROFILE } from './profile';
import { syncDishes } from './dishes';
import { xpForRecipes } from './progression';
import { newVendors } from './market';
import { emptyTally, pickSpecial, rollMissions } from './missions';
import { defaultRng } from './helpers';
import type { GameState, Upgrades } from './types';

/** Mỗi nâng cấp phải nằm đúng một mức có trong danh sách (bản lưu cũ có thể lệch, vd 4 bàn). */
function fixUpgrades(u: Upgrades | undefined): Upgrades {
  const out = { ...START_UPGRADES, ...(u ?? {}) };
  for (const def of UPGRADES) {
    const v = out[def.key];
    if (def.levels.includes(v)) continue;
    const lower = def.levels.filter((l) => l <= v);
    out[def.key] = lower.length ? lower[lower.length - 1] : def.levels[0];
  }
  return out;
}

/** Nâng cấp bản lưu cũ: thêm các trường mới với giá trị mặc định. */
export function migrateSave(data: GameState): GameState {
  // Bản lưu cũ chưa có nhân vật: dùng nhân vật mặc định.
  const profile = { ...DEFAULT_PROFILE, ...(data.profile ?? {}) };
  // Bản lưu trước khi có cấp độ: mở đủ cấp cho các món đã có, bỏ qua hướng dẫn ngày đầu.
  syncDishes({ dishes: data.dishes ?? {} } as GameState);
  const unlockedRecipes = (data.unlockedRecipes ?? []).filter((id) => RECIPES[id]);
  const old = data.xp === undefined;
  const state: GameState = {
    ...data,
    profile,
    upgrades: fixUpgrades(data.upgrades),
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
    starter: data.starter ?? 'banh_mi_trung',
    eventResult: data.eventResult ?? null,
    buffs: data.buffs ?? [],
    pending: data.pending ?? [],
    flags: data.flags ?? {},
    eventSeen: data.eventSeen ?? {},
    miniBest: data.miniBest ?? {},
    street: data.street ?? false,
    extraIngredients: data.extraIngredients ?? [],
    run: null,
    phase: data.phase === 'open' ? 'market' : data.phase,
    tickets: data.tickets ?? 0,
    hopeStars: data.hopeStars ?? 0,
    today: data.today ?? emptyTally(),
    diary: data.diary ?? [],
    missions: data.missions ?? { day: 0, special: null, list: [] },
  };
  // Bản lưu trước khi có sổ tay: sinh nhiệm vụ cho ngày đang chơi, Chú Tư giới thiệu sổ tay.
  if (!data.missions) {
    rollMissions(state, defaultRng);
    if (!state.missions.special) state.missions.special = pickSpecial(state, defaultRng);
    if (state.day > 1) state.chefQueue.push({ kind: 'notebook' });
  }
  return state;
}

// ================= Sao lưu tiến độ (xuất / nhập mã) =================

const BACKUP_APP = 'quan-an-cua-toi';
const BACKUP_V = 1;

/** Mã kiểm tra ngắn (djb2) để phát hiện mã bị cắt / sửa. */
function checksum(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Xuất bản lưu thành chuỗi JSON (gồm cả nhật ký, vé, sao). Chỉ nằm trên máy người chơi. */
export function exportSave(state: GameState): string {
  const data = JSON.stringify({ ...state, run: null, phase: state.phase === 'open' ? 'market' : state.phase });
  return JSON.stringify({ app: BACKUP_APP, v: BACKUP_V, sum: checksum(data), data });
}

export type ImportResult = { ok: true; state: GameState } | { ok: false; error: string };

/** Đọc mã sao lưu: kiểm tra đúng game, đúng phiên bản, không bị hỏng; rồi nâng cấp như bản lưu cũ. */
export function importSave(text: string): ImportResult {
  let wrap: { app?: string; v?: number; sum?: string; data?: string };
  try {
    wrap = JSON.parse(text.trim());
  } catch {
    return { ok: false, error: 'Mã không đọc được (bị thiếu chữ?)' };
  }
  if (!wrap || wrap.app !== BACKUP_APP || typeof wrap.data !== 'string') return { ok: false, error: 'Đây không phải mã sao lưu của Quán Ăn Của Tôi' };
  if (wrap.v !== BACKUP_V) return { ok: false, error: 'Mã sao lưu của phiên bản khác' };
  if (checksum(wrap.data) !== wrap.sum) return { ok: false, error: 'Mã bị hỏng hoặc bị sửa' };
  try {
    const data = JSON.parse(wrap.data) as GameState;
    if (data.version !== 1 || typeof data.day !== 'number' || !data.profile) return { ok: false, error: 'Bản lưu không hợp lệ' };
    return { ok: true, state: migrateSave(data) };
  } catch {
    return { ok: false, error: 'Bản lưu không hợp lệ' };
  }
}
