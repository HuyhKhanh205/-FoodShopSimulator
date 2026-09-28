/**
 * Mô phỏng nhanh engine không cần giao diện: `npx tsx scripts/simulate.ts`
 * Bot đơn giản tự mua đồ, sơ chế, nấu và phục vụ để kiểm tra cân bằng game.
 */
import { DAY_MS, INGREDIENTS, RECIPES } from '../src/game/data';
import * as MI from '../src/game/missions';
import * as E from '../src/game/engine';
import { addToMenu, experiment, levelOf, mysteryRecipes } from '../src/game/progression';
import { canMake, makeStaff, seededRng, usableQty } from '../src/game/helpers';
import { stockCapacity, stockUnits } from '../src/game/market';
import type { GameState, IngredientId, StaffRole } from '../src/game/types';

function stockUp(s: GameState, portions: number) {
  // Mua theo tỉ lệ món khách hay gọi, trừ đồ còn trong kho.
  const need: Partial<Record<IngredientId, number>> = {};
  const menu = s.unlockedRecipes.map((id) => RECIPES[id]);
  const mains = menu.filter((r) => !r.drink);
  const drinks = menu.filter((r) => r.drink);
  const add = (r: (typeof menu)[number], n: number) => {
    for (const [ing, q] of Object.entries(r.ingredients)) need[ing as IngredientId] = (need[ing as IngredientId] ?? 0) + (q as number) * n;
  };
  mains.forEach((r) => add(r, portions / mains.length));
  drinks.forEach((r) => add(r, (portions * 0.6) / drinks.length));
  // Kho có sức chứa: thiếu chỗ thì mua bớt đều mọi thứ.
  const wants = (Object.entries(need) as [IngredientId, number][]).map(([ing, q]) => [ing, Math.max(0, Math.ceil(q) - usableQty(s, ing))] as const);
  const total = wants.reduce((n, [, w]) => n + w, 0);
  const room = stockCapacity(s) - stockUnits(s);
  const k = total > room ? room / total : 1;
  for (const [ing, w] of wants) {
    const want = Math.floor(w * k);
    if (want > 0) E.buy(s, ing, want);
  }
}

function botStep(s: GameState, rng: () => number, skill: number) {
  const run = s.run!;
  // bot "tay chậm": mỗi bước chỉ làm một việc, xác suất theo skill
  if (rng() > skill) return;
  // lấy món chín
  for (const sl of run.slots) if (sl.job?.by === 'player' && sl.job.progress >= sl.job.cookTime) return E.playerTakeOut(s, sl.id);
  // phục vụ
  for (const d of run.pass) {
    const c = run.customers.find((c) => c.items.some((i) => !i.served && i.recipeId === d.recipeId && i.noGarnish === d.noGarnish));
    if (c) return E.playerServe(s, d.id, c.id, rng);
  }
  // nấu: món nào còn thiếu so với khách đang chờ
  const pending: Record<string, number> = {};
  for (const c of run.customers) for (const it of c.items) if (!it.served) pending[it.recipeId + (it.noGarnish ? '!' : '')] = (pending[it.recipeId + (it.noGarnish ? '!' : '')] ?? 0) + 1;
  for (const d of run.pass) pending[d.recipeId + (d.noGarnish ? '!' : '')] = (pending[d.recipeId + (d.noGarnish ? '!' : '')] ?? 0) - 1;
  for (const sl of run.slots) if (sl.job) pending[sl.job.recipeId + (sl.job.noGarnish ? '!' : '')] = (pending[sl.job.recipeId + (sl.job.noGarnish ? '!' : '')] ?? 0) - 1;
  for (const [key, n] of Object.entries(pending)) {
    if (n <= 0) continue;
    const recipeId = key.replace('!', '') as keyof typeof RECIPES;
    const noG = key.endsWith('!');
    if (canMake(s, recipeId, noG)) { if (!E.playerCook(s, recipeId, noG)) return; continue; }
    for (const ing of Object.keys(RECIPES[recipeId].ingredients) as IngredientId[]) {
      if (INGREDIENTS[ing].needsPrep && (run.prepped[ing] ?? 0) < 1 && !run.playerPrep) { E.playerPrep(s, ing); return; }
    }
  }
  if (s.cleanliness < 50) E.playerClean(s);
}

/** Bot chọn ngẫu nhiên một lựa chọn bấm được; mini game ra điểm ngẫu nhiên. Trả số tình huống đã xử lý. */
function decide(s: GameState, rng: () => number): number {
  let n = 0;
  while (s.activeEvent) {
    const def = E.currentEvent(s);
    const ctx = s.activeEvent.ctx;
    const ok = def ? def.choices.map((c, i) => (!c.enabled || c.enabled(s, ctx) ? i : -1)).filter((i) => i >= 0) : [0];
    const i = process.env.FIRST_CHOICE ? ok[0] : ok[Math.floor(rng() * ok.length)];
    const moods = s.staff.map((st) => st.mood).join('/');
    E.chooseEventOption(s, i ?? 0, rng, rng());
    if (process.env.TRACE) console.log(`  d${s.day} ${def?.id}#${i} mood ${moods} → ${s.staff.map((st) => st.mood).join('/')}`);
    n += 1;
  }
  if (s.eventResult) E.dismissEventResult(s);
  return n;
}

function play(label: string, seed: number, staffRoles: StaffRole[], staffSkill: number, days: number, botSkill: number, quiet = false) {
  const rng = seededRng(seed);
  const s = E.newGame(rng, { starter: process.env.STARTER }); // STARTER=com_ga … để thử món khởi đầu khác
  for (const role of staffRoles) {
    const st = { ...makeStaff(s, rng, role), id: 'x' + role + s.staff.length, role, skill: staffSkill, trait: 'steady' as const, wage: 80_000 + staffSkill * 1600 };
    s.staff.push(st);
  }
  const rows: string[] = [];
  let bonus = 0;
  let events = 0;
  for (let d = 0; d < days && !s.gameOver; d++) {
    events += decide(s, rng);
    // Như người chơi thật: nhân viên buồn thì tăng lương.
    for (const st of s.staff) if (st.mood < 45) E.raiseWage(s, st.id);
    E.discardExpired(s);
    // Bot tự "sáng tạo" mọi món đã đủ cấp ở Bếp thử món.
    for (const id of mysteryRecipes(s)) {
      experiment(s, Object.keys(RECIPES[id].ingredients) as IngredientId[]);
      addToMenu(s, id, rng);
    }
    s.chefQueue = [];
    stockUp(s, Math.max(25, (s.history.at(-1)?.served ?? 12) * 2.2 + 8));
    E.openShop(s, rng);
    let guard = 0;
    while (s.phase === 'open' && guard++ < 10000) {
      events += decide(s, rng);
      // Nhân viên mệt thì cho nghỉ giải lao (mỗi người 1 lần / ngày).
      for (const st of s.staff) if (st.mood < 40) E.staffBreak(s, st.id);
      E.tick(s, 250, rng);
      if (s.phase === 'open') botStep(s, rng, botSkill);
    }
    const r = s.history[s.history.length - 1];
    rows.push(`d${r.day} served=${r.served} lost=${r.lost} noSeat=${r.noSeat} rev=${Math.round(r.revenue/1000)}k tips=${Math.round(r.tips/1000)}k ing=${Math.round(r.ingredientCost/1000)}k wages=${r.wages/1000}k fines=${r.fines/1000}k other=${r.otherCosts/1000}k errs=${r.staffErrors} burnt=${r.burnt} wrong=${r.wrongDishes} allerg=${r.allergic} rep=${r.repEnd.toFixed(2)} staff=${s.staff.length} money=${Math.round(s.money/1000)}k`);
    if (s.money > 3_000_000) E.payDebt(s, s.money - 2_000_000);
    // Nhiệm vụ: bot nhận thưởng (NO_MISSIONS=1 để so với khi chưa có sổ tay).
    if (process.env.NO_MISSIONS) s.missions.list = [];
    for (const m of s.missions.list) {
      const r2 = MI.claimMission(s, m.id);
      if (r2) bonus += r2.money;
    }
    E.nextDay(s, rng);
  }
  const played = s.history.length;
  if (quiet) return { money: s.money - s.debt, over: s.gameOver, perDay: events / Math.max(1, played - 2) };
  console.log(`\n=== ${label} → 🎲 ${(events / Math.max(1, played - 2)).toFixed(2)} tình huống/ngày · debt=${Math.round(s.debt/1000)}k gameOver=${s.gameOver} level=${levelOf(s.xp)} menu=${s.unlockedRecipes.length} · thưởng NV=${Math.round(bonus / 1000)}k 🎟️${s.tickets} ⭐${s.hopeStars}`);
  console.log(rows.filter((_, i) => i < 3 || i % 5 === 0 || i === rows.length - 1).join('\n'));
  return { money: s.money - s.debt, over: s.gameOver, perDay: events / Math.max(1, played - 2) };
}

void DAY_MS;
play('Tự làm một mình, tay nhanh', 1, [], 0, 30, 0.9);
play('Tự làm một mình, tay chậm', 2, [], 0, 30, 0.3);
play('2 NV tay nghề 20 + chủ', 3, ['cook', 'waiter'], 20, 30, 0.5);
play('2 NV tay nghề 80 + chủ', 3, ['cook', 'waiter'], 80, 30, 0.5);
play('3 NV (có phụ bếp) skill 50, chủ không làm', 4, ['cook', 'prep', 'waiter'], 50, 30, 0);

// Nhiều seed, bot chọn tình huống ngẫu nhiên: tỉ lệ phá sản, tiền ngày 30, số tình huống / ngày.
const runs = Array.from({ length: Number(process.env.SEEDS ?? 10) }, (_, i) => play('seed', 100 + i, [], 0, 30, 0.9, true)!);
const nets = runs.map((r) => Math.round(r.money / 1000)).sort((a, b) => a - b);
console.log(`\n=== ${runs.length} seed, một mình tay nhanh, chọn ngẫu nhiên → phá sản ${runs.filter((r) => r.over).length}/${runs.length} · tiền−nợ ngày 30 (k): min ${nets[0]} / giữa ${nets[Math.floor(nets.length / 2)]} / max ${nets.at(-1)} · ${(runs.reduce((a, r) => a + r.perDay, 0) / runs.length).toFixed(2)} tình huống/ngày`);
