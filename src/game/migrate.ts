import { RECIPES } from './data';
import { DEFAULT_PROFILE } from './profile';
import { syncDishes } from './dishes';
import { xpForRecipes } from './progression';
import { newVendors } from './market';
import { emptyTally, pickSpecial, rollMissions } from './missions';
import { defaultRng } from './helpers';
import type { GameState } from './types';

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
