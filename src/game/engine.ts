import { answerEffect, tickChat } from './chat';
import { introFactor } from './customers';
import { dishMatches, registerDish, resolveCombo } from './dishes';
import { releaseHeldXp, unlockedRoles } from './progression';
import { expireTrend, trendSpawnMult } from './trend';
import { newVendors, resetMarketDay, stockCapacity, stockUnits } from './market';
import { autoClaimAll, emptyTally, rollMissions } from './missions';
import { queueReplyTip } from './reviews';
import { UNLOCK_DAY } from './unlocks';
import {
  BANKRUPT_AT,
  burnAt,
  CLEAN_COOLDOWN_MS,
  CLOSE_HOUR,
  CUSTOMER_PACE,
  DAY_MS,
  DEBT_DUE_DAY,
  INGREDIENT_IDS,
  INGREDIENTS,
  OPEN_HOUR,
  PLAYER_PREP_MS,
  PREP_BATCH,
  RECIPES,
  ROLE_LABEL,
  RENT_PER_DAY,
  START_DEBT,
  START_MONEY,
  START_RECIPES,
  starterOf,
  START_UPGRADES,
  UPGRADES,
  UTILITY_AIRCON,
  UTILITY_PER_STOVE,
} from './data';
import { customerLeavesAngry, makeCustomer, serveDish } from './customers';
import { EVENT_MAP, applyBuffs, maxDayEvents, morningEventChance, resolveEvent, rollEvent, runPending } from './events';
import { setEngineHooks } from './events/kit';
import {
  canMake,
  clamp,
  consumeFor,
  errorRate,
  fairWage,
  formatClock,
  formatMoney,
  handledCustomers,
  log,
  makeStaff,
  menuRecipes,
  changeRep,
  nextId,
  note,
  pick,
  prepIngredients,
  staffSpeed,
  takeStock,
  usableQty,
} from './helpers';
import { DEFAULT_PROFILE } from './profile';
import type {
  CookJob,
  CookSlot,
  Customer,
  DayModifiers,
  DayReport,
  DishQuality,
  GameState,
  IngredientId,
  PlayerProfile,
  RecipeId,
  Rng,
  Staff,
  StaffRole,
  Station,
  Upgrades,
} from './types';

export const MAX_STAFF = 6;
/** Thuê giữa giờ bán: bao lâu sau người mới tới. */
export const HIRE_ARRIVE_MS = 20_000;
/** Nghỉ giải lao dài bao lâu. */
export const BREAK_MS = 40_000;
export const MAX_CARRY = 2;
/** Khách có món đang nấu / đã xong: kiên nhẫn giảm chậm lại còn chừng này. */
export const HANDLED_DECAY = 0.5;

// ================= Khởi tạo =================

function emptyReport(s: Pick<GameState, 'day' | 'reputation'>): DayReport {
  return {
    day: s.day,
    revenue: 0,
    tips: 0,
    ingredientCost: 0,
    wages: 0,
    rent: 0,
    utilities: 0,
    fines: 0,
    otherCosts: 0,
    served: 0,
    lost: 0,
    noSeat: 0,
    wrongDishes: 0,
    burnt: 0,
    staffErrors: 0,
    allergic: 0,
    dashers: 0,
    spoiledValue: 0,
    repStart: s.reputation,
    repEnd: s.reputation,
    reviews: [],
    notes: [],
  };
}

function emptyMods(): DayModifiers {
  return { spawnMult: 1, deliveryMult: 1, priceMult: {}, unavailable: [], sellPriceMult: 1, labels: [] };
}

export interface NewGameOptions {
  starter?: RecipeId;
  profile?: Partial<PlayerProfile>;
}

export function newGame(rng: Rng, opts: NewGameOptions = {}): GameState {
  const st = starterOf(opts.starter);
  const s: GameState = {
    version: 1,
    profile: { ...DEFAULT_PROFILE, ...(opts.profile ?? {}) },
    phase: 'market',
    day: 1,
    money: START_MONEY,
    debt: START_DEBT,
    debtDueDay: DEBT_DUE_DAY,
    debtPaidOnDay: null,
    reputation: 3,
    cleanliness: 100,
    stock: [],
    prices: {} as Record<IngredientId, number>,
    staff: [],
    candidates: [],
    upgrades: { ...START_UPGRADES },
    unlockedRecipes: [st.id, 'tra_da'],
    xp: 0,
    chefQueue: [],
    tutorial: { step: 0, done: false },
    labFails: 0,
    labHints: {},
    dishes: {},
    discovered: [...new Set([st.id, 'tra_da', ...START_RECIPES])],
    starter: st.id,
    extraIngredients: [...st.extra],
    launched: {},
    trend: null,
    vendors: newVendors(),
    tickets: 0,
    hopeStars: 0,
    missions: { day: 0, special: null, list: [] },
    today: emptyTally(),
    diary: [],
    mods: emptyMods(),
    report: emptyReport({ day: 1, reputation: 3 }),
    history: [],
    activeEvent: null,
    eventResult: null,
    buffs: [],
    pending: [],
    flags: {},
    eventSeen: {},
    miniBest: {},
    street: false,
    gameOver: null,
    idSeq: 0,
    run: null,
  };
  beginMarket(s, rng);
  return s;
}

/** Buổi sáng: giá chợ mới, ứng viên mới, có thể có tin tức/sự kiện. */
function beginMarket(s: GameState, rng: Rng) {
  s.phase = 'market';
  s.run = null;
  s.street = false;
  s.mods = emptyMods();
  s.report = emptyReport(s);
  s.boughtToday = {};
  expireTrend(s);
  resetMarketDay(s);
  for (const st of s.staff) {
    st.absent = false;
    st.task = null;
  }
  // Tình huống: hiệu ứng nhiều ngày, hậu quả hẹn hôm nay, gà đẻ trứng; rồi có thể có tình huống buổi sáng.
  s.eventResult = null;
  applyBuffs(s);
  runPending(s, rng);
  if (s.flags?.hen && s.day > s.flags.hen) s.stock.push({ ingredientId: 'trung', qty: 2, expiresOnDay: s.day + INGREDIENTS.trung.shelfLife - 1 });
  if (rng() < morningEventChance(s)) rollEvent(s, 'morning', rng);
  for (const id of INGREDIENT_IDS) {
    const base = INGREDIENTS[id].basePrice * (0.8 + rng() * 0.4) * (s.mods.priceMult[id] ?? 1);
    s.prices[id] = Math.max(100, Math.round(base / 100) * 100);
  }
  // Ứng viên chỉ ở vị trí đã mở theo cấp: mỗi vị trí 1 người thường + 2 sinh viên giá rẻ (tự chọn vai khi thuê).
  const roles = unlockedRoles(s);
  s.candidates = [...roles.map((role) => makeStaff(s, rng, role)), ...(roles.length ? [0, 1].map(() => makeStaff(s, rng, roles[0], true)) : [])];
  // Sổ tay chủ quán: nhiệm vụ + món đặc biệt hôm nay (sau cùng để không đổi dãy ngẫu nhiên phía trên).
  s.today = emptyTally();
  rollMissions(s, rng);
  // Mở dần tính năng (src/game/unlocks.ts): Chú Tư báo đúng sáng hôm đó.
  for (const u of UNLOCK_DAY) if (s.day === u.day) s.chefQueue.push({ kind: 'unlock', key: u.key });
  if (s.day === 2) s.chefQueue.push({ kind: 'notebook' });
}

// ================= Chợ / quản lý (ngoài giờ mở cửa) =================

/** Đang ở chợ: buổi sáng, hoặc chủ quán đi chợ giữa giờ bán. */
export function atMarket(s: GameState): boolean {
  return s.phase === 'market' || (s.phase === 'open' && Boolean(s.run?.ownerAway));
}

/** Mua `qty` phần; `unitPrice` = giá sau khi bớt ở sạp (mặc định giá chợ). Không vượt sức chứa kho. */
export function buy(s: GameState, id: IngredientId, qty: number, unitPrice = s.prices[id]): boolean {
  if (!atMarket(s) || s.mods.unavailable.includes(id)) return false;
  const cost = unitPrice * qty;
  if (qty <= 0 || s.money < cost) return false;
  if (stockUnits(s) + qty > stockCapacity(s)) return false;
  const ing = INGREDIENTS[id];
  const expiresOnDay = s.day + ing.shelfLife - 1 + (ing.perishable ? s.upgrades.fridge : 0);
  const batch = s.stock.find((b) => b.ingredientId === id && b.expiresOnDay === expiresOnDay);
  if (batch) batch.qty += qty;
  else s.stock.push({ ingredientId: id, qty, expiresOnDay });
  s.money -= cost;
  s.report.ingredientCost += cost;
  const today = (s.boughtToday ??= {});
  const prev = today[id];
  today[id] = { qty: (prev?.qty ?? 0) + qty, cost: (prev?.cost ?? 0) + cost, expiresOnDay };
  return true;
}

/** Số phần mua hôm nay còn bớt lại được (còn nguyên trong lô vừa mua). */
export function returnableQty(s: GameState, id: IngredientId): number {
  const b = s.boughtToday?.[id];
  if (!b || !atMarket(s)) return 0;
  const batch = s.stock.find((x) => x.ingredientId === id && x.expiresOnDay === b.expiresOnDay);
  return Math.min(b.qty, batch?.qty ?? 0);
}

/** Bớt đồ mua dư hôm nay: trả lại đúng giá trung bình đã trả. Không trả được đồ mua ngày trước. */
export function unbuy(s: GameState, id: IngredientId, qty: number): boolean {
  const n = Math.min(qty, returnableQty(s, id));
  if (n <= 0) return false;
  const b = s.boughtToday![id]!;
  const batch = s.stock.find((x) => x.ingredientId === id && x.expiresOnDay === b.expiresOnDay)!;
  const refund = Math.round((b.cost / b.qty) * n);
  batch.qty -= n;
  if (batch.qty <= 0) s.stock = s.stock.filter((x) => x !== batch);
  b.qty -= n;
  b.cost -= refund;
  if (b.qty <= 0) delete s.boughtToday![id];
  s.money += refund;
  s.report.ingredientCost -= refund;
  return true;
}

export function discardExpired(s: GameState) {
  s.stock = s.stock.filter((b) => b.expiresOnDay >= s.day);
}

/** Thuê ứng viên. Sinh viên thì chọn vai `role`; thuê giữa giờ bán thì 20 giây sau mới tới. */
export function hire(s: GameState, candidateId: string, role?: StaffRole): boolean {
  const c = s.candidates.find((x) => x.id === candidateId);
  if (!c || s.staff.length >= MAX_STAFF) return false;
  const r = c.student && role ? role : c.role;
  if (!unlockedRoles(s).includes(r)) return false;
  c.role = r;
  s.candidates = s.candidates.filter((x) => x.id !== candidateId);
  if (s.phase === 'open' && s.run) {
    c.lateUntil = s.run.elapsed + HIRE_ARRIVE_MS;
    log(s, `🚶 ${c.name} đang tới quán`, 'info');
  }
  s.staff.push(c);
  return true;
}

/** Sinh viên đổi vai trò: rảnh thì đổi ngay, đang làm dở thì đổi khi xong việc. Nhân viên chính thức giữ chuyên môn. */
export function setStudentRole(s: GameState, staffId: string, role: StaffRole): boolean {
  const st = s.staff.find((x) => x.id === staffId);
  if (!st || !st.student || !unlockedRoles(s).includes(role)) return false;
  if (st.task && s.phase === 'open') {
    st.nextRole = role === st.role ? undefined : role;
  } else {
    st.role = role;
    st.nextRole = undefined;
  }
  return true;
}

/** Cho nghỉ giải lao 40 giây trong giờ bán (mỗi người 1 lần / ngày): tâm trạng +15. */
export function staffBreak(s: GameState, staffId: string): boolean {
  const run = s.run;
  const st = s.staff.find((x) => x.id === staffId);
  if (!run || s.phase !== 'open' || !st || st.absent || run.elapsed < st.lateUntil || run.breaks?.[st.id]) return false;
  if (st.task && st.task.kind !== 'clean' && st.task.kind !== 'break') return false;
  run.breaks = { ...(run.breaks ?? {}), [st.id]: true };
  st.task = { kind: 'break', endsAt: run.elapsed + BREAK_MS };
  st.mood = clamp(st.mood + 15, 0, 100);
  return true;
}

/** Có thể cho nghỉ giải lao lúc này không (để hiện / làm mờ nút). */
export function canBreak(s: GameState, st: Staff): boolean {
  const run = s.run;
  if (!run || s.phase !== 'open' || st.absent || run.elapsed < st.lateUntil || run.breaks?.[st.id]) return false;
  return !st.task || st.task.kind === 'clean';
}

/** Sa thải phải trả thêm 1 ngày lương. Giữa giờ bán: việc dở dang được trả lại (món vẫn ở quầy). */
export function fire(s: GameState, staffId: string) {
  const st = s.staff.find((x) => x.id === staffId);
  if (!st) return;
  if (s.run && st.task?.kind === 'prep' && st.task.ingredientId) {
    s.run.prepped[st.task.ingredientId] = (s.run.prepped[st.task.ingredientId] ?? 0) + (st.task.qty ?? 0);
  }
  st.task = null;
  s.money -= st.wage;
  s.report.wages += st.wage;
  s.staff = s.staff.filter((x) => x.id !== staffId);
  note(s, `Sa thải ${st.name} (trả ${formatMoney(st.wage)} trợ cấp)`);
}

export function raiseWage(s: GameState, staffId: string) {
  const st = s.staff.find((x) => x.id === staffId);
  if (!st) return;
  st.wage = Math.round((st.wage * 1.1) / 10_000) * 10_000;
  st.mood = clamp(st.mood + 15, 0, 100);
}

export function toggleDayOff(s: GameState, staffId: string) {
  const st = s.staff.find((x) => x.id === staffId);
  if (!st || s.phase !== 'market') return;
  st.absent = !st.absent;
}

export function upgradeInfo(s: GameState, key: keyof Upgrades) {
  const def = UPGRADES.find((u) => u.key === key)!;
  const idx = def.levels.indexOf(s.upgrades[key]);
  const cost = def.costs[idx];
  return { def, level: s.upgrades[key], next: def.levels[idx + 1], cost };
}

export function buyUpgrade(s: GameState, key: keyof Upgrades): boolean {
  const { next, cost } = upgradeInfo(s, key);
  if (next === undefined || cost === undefined || s.money < cost) return false;
  s.money -= cost;
  s.report.otherCosts += cost;
  s.upgrades[key] = next;
  return true;
}


export function setProfile(s: GameState, profile: PlayerProfile) {
  s.profile = { ...profile, name: profile.name.trim() || DEFAULT_PROFILE.name, shopName: profile.shopName.trim() || DEFAULT_PROFILE.shopName };
}

export function payDebt(s: GameState, amount: number) {
  const pay = Math.min(amount, s.money, s.debt);
  if (pay <= 0) return;
  s.money -= pay;
  s.debt -= pay;
  if (s.debt === 0 && s.debtPaidOnDay === null) s.debtPaidOnDay = s.day;
}

// ================= Mở cửa =================

export function openShop(s: GameState, rng: Rng) {
  if (s.phase !== 'market' || s.activeEvent || s.gameOver) return;
  const slots: CookSlot[] = [];
  for (let i = 0; i < s.upgrades.stoves; i += 1) slots.push({ id: `stove${i}`, station: 'stove', job: null });
  for (let i = 0; i < s.upgrades.counters; i += 1) slots.push({ id: `counter${i}`, station: 'counter', job: null });
  s.phase = 'open';
  s.run = {
    elapsed: 0,
    sinceLastCustomer: 0,
    customers: [],
    slots,
    pass: [],
    carrying: [],
    ownerAway: false,
    closedNoticeShown: false,
    prepped: {},
    playerPrep: null,
    cleanReadyAt: 0,
    powerOutUntil: 0,
    gasOutUntil: 0,
    eventsFired: [],
    nextEventCheck: 20_000,
    log: [],
  };
  log(s, `🏮 Ngày ${s.day}: ${s.profile.shopName} mở cửa đón khách!`, 'info');
  // Tình huống buổi sáng làm bếp mở trễ.
  if (s.mods.stoveDelay) s.run.powerOutUntil = s.mods.stoveDelay;
  for (const st of s.staff) {
    st.task = null;
    st.lateUntil = 0;
    if (st.absent) continue;
    if (st.trait === 'late' && rng() < 0.4) {
      st.lateUntil = DAY_MS / 6; // đi trễ khoảng 2 tiếng trong game
      log(s, `⏰ ${st.name} lại đi trễ rồi!`, 'bad');
    }
  }
}

function freeSlot(s: GameState, station: Station): CookSlot | undefined {
  const reserved = new Set(s.staff.map((st) => st.task?.slotId).filter(Boolean));
  return s.run!.slots.find((sl) => sl.station === station && !sl.job && !reserved.has(sl.id));
}

function pushDish(s: GameState, recipeId: RecipeId, quality: DishQuality, noGarnish: boolean, by: string) {
  s.run!.pass.push({ id: nextId(s, 'd'), recipeId, quality, noGarnish, by });
  if (quality !== 'burnt') s.today.cooked += 1;
}

// ---------- Hành động của người chơi ----------

/** Chủ quán nấu một món; `slotId` = bếp / quầy cụ thể đang đứng (không có thì lấy chỗ trống đầu tiên). */
export function playerCook(s: GameState, recipeId: RecipeId, noGarnish: boolean, slotId?: string): string | null {
  if (s.phase !== 'open' || !s.run) return 'Quán chưa mở cửa';
  const recipe = RECIPES[recipeId];
  const garnishOff = noGarnish && Boolean(recipe.garnish);
  const chosen = slotId ? s.run.slots.find((x) => x.id === slotId) : undefined;
  const slot = chosen ? (chosen.station === recipe.station && !chosen.job ? chosen : null) : freeSlot(s, recipe.station);
  if (!slot) return recipe.station === 'stove' ? 'Hết bếp trống' : 'Quầy pha chế đang bận';
  if (!canMake(s, recipeId, garnishOff)) return 'Thiếu nguyên liệu (nhớ sơ chế!)';
  consumeFor(s, recipeId, garnishOff);
  slot.job = { recipeId, noGarnish: garnishOff, progress: 0, cookTime: recipe.cookTime, by: 'player' };
  return null;
}

/**
 * Nấu theo nồi tự chọn: tổ hợp nguyên liệu → món (chuẩn / lạ / quái dị). Món lạ được ghi vào sổ món
 * (không tự vào menu). Thiếu hành so với món có hành rắc thêm → nấu dạng "không hành".
 */
export function playerCookCombo(s: GameState, ids: IngredientId[], slotId?: string): string | null {
  if (ids.length === 0) return 'Nồi đang trống';
  const { recipe, noGarnish } = resolveCombo(s, ids);
  const slot = slotId ? s.run?.slots.find((x) => x.id === slotId) : undefined;
  if (slot && slot.station !== recipe.station) return recipe.station === 'counter' ? 'Món này làm ở quầy pha chế' : 'Món này phải nấu trên bếp';
  registerDish(s, recipe);
  const fresh = !s.discovered.includes(recipe.id);
  const err = playerCook(s, recipe.id, noGarnish, slotId);
  if (fresh && !err) {
    s.discovered.push(recipe.id);
    s.today.newDishes += 1;
  } else if (fresh) s.discovered.push(recipe.id);
  return err;
}

/** Nhấc món khỏi bếp: chưa đủ thời gian → sống. `toHand`: cầm luôn trên tay nếu còn tay trống. */
export function playerTakeOut(s: GameState, slotId: string, toHand = false) {
  const run = s.run;
  const slot = run?.slots.find((x) => x.id === slotId);
  const job = slot?.job;
  if (!run || !slot || !job || job.by !== 'player') return;
  const quality: DishQuality = job.progress >= job.cookTime ? 'perfect' : 'raw';
  pushDish(s, job.recipeId, quality, job.noGarnish, 'Bạn');
  slot.job = null;
  if (toHand && run.carrying.length < MAX_CARRY) run.carrying.push(run.pass[run.pass.length - 1].id);
}

// ---------- Cầm món trên tay (chế độ bản đồ) ----------

export function pickUpDish(s: GameState, dishId: string): string | null {
  const run = s.run;
  if (!run || !run.pass.some((d) => d.id === dishId) || run.carrying.includes(dishId)) return null;
  if (run.carrying.length >= MAX_CARRY) return 'Hai tay đã cầm đầy món!';
  const busy = s.staff.some((st) => st.task?.dishId === dishId);
  if (busy) return 'Nhân viên đang mang món này đi rồi';
  run.carrying.push(dishId);
  return null;
}

export function putDownDish(s: GameState, dishId: string) {
  if (s.run) s.run.carrying = s.run.carrying.filter((id) => id !== dishId);
}

export function putDownAll(s: GameState) {
  if (s.run) s.run.carrying = [];
}

/** Mang món đang cầm cho khách: ưu tiên món khớp cả ghi chú "không hành". */
export function serveCarried(s: GameState, customerId: string, rng: Rng): string | null {
  const run = s.run;
  const c = run?.customers.find((x) => x.id === customerId);
  if (!run || !c) return null;
  if (run.carrying.length === 0) return 'Tay không — hãy lấy món ở quầy ra món';
  const open = c.items.filter((i) => !i.served);
  const held = run.carrying.map((id) => run.pass.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => Boolean(d));
  const dish =
    held.find((d) => open.some((i) => i.recipeId === d.recipeId && i.noGarnish === d.noGarnish)) ??
    held.find((d) => open.some((i) => i.recipeId === d.recipeId)) ??
    held[0];
  serveDish(s, dish.id, customerId, rng);
  return null;
}

export function playerPrep(s: GameState, id: IngredientId): string | null {
  const run = s.run;
  if (!run) return 'Quán chưa mở cửa';
  if (run.playerPrep) return 'Đang sơ chế món khác';
  const qty = Math.min(PREP_BATCH, usableQty(s, id));
  if (qty <= 0) return `Hết ${INGREDIENTS[id].name} trong kho`;
  takeStock(s, id, qty);
  run.playerPrep = { ingredientId: id, qty, endsAt: run.elapsed + PLAYER_PREP_MS };
  return null;
}

/** Góc nhìn thứ nhất: mỗi nhát dao rút ngắn thời gian sơ chế. */
export const CHOP_MS = 350;
/** Góc nhìn thứ nhất: mỗi lần khuấy đẩy nhanh tiến độ nấu (không vượt quá lúc chín). */
export const STIR_MS = 250;

export function playerChop(s: GameState) {
  const run = s.run;
  if (!run?.playerPrep) return;
  run.playerPrep.endsAt = Math.max(run.elapsed, run.playerPrep.endsAt - CHOP_MS);
}

export function playerStir(s: GameState, slotId: string) {
  const job = s.run?.slots.find((x) => x.id === slotId)?.job;
  if (!job || job.by !== 'player' || job.progress >= job.cookTime) return;
  job.progress = Math.min(job.cookTime, job.progress + STIR_MS);
}

export function playerServe(s: GameState, dishId: string, customerId: string, rng: Rng) {
  if (!s.run) return;
  serveDish(s, dishId, customerId, rng);
}

/**
 * Tới bàn là tự đưa những món đang cầm khớp đơn của khách (không đưa món cháy,
 * không đưa món có hành cho khách dặn "không hành"). Trả về số món đã đưa.
 */
export function autoServeCarried(s: GameState, customerIds: string[], rng: Rng): number {
  const run = s.run;
  if (!run) return 0;
  let served = 0;
  for (const cid of customerIds) {
    for (;;) {
      const c = run.customers.find((x) => x.id === cid);
      if (!c) break;
      const dish = run.carrying
        .map((id) => run.pass.find((d) => d.id === id))
        .find((d) => d && d.quality !== 'burnt' && c.items.some((i) => !i.served && dishMatches(i.recipeId, d) && (!i.noGarnish || d.noGarnish)));
      if (!dish) break;
      serveDish(s, dish.id, cid, rng);
      served += 1;
    }
  }
  return served;
}

export function discardDish(s: GameState, dishId: string) {
  if (!s.run) return;
  s.run.pass = s.run.pass.filter((d) => d.id !== dishId);
  s.run.carrying = s.run.carrying.filter((id) => id !== dishId);
}

export function playerClean(s: GameState) {
  const run = s.run;
  if (!run || run.elapsed < run.cleanReadyAt) return;
  s.cleanliness = clamp(s.cleanliness + 20, 0, 100);
  run.cleanReadyAt = run.elapsed + CLEAN_COOLDOWN_MS;
}

export function chooseEventOption(s: GameState, index: number, rng: Rng, score?: number) {
  resolveEvent(s, index, rng, score);
}

/** Đóng thẻ kết quả tình huống — đồng hồ chạy tiếp. */
export function dismissEventResult(s: GameState) {
  s.eventResult = null;
}

// ---------- Nhân viên tự làm việc ----------

/** Số phần của món còn thiếu = khách đang chờ − món đã/đang làm. */
function outstanding(s: GameState, recipeId: RecipeId): number {
  const run = s.run!;
  const need = run.customers.reduce((sum, c) => sum + c.items.filter((i) => !i.served && i.recipeId === recipeId).length, 0);
  const onPass = run.pass.filter((d) => d.recipeId === recipeId && d.quality !== 'burnt').length;
  const cooking = run.slots.filter((sl) => sl.job && (sl.job.intendedRecipe ?? sl.job.recipeId) === recipeId).length;
  const starting = s.staff.filter((st) => st.task?.kind === 'cook_start' && st.task.recipeId === recipeId).length;
  return need - onPass - cooking - starting;
}

function gainExp(st: Staff) {
  st.exp += 1;
  if (st.exp % 12 === 0 && st.skill < 95) st.skill += 1;
}

function staffError(s: GameState, st: Staff, rng: Rng) {
  return rng() < errorRate(s, st);
}

function startStaffTask(s: GameState, st: Staff, rng: Rng) {
  const run = s.run!;
  const t = run.elapsed;
  const speed = staffSpeed(st);

  if (st.role === 'prep') {
    const candidates = prepIngredients(s)
      .filter((id) => usableQty(s, id) > 0 && (run.prepped[id] ?? 0) < 4)
      .sort((a, b) => (run.prepped[a] ?? 0) - (run.prepped[b] ?? 0));
    const id = candidates[0];
    if (!id) return;
    const qty = Math.min(PREP_BATCH, usableQty(s, id));
    takeStock(s, id, qty);
    st.task = { kind: 'prep', endsAt: t + 3_000 / speed, ingredientId: id, qty, error: staffError(s, st, rng) ? 'waste' : undefined };
    return;
  }

  if (st.role === 'cook') {
    const waiting = [...run.customers].sort((a, b) => a.arrivedAt - b.arrivedAt);
    for (const c of waiting) {
      for (const item of c.items) {
        if (item.served) continue;
        const recipe = RECIPES[item.recipeId];
        if (outstanding(s, item.recipeId) <= 0) continue;
        const noGarnish = item.noGarnish && Boolean(recipe.garnish);
        if (!canMake(s, item.recipeId, noGarnish)) continue;
        const slot = freeSlot(s, recipe.station);
        if (!slot) continue;
        let error: 'wrong_recipe' | 'burn' | 'forgot_note' | undefined;
        if (staffError(s, st, rng)) {
          const roll = rng();
          if (roll < 0.4) error = 'wrong_recipe';
          else if (roll < 0.7 && recipe.burns) error = 'burn';
          else error = noGarnish ? 'forgot_note' : recipe.burns ? 'burn' : 'wrong_recipe';
        }
        st.task = { kind: 'cook_start', endsAt: t + 800 / speed, recipeId: item.recipeId, noGarnish, slotId: slot.id, error };
        return;
      }
    }
    return;
  }

  // Phục vụ: bỏ món cháy, mang món cho khách, rảnh thì lau dọn.
  const burnt = run.pass.find((d) => d.quality === 'burnt' && !run.carrying.includes(d.id));
  if (burnt) {
    run.pass = run.pass.filter((d) => d.id !== burnt.id);
    log(s, `🗑️ ${st.name} bỏ món ${RECIPES[burnt.recipeId].name} bị cháy`, 'info');
    return;
  }
  const taken = new Set([...s.staff.map((x) => x.task?.dishId).filter(Boolean), ...run.carrying]);
  const waiting = [...run.customers].sort((a, b) => a.arrivedAt - b.arrivedAt);
  for (const dish of run.pass) {
    if (taken.has(dish.id)) continue;
    const target = waiting.find((c) => c.items.some((i) => !i.served && i.recipeId === dish.recipeId && i.noGarnish === dish.noGarnish))
      ?? waiting.find((c) => c.items.some((i) => !i.served && i.recipeId === dish.recipeId));
    if (!target) continue;
    let customerId = target.id;
    let error: 'wrong_table' | 'spill' | 'trip' | undefined;
    if (staffError(s, st, rng)) {
      // Sinh viên vụng về hay vấp té / đổ thức ăn; người có kinh nghiệm thường chỉ nhầm bàn.
      const roll = rng();
      const [trip, spill] = st.student ? [0.4, 0.3] : [0.15, 0.15];
      if (roll < trip) error = 'trip';
      else if (roll < trip + spill) error = 'spill';
      else if (waiting.length > 1) {
        error = 'wrong_table';
        customerId = pick(rng, waiting.filter((c) => c.id !== target.id)).id;
      }
    }
    st.task = { kind: 'serve', endsAt: t + 1_500 / speed, dishId: dish.id, customerId, error };
    return;
  }
  if (s.cleanliness < 75) {
    st.task = { kind: 'clean', endsAt: t + 2_500 / speed };
  }
}

function finishStaffTask(s: GameState, st: Staff, rng: Rng) {
  const run = s.run!;
  const task = st.task!;
  st.task = null;
  if (task.kind === 'break') {
    log(s, `☕ ${st.name} nghỉ xong, quay lại làm việc`, 'info');
    return;
  }
  gainExp(st);

  if (task.kind === 'prep' && task.ingredientId) {
    const qty = task.qty ?? PREP_BATCH;
    const name = INGREDIENTS[task.ingredientId].name;
    if (task.error === 'waste') {
      const good = Math.max(0, qty - 2);
      run.prepped[task.ingredientId] = (run.prepped[task.ingredientId] ?? 0) + good;
      s.today.prepped += good;
      s.report.staffErrors += 1;
      log(s, `🔪 ${st.name} sơ chế ẩu, làm hỏng ${qty - good} phần ${name}`, 'bad');
    } else {
      run.prepped[task.ingredientId] = (run.prepped[task.ingredientId] ?? 0) + qty;
      s.today.prepped += qty;
    }
    return;
  }

  if (task.kind === 'cook_start' && task.recipeId && task.slotId) {
    const slot = run.slots.find((x) => x.id === task.slotId);
    if (!slot || slot.job) return;
    let recipeId = task.recipeId;
    let noGarnish = task.noGarnish ?? false;
    let intendedRecipe: RecipeId | undefined;
    if (task.error === 'wrong_recipe') {
      const others = menuRecipes(s).filter((r) => r.station === slot.station && r.id !== recipeId && canMake(s, r.id, false));
      if (others.length) {
        intendedRecipe = recipeId;
        recipeId = pick(rng, others).id;
        noGarnish = false;
      }
    }
    if (task.error === 'forgot_note') noGarnish = false;
    if (!canMake(s, recipeId, noGarnish)) return;
    consumeFor(s, recipeId, noGarnish);
    const job: CookJob = {
      recipeId,
      noGarnish,
      progress: 0,
      cookTime: RECIPES[recipeId].cookTime,
      by: st.id,
      burnError: task.error === 'burn',
      intendedRecipe,
    };
    slot.job = job;
    if (intendedRecipe) {
      s.report.staffErrors += 1;
      log(s, `🤦 ${st.name} nghe nhầm, nấu ${RECIPES[recipeId].name} thay vì ${RECIPES[intendedRecipe].name}`, 'bad');
    }
    if (task.error === 'forgot_note') {
      s.report.staffErrors += 1;
      log(s, `📝 ${st.name} quên ghi chú "không hành" khi nấu ${RECIPES[recipeId].name}!`, 'bad');
    }
    return;
  }

  if (task.kind === 'serve' && task.dishId && task.customerId) {
    const c = run.customers.find((x) => x.id === task.customerId);
    const dish = run.pass.find((d) => d.id === task.dishId);
    const incident = (kind: 'trip' | 'spill' | 'wrong') =>
      (run.incidents ??= []).push({
        id: nextId(s, 'inc'),
        kind,
        staffId: st.id,
        customerId: c?.id,
        tableIndex: c?.tableIndex,
        dish: dish ? dish.recipeId : '',
        at: run.elapsed,
      });
    if ((task.error === 'trip' || task.error === 'spill') && dish) {
      // Món rơi mất: phải nấu lại.
      run.pass = run.pass.filter((d) => d.id !== dish.id);
      s.report.staffErrors += 1;
      if (task.error === 'trip') {
        s.report.trips = (s.report.trips ?? 0) + 1;
        incident('trip');
        log(s, `💥 ${st.name}${st.student ? ' (sinh viên)' : ''} vấp té, làm rơi vỡ ${RECIPES[dish.recipeId]?.name ?? 'món'}!`, 'bad');
        // Nằm dưới đất 1,5 giây rồi mới đứng dậy.
        st.task = { kind: 'fallen', endsAt: run.elapsed + 1_500, customerId: task.customerId };
      } else if (c) {
        s.report.spills = (s.report.spills ?? 0) + 1;
        incident('spill');
        c.patience -= c.maxPatience * 0.5;
        c.chat = { icon: '😡', text: 'Ướt hết áo tôi rồi!! 💦', until: run.elapsed + 4000 };
        changeRep(s, -0.1);
        log(s, `💦 ${st.name}${st.student ? ' (sinh viên)' : ''} đổ ${RECIPES[dish.recipeId]?.name ?? 'món'} lên người ${c.name}!`, 'bad');
      }
      return;
    }
    if (task.error === 'wrong_table') {
      s.report.staffErrors += 1;
      if (c) {
        incident('wrong');
        c.chat = { icon: '🤨', text: 'Tôi đâu có gọi món này?', until: run.elapsed + 3500 };
      }
    }
    serveDish(s, task.dishId, task.customerId, rng, st);
    return;
  }

  if (task.kind === 'clean') {
    s.cleanliness = clamp(s.cleanliness + 12, 0, 100);
  }
}

// ---------- Vòng lặp thời gian ----------

function hourAt(elapsed: number) {
  return OPEN_HOUR + ((CLOSE_HOUR - OPEN_HOUR) * elapsed) / DAY_MS;
}

/** Độ đông khách theo giờ: sáng, trưa, tối là cao điểm. */
export function trafficCurve(hour: number): number {
  if (hour < 8) return 0.4;
  if (hour < 9) return 0.8;
  if (hour < 11) return 0.5;
  if (hour < 13) return 1.7;
  if (hour < 17) return 0.5;
  if (hour < 20) return 1.5;
  return 0.6;
}

export function isPeak(elapsed: number) {
  return trafficCurve(hourAt(elapsed)) >= 1.5;
}

/** Nhân viên đang có mặt ở quán (không nghỉ, không đi trễ). */
export function staffOnDuty(s: GameState): Staff[] {
  const t = s.run?.elapsed ?? 0;
  return s.staff.filter((st) => !st.absent && t >= st.lateUntil);
}

/** Chủ đi chợ mà không có nhân viên nào trông: quán treo biển tạm đóng. */
export function shopClosed(s: GameState): boolean {
  return Boolean(s.run?.ownerAway) && staffOnDuty(s).length === 0;
}

/** Đi chợ giữa giờ bán: đặt hết món đang cầm xuống quầy. */
export function leaveForMarket(s: GameState) {
  const run = s.run;
  if (s.phase !== 'open' || !run || run.ownerAway) return;
  run.carrying = [];
  run.ownerAway = true;
  run.closedNoticeShown = false;
  if (staffOnDuty(s).length === 0) {
    run.closedNoticeShown = true;
    log(s, '🚪 Chủ quán đi chợ — chưa có nhân viên nên quán treo biển tạm đóng', 'bad');
  } else {
    log(s, '🛒 Chủ quán đi chợ, nhân viên trông quán', 'info');
  }
}

export function returnToShop(s: GameState) {
  s.street = false;
  const run = s.run;
  if (!run || !run.ownerAway) return;
  run.ownerAway = false;
  log(s, '🏃 Chủ quán đã về quán', 'info');
}

/**
 * Ra khu phố. Giờ bán: như đi chợ giữa giờ (nhân viên trông quán, không có ai thì quán tạm đóng).
 * Buổi sáng: chỉ là đi dạo, quay lại vẫn ở bước chuẩn bị.
 */
export function goStreet(s: GameState, from: 'shop' | 'market' = 'shop') {
  if (s.phase === 'summary') return;
  if (s.phase === 'open' && s.run && !s.run.ownerAway) {
    leaveForMarket(s);
    s.run.carrying = [];
  }
  s.street = true;
  s.streetFrom = from;
}

/** Từ khu phố vào một nơi: 'shop' về quán, 'market' vào chợ (các nơi khác mở màn riêng, vẫn đứng ngoài phố). */
export function streetGo(s: GameState, place: 'shop' | 'market') {
  if (!s.street) return;
  if (place === 'shop') {
    if (s.phase === 'open') returnToShop(s);
    s.street = false;
    return;
  }
  s.street = false;
}

function spawnCustomers(s: GameState, dt: number, rng: Rng) {
  const run = s.run!;
  if (run.elapsed > DAY_MS - 8_000) return;
  if (shopClosed(s)) {
    if (!run.closedNoticeShown) {
      run.closedNoticeShown = true;
      log(s, '🚪 Nhân viên nghỉ hết — quán treo biển tạm đóng', 'bad');
    }
    return;
  }
  run.sinceLastCustomer += dt;
  const intro = introFactor(s.day);
  const rate =
    0.14 * trafficCurve(hourAt(run.elapsed)) * (0.4 + s.reputation * 0.25) * (1 + 0.15 * s.upgrades.sign) * s.mods.spawnMult * intro * trendSpawnMult(s) * CUSTOMER_PACE;
  // Đang hướng dẫn ngày đầu: khách đầu tiên tới sớm (~10 giây) để kịp học mang món.
  // Quán vắng tối đa ~25 giây thì chắc chắn có khách mới.
  const tutorialWait = s.day === 1 && !s.tutorial?.done ? 10_000 : Math.min(25_000, (15_000 / intro) * (DAY_MS / 180_000));
  const force = run.sinceLastCustomer > tutorialWait && run.customers.length === 0;
  if (!force && rng() >= (rate * dt) / 1000) return;
  const c = makeCustomer(s, rng);
  if (!c) return;
  run.sinceLastCustomer = 0;
  seatCustomer(s, c);
}

/** Số bàn dùng được hôm nay (tình huống có thể làm mất / thêm bàn). */
export function seatsToday(s: GameState): number {
  return Math.max(1, Math.min(s.upgrades.seats, s.upgrades.seats + (s.mods.seatDelta ?? 0)));
}

/** Xếp khách vào bàn trống (hết bàn thì khách bỏ đi). Trả về true nếu khách ở lại. */
function seatCustomer(s: GameState, c: Customer): boolean {
  const run = s.run!;
  const seats = seatsToday(s);
  const dineIn = run.customers.filter((x) => x.kind !== 'delivery' && x.kind !== 'group').length;
  if (c.kind !== 'delivery' && c.kind !== 'group' && dineIn >= seats) {
    s.report.noSeat += 1;
    log(s, `🚶 Hết chỗ ngồi, một khách bỏ đi`, 'bad');
    return false;
  }
  if (c.kind !== 'delivery' && c.kind !== 'group') {
    const used = new Set(run.customers.map((x) => x.tableIndex));
    for (let i = 0; i < seats; i += 1) {
      if (!used.has(i)) {
        c.tableIndex = i;
        break;
      }
    }
  }
  run.customers.push(c);
  return true;
}

/** Tình huống: thêm `n` khách ngay (khách thường). */
export function spawnGuests(s: GameState, rng: Rng, n: number): number {
  if (!s.run) return 0;
  let seated = 0;
  for (let i = 0; i < n; i += 1) {
    const c = makeCustomer(s, rng);
    if (c && seatCustomer(s, c)) seated += 1;
  }
  return seated;
}

function maybeDayEvent(s: GameState, rng: Rng) {
  const run = s.run!;
  if (s.activeEvent || run.elapsed < run.nextEventCheck) return;
  // Khoảng 18 lần xét mỗi ngày, bất kể ngày dài bao lâu.
  run.nextEventCheck = run.elapsed + DAY_MS / 18;
  // 1–2 tình huống mỗi ngày: tối đa `maxDayEvents` lần, cách nhau ít nhất 90 giây; ngày 1–2 không có.
  if (run.eventsFired.length >= maxDayEvents(s) || run.elapsed > DAY_MS - 20_000) return;
  if (run.elapsed - (run.lastEventAt ?? -Infinity) < 90_000) return;
  if (rng() >= 0.07) return;
  const ev = rollEvent(s, 'day', rng, run.eventsFired);
  if (ev) {
    run.eventsFired.push(ev.id);
    run.lastEventAt = run.elapsed;
  }
}

/** Tiến thời gian `dt` ms. Dừng khi có sự kiện cần người chơi quyết định. */
export function tick(s: GameState, dt: number, rng: Rng) {
  const run = s.run;
  if (s.phase !== 'open' || !run || s.activeEvent || s.eventResult) return;
  run.elapsed += dt;
  const t = run.elapsed;

  // Bếp & quầy
  const stoveBlocked = t < run.powerOutUntil || t < run.gasOutUntil;
  for (const slot of run.slots) {
    const job = slot.job;
    if (!job) continue;
    if (slot.station === 'stove' && stoveBlocked) continue;
    job.progress += dt;
    const recipe = RECIPES[job.recipeId];
    if (job.by === 'player') {
      if (!recipe.burns && job.progress >= job.cookTime) {
        pushDish(s, job.recipeId, 'perfect', job.noGarnish, 'Bạn');
        slot.job = null;
      } else if (recipe.burns && job.progress >= burnAt(job.cookTime)) {
        s.report.burnt += 1;
        log(s, `🔥 ${recipe.name} để quá lâu, cháy khét phải bỏ!`, 'bad');
        slot.job = null;
      }
      continue;
    }
    const cook = s.staff.find((x) => x.id === job.by);
    const byName = cook?.name ?? 'Nhân viên';
    if (job.burnError && job.progress >= burnAt(job.cookTime)) {
      s.report.burnt += 1;
      s.report.staffErrors += 1;
      pushDish(s, job.recipeId, 'burnt', job.noGarnish, byName);
      log(s, `🔥 ${byName} mải việc khác, để cháy ${recipe.name}!`, 'bad');
      slot.job = null;
    } else if (!job.burnError && job.progress >= job.cookTime) {
      pushDish(s, job.recipeId, 'perfect', job.noGarnish, byName);
      slot.job = null;
    }
  }

  // Người chơi sơ chế
  if (run.playerPrep && t >= run.playerPrep.endsAt) {
    const { ingredientId, qty } = run.playerPrep;
    run.prepped[ingredientId] = (run.prepped[ingredientId] ?? 0) + qty;
    s.today.prepped += qty;
    run.playerPrep = null;
  }

  // Nhân viên
  for (const st of [...s.staff]) {
    if (st.absent || t < st.lateUntil) continue;
    if (st.task) {
      if (t >= st.task.endsAt) finishStaffTask(s, st, rng);
    }
    if (!st.task && st.nextRole) {
      log(s, `🔄 ${st.name} chuyển sang ${ROLE_LABEL[st.nextRole]}`, 'info');
      st.role = st.nextRole;
      st.nextRole = undefined;
    }
    if (!st.task) startStaffTask(s, st, rng);
  }

  // Khách mất kiên nhẫn (quán bẩn thì nhanh chán hơn)
  // Món của khách đang nấu / đã xong thì khách chờ thong thả hơn (giảm một nửa).
  const decay = dt * (s.cleanliness < 40 ? 1.3 : 1);
  const handled = handledCustomers(run);
  for (const c of [...run.customers]) {
    c.patience -= handled.has(c.id) ? decay * HANDLED_DECAY : decay;
    if (c.patience <= 0) customerLeavesAngry(s, c, rng);
  }

  spawnCustomers(s, dt, rng);
  tickChat(s, dt, rng);
  if (run.incidents?.length) run.incidents = run.incidents.filter((i) => t - i.at < 3_000);
  maybeDayEvent(s, rng);

  if (t >= DAY_MS) closeDay(s);
}

// ================= Đóng cửa & sang ngày =================

/** Nghỉ sớm: đóng cửa ngay, sang tổng kết (khách đang ngồi ra về, tiền mặt bằng / lương vẫn tính đủ). */
export function closeEarly(s: GameState): boolean {
  if (s.phase !== 'open' || !s.run || s.run.ownerAway) return false;
  note(s, `🌙 Nghỉ sớm lúc ${formatClock(s.run.elapsed, DAY_MS, OPEN_HOUR, CLOSE_HOUR)}`);
  closeDay(s);
  return true;
}

export function closeDay(s: GameState) {
  const run = s.run;
  if (!run) return;
  if (run.customers.length) note(s, `${run.customers.length} khách còn lại lúc đóng cửa đã ra về`);
  const leftoverPrep = Object.values(run.prepped).reduce((a, b) => a + (b ?? 0), 0);
  if (leftoverPrep > 0) note(s, `Bỏ ${leftoverPrep} phần nguyên liệu đã sơ chế nhưng không dùng hết`);

  const wages = s.staff.reduce((sum, st) => sum + st.wage, 0);
  const utilities = s.upgrades.stoves * UTILITY_PER_STOVE + s.upgrades.aircon * UTILITY_AIRCON;
  // Ngày làm quen: chủ nhà giảm tiền mặt bằng tương ứng lượng khách ít hơn.
  const rent = Math.round((RENT_PER_DAY * introFactor(s.day) * (s.mods.rentMult ?? 1)) / 1000) * 1000;
  // Tình huống: xe đẩy bán thêm (+%) / nhà đầu tư chia lãi (−%).
  const bonus = Math.round(s.report.revenue * (s.mods.revenueBonus ?? 0));
  if (bonus > 0) {
    s.money += bonus;
    s.report.revenue += bonus;
  } else if (bonus < 0) {
    s.money += bonus;
    s.report.otherCosts -= bonus;
  }
  s.money -= wages + rent + utilities;
  s.report.wages += wages;
  s.report.rent += rent;
  s.report.utilities += utilities;

  // Đồ sẽ hỏng vào ngày mai (vẫn nằm trong kho tới khi bạn vứt đi).
  s.report.spoiledValue = s.stock
    .filter((b) => b.expiresOnDay === s.day)
    .reduce((sum, b) => sum + b.qty * INGREDIENTS[b.ingredientId].basePrice, 0);

  s.cleanliness = clamp(s.cleanliness + 30, 0, 100);

  for (const st of [...s.staff]) {
    st.task = null;
    if (st.absent) {
      st.mood = clamp(st.mood + 5, 0, 100);
      continue;
    }
    st.daysWorked += 1;
    const fair = fairWage(st.skill);
    let delta = st.wage < fair * 0.9 ? -8 : st.wage > fair * 1.1 ? 4 : 1;
    if (s.report.served > 25) delta -= 3;
    if (st.trait === 'lazy') delta -= 3;
    st.mood = clamp(st.mood + delta, 0, 100);
    if (st.mood < 15) {
      s.staff = s.staff.filter((x) => x.id !== st.id);
      note(s, `😤 ${st.name} chán việc và xin nghỉ hẳn`);
    }
  }

  s.report.repEnd = s.reputation;
  queueReplyTip(s);
  s.history.push(s.report);
  if (s.history.length > 30) s.history.shift();
  s.run = null;
  s.activeEvent = null;
  s.phase = 'summary';
  s.street = false;

  if (s.money < BANKRUPT_AT) s.gameOver = 'bankrupt';
  else if (s.day >= s.debtDueDay && s.debt > 0) s.gameOver = 'debt';
}

/**
 * Chủ quán trả lời câu hỏi của khách: hợp ý thì khách chờ lâu hơn và boa thêm, trả lời phũ thì khách kém vui.
 */
export function answerChat(s: GameState, customerId: string, answerIndex: number): 'good' | 'ok' | 'bad' | null {
  const run = s.run;
  const c = run?.customers.find((x) => x.id === customerId);
  if (!run || !c?.question) return null;
  const eff = answerEffect(c.question.id, answerIndex);
  if (!eff) return null;
  c.question = undefined;
  const bump = eff.effect === 'good' ? 0.25 : eff.effect === 'ok' ? 0.1 : -0.1;
  c.patience = Math.max(1000, Math.min(c.maxPatience * 1.3, c.patience + c.maxPatience * bump));
  if (eff.effect === 'good') c.tipBonus = (c.tipBonus ?? 0) + 0.2;
  c.chat = { text: eff.reply, icon: eff.effect === 'good' ? '😊' : eff.effect === 'ok' ? '🙂' : '😒', until: run.elapsed + 4000 };
  log(s, `💬 ${c.name}: ${eff.reply}`, eff.effect === 'bad' ? 'bad' : 'good');
  return eff.effect;
}

export function nextDay(s: GameState, rng: Rng) {
  if (s.phase !== 'summary' || s.gameOver) return;
  autoClaimAll(s);
  s.day += 1;
  beginMarket(s, rng);
  releaseHeldXp(s);
}

export function currentEvent(s: GameState) {
  return s.activeEvent ? EVENT_MAP[s.activeEvent.defId] : null;
}

// Tình huống gọi ngược vào engine (thêm khách, đơn lớn, nghỉ sớm) mà không tạo vòng import lúc nạp.
setEngineHooks({
  spawn: spawnGuests,
  order: (s, rng, recipeId, qty) => {
    const c = makeCustomer(s, rng, 'group', { recipeId, qty });
    if (c) s.run?.customers.push(c);
  },
  close: (s) => void closeEarly(s),
});
