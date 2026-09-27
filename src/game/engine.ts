import {
  BANKRUPT_AT,
  BURN_FACTOR,
  CLEAN_COOLDOWN_MS,
  CLOSE_HOUR,
  DAY_MS,
  DEBT_DUE_DAY,
  INGREDIENT_IDS,
  INGREDIENTS,
  OPEN_HOUR,
  PLAYER_PREP_MS,
  PREP_BATCH,
  RECIPES,
  RENT_PER_DAY,
  START_DEBT,
  START_MONEY,
  START_RECIPES,
  START_UPGRADES,
  UPGRADES,
  UTILITY_AIRCON,
  UTILITY_PER_STOVE,
} from './data';
import { customerLeavesAngry, makeCustomer, serveDish } from './customers';
import { EVENT_MAP, resolveEvent, rollEvent } from './events';
import {
  canMake,
  clamp,
  consumeFor,
  errorRate,
  fairWage,
  formatMoney,
  log,
  makeStaff,
  menuRecipes,
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
  DayModifiers,
  DayReport,
  DishQuality,
  GameState,
  IngredientId,
  PlayerProfile,
  RecipeId,
  Rng,
  Staff,
  Station,
  Upgrades,
} from './types';

export const MAX_STAFF = 6;
export const MAX_CARRY = 2;

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

export function newGame(rng: Rng): GameState {
  const s: GameState = {
    version: 1,
    profile: { ...DEFAULT_PROFILE },
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
    unlockedRecipes: [...START_RECIPES],
    mods: emptyMods(),
    report: emptyReport({ day: 1, reputation: 3 }),
    history: [],
    activeEvent: null,
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
  s.mods = emptyMods();
  s.report = emptyReport(s);
  for (const st of s.staff) {
    st.absent = false;
    st.task = null;
  }
  if (s.day > 1 && rng() < 0.55) rollEvent(s, 'morning', rng);
  for (const id of INGREDIENT_IDS) {
    const base = INGREDIENTS[id].basePrice * (0.8 + rng() * 0.4) * (s.mods.priceMult[id] ?? 1);
    s.prices[id] = Math.max(100, Math.round(base / 100) * 100);
  }
  s.candidates = Array.from({ length: 3 }, () => makeStaff(s, rng));
}

// ================= Chợ / quản lý (ngoài giờ mở cửa) =================

export function buy(s: GameState, id: IngredientId, qty: number): boolean {
  if (s.phase !== 'market' || s.mods.unavailable.includes(id)) return false;
  const cost = s.prices[id] * qty;
  if (qty <= 0 || s.money < cost) return false;
  const ing = INGREDIENTS[id];
  const expiresOnDay = s.day + ing.shelfLife - 1 + (ing.perishable ? s.upgrades.fridge : 0);
  const batch = s.stock.find((b) => b.ingredientId === id && b.expiresOnDay === expiresOnDay);
  if (batch) batch.qty += qty;
  else s.stock.push({ ingredientId: id, qty, expiresOnDay });
  s.money -= cost;
  s.report.ingredientCost += cost;
  return true;
}

export function discardExpired(s: GameState) {
  s.stock = s.stock.filter((b) => b.expiresOnDay >= s.day);
}

export function hire(s: GameState, candidateId: string): boolean {
  const c = s.candidates.find((x) => x.id === candidateId);
  if (!c || s.staff.length >= MAX_STAFF) return false;
  s.candidates = s.candidates.filter((x) => x.id !== candidateId);
  s.staff.push(c);
  return true;
}

/** Sa thải phải trả thêm 1 ngày lương. */
export function fire(s: GameState, staffId: string) {
  const st = s.staff.find((x) => x.id === staffId);
  if (!st) return;
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

export function unlockRecipe(s: GameState, id: RecipeId): boolean {
  const r = RECIPES[id];
  if (!r.unlock || s.unlockedRecipes.includes(id)) return false;
  if (s.reputation < r.unlock.reputation || s.money < r.unlock.cost) return false;
  s.money -= r.unlock.cost;
  s.report.otherCosts += r.unlock.cost;
  s.unlockedRecipes.push(id);
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
  for (const st of s.staff) {
    st.task = null;
    st.lateUntil = 0;
    if (st.absent) continue;
    if (st.trait === 'late' && rng() < 0.4) {
      st.lateUntil = 30_000;
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
}

// ---------- Hành động của người chơi ----------

export function playerCook(s: GameState, recipeId: RecipeId, noGarnish: boolean): string | null {
  if (s.phase !== 'open' || !s.run) return 'Quán chưa mở cửa';
  const recipe = RECIPES[recipeId];
  const garnishOff = noGarnish && Boolean(recipe.garnish);
  const slot = freeSlot(s, recipe.station);
  if (!slot) return recipe.station === 'stove' ? 'Hết bếp trống' : 'Quầy pha chế đang bận';
  if (!canMake(s, recipeId, garnishOff)) return 'Thiếu nguyên liệu (nhớ sơ chế!)';
  consumeFor(s, recipeId, garnishOff);
  slot.job = { recipeId, noGarnish: garnishOff, progress: 0, cookTime: recipe.cookTime, by: 'player' };
  return null;
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
        .find((d) => d && d.quality !== 'burnt' && c.items.some((i) => !i.served && i.recipeId === d.recipeId && (!i.noGarnish || d.noGarnish)));
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

export function chooseEventOption(s: GameState, index: number, rng: Rng) {
  resolveEvent(s, index, rng);
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
    let error: 'wrong_table' | undefined;
    if (staffError(s, st, rng) && waiting.length > 1) {
      error = 'wrong_table';
      customerId = pick(rng, waiting.filter((c) => c.id !== target.id)).id;
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
  gainExp(st);

  if (task.kind === 'prep' && task.ingredientId) {
    const qty = task.qty ?? PREP_BATCH;
    const name = INGREDIENTS[task.ingredientId].name;
    if (task.error === 'waste') {
      const good = Math.max(0, qty - 2);
      run.prepped[task.ingredientId] = (run.prepped[task.ingredientId] ?? 0) + good;
      s.report.staffErrors += 1;
      log(s, `🔪 ${st.name} sơ chế ẩu, làm hỏng ${qty - good} phần ${name}`, 'bad');
    } else {
      run.prepped[task.ingredientId] = (run.prepped[task.ingredientId] ?? 0) + qty;
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
    if (task.error === 'wrong_table') s.report.staffErrors += 1;
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

function spawnCustomers(s: GameState, dt: number, rng: Rng) {
  const run = s.run!;
  if (run.elapsed > DAY_MS - 8_000) return;
  run.sinceLastCustomer += dt;
  const rate =
    0.14 * trafficCurve(hourAt(run.elapsed)) * (0.4 + s.reputation * 0.25) * (1 + 0.15 * s.upgrades.sign) * s.mods.spawnMult * (s.day <= 2 ? 0.8 : 1);
  const force = run.sinceLastCustomer > 15_000 && run.customers.length === 0;
  if (!force && rng() >= (rate * dt) / 1000) return;
  const c = makeCustomer(s, rng);
  if (!c) return;
  run.sinceLastCustomer = 0;
  const dineIn = run.customers.filter((x) => x.kind !== 'delivery' && x.kind !== 'group').length;
  if (c.kind !== 'delivery' && dineIn >= s.upgrades.seats) {
    s.report.noSeat += 1;
    log(s, `🚶 Hết chỗ ngồi, một khách bỏ đi`, 'bad');
    return;
  }
  if (c.kind !== 'delivery' && c.kind !== 'group') {
    const used = new Set(run.customers.map((x) => x.tableIndex));
    for (let i = 0; i < s.upgrades.seats; i += 1) {
      if (!used.has(i)) {
        c.tableIndex = i;
        break;
      }
    }
  }
  run.customers.push(c);
}

function maybeDayEvent(s: GameState, rng: Rng) {
  const run = s.run!;
  if (s.activeEvent || run.elapsed < run.nextEventCheck) return;
  run.nextEventCheck = run.elapsed + 10_000;
  if (run.eventsFired.length >= 3 || run.elapsed > DAY_MS - 20_000) return;
  if (rng() >= 0.2) return;
  const ev = rollEvent(s, 'day', rng, run.eventsFired);
  if (ev) run.eventsFired.push(ev.id);
}

/** Tiến thời gian `dt` ms. Dừng khi có sự kiện cần người chơi quyết định. */
export function tick(s: GameState, dt: number, rng: Rng) {
  const run = s.run;
  if (s.phase !== 'open' || !run || s.activeEvent) return;
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
      } else if (recipe.burns && job.progress >= job.cookTime * BURN_FACTOR) {
        s.report.burnt += 1;
        log(s, `🔥 ${recipe.name} để quá lâu, cháy khét phải bỏ!`, 'bad');
        slot.job = null;
      }
      continue;
    }
    const cook = s.staff.find((x) => x.id === job.by);
    const byName = cook?.name ?? 'Nhân viên';
    if (job.burnError && job.progress >= job.cookTime * BURN_FACTOR) {
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
    run.playerPrep = null;
  }

  // Nhân viên
  for (const st of [...s.staff]) {
    if (st.absent || t < st.lateUntil) continue;
    if (st.task) {
      if (t >= st.task.endsAt) finishStaffTask(s, st, rng);
    } else {
      startStaffTask(s, st, rng);
    }
  }

  // Khách mất kiên nhẫn (quán bẩn thì nhanh chán hơn)
  const decay = dt * (s.cleanliness < 40 ? 1.3 : 1);
  for (const c of [...run.customers]) {
    c.patience -= decay;
    if (c.patience <= 0) customerLeavesAngry(s, c, rng);
  }

  spawnCustomers(s, dt, rng);
  maybeDayEvent(s, rng);

  if (t >= DAY_MS) closeDay(s);
}

// ================= Đóng cửa & sang ngày =================

export function closeDay(s: GameState) {
  const run = s.run;
  if (!run) return;
  if (run.customers.length) note(s, `${run.customers.length} khách còn lại lúc đóng cửa đã ra về`);
  const leftoverPrep = Object.values(run.prepped).reduce((a, b) => a + (b ?? 0), 0);
  if (leftoverPrep > 0) note(s, `Bỏ ${leftoverPrep} phần nguyên liệu đã sơ chế nhưng không dùng hết`);

  const wages = s.staff.reduce((sum, st) => sum + st.wage, 0);
  const utilities = s.upgrades.stoves * UTILITY_PER_STOVE + s.upgrades.aircon * UTILITY_AIRCON;
  s.money -= wages + RENT_PER_DAY + utilities;
  s.report.wages += wages;
  s.report.rent += RENT_PER_DAY;
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
  s.history.push(s.report);
  if (s.history.length > 30) s.history.shift();
  s.run = null;
  s.activeEvent = null;
  s.phase = 'summary';

  if (s.money < BANKRUPT_AT) s.gameOver = 'bankrupt';
  else if (s.day >= s.debtDueDay && s.debt > 0) s.gameOver = 'debt';
}

export function nextDay(s: GameState, rng: Rng) {
  if (s.phase !== 'summary' || s.gameOver) return;
  s.day += 1;
  beginMarket(s, rng);
}

export function currentEvent(s: GameState) {
  return s.activeEvent ? EVENT_MAP[s.activeEvent.defId] : null;
}
