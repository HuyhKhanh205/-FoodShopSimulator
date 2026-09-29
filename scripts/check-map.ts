/** Kiểm tra nhanh chế độ bản đồ (không cần giao diện): `npx tsx scripts/check-map.ts` */
import { QUESTIONS } from '../src/game/chat';
import * as M from '../src/game/market';
import * as MI from '../src/game/missions';
import * as MS from '../src/game/dayflow';
import * as MG from '../src/game/migrate';
import * as U from '../src/game/unlocks';
import * as RV from '../src/game/reviews';
import * as KF from '../src/game/kitchenFlow';
type UF = U.UiFeature;
import { VOICE } from '../src/assets/voice.generated';
import { speechText, voiceLines } from '../src/game/voice';
import { DAY_MS, INGREDIENTS, PLAYER_PREP_MS, RECIPES, STARTERS } from '../src/game/data';
import { dishFromCombo, registerDish, resolveCombo } from '../src/game/dishes';
import { makeCustomer } from '../src/game/customers';
import { suggestChop } from '../src/game/helpers';
import { dishNeeds, errorRate, handledCustomers, makeStaff, usableQty as uq } from '../src/game/helpers';
import { addToMenu, unlockedRoles } from '../src/game/progression';
import { orderWeight, startTrend, trendHeat, trendPriceMult, trendRepMult, trendSpawnMult } from '../src/game/trend';
import type { IngredientId } from '../src/game/types';
import { TUTORIAL, advanceTutorial, currentStep, stepSay, tutorialTargets } from '../src/game/tutorial';
import { addXp, experiment, levelOf, unlockedIngredients } from '../src/game/progression';
const usableQty = uq;
import { START_UPGRADES, UPGRADES } from '../src/game/data';
import * as E from '../src/game/engine';
import * as CULL from '../src/components/scene/cull';
import * as STREET from '../src/game/street';
import * as MARKETL from '../src/components/market/marketLayout';
import * as LABELS from '../src/components/market/labels';
/** Chỉ dùng để đọc mã nguồn khi kiểm tra tên mô hình (chạy bằng tsx, có require). */
declare function require(m: 'fs'): { readFileSync(p: string, e: 'utf8'): string };
import { MARKET_BOUNDS } from '../src/assets/models.generated';
import { isWalkable as isWalkableTile } from '../src/game/layout';
import { staffTarget } from '../src/game/staffTarget';
import * as EV from '../src/game/events';
import * as KIT from '../src/game/events/kit';
import { FUN_EVENTS } from '../src/game/events/fun';
import { MINI_INFO, MINI_TYPES, QUIZ } from '../src/game/events/mini';
import { seededRng } from '../src/game/helpers';
import { buildLayout, findPath } from '../src/game/layout';

let failed = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? '✅' : '❌'} ${msg}`);
  if (!ok) failed += 1;
};

// 1. Mọi đồ vật đều đi tới được.
const layout = buildLayout({ ...START_UPGRADES, seats: 10, stoves: 4, counters: 2 });
const unreachable = layout.stations.filter((st) => !findPath(layout, layout.start, st.access));
check(unreachable.length === 0, `mọi đồ vật đều tới được ${unreachable.map((s) => s.id).join(', ')}`);

// 2. Cầm món và tự phục vụ khi tới bàn.
const rng = seededRng(7);
const s = E.newGame(rng);
s.activeEvent = null;
E.openShop(s, rng);
const run = s.run!;
run.customers.push({
  id: 'c1', name: 'Test', emoji: '🙂', kind: 'allergic', size: 1, tableIndex: 0, arrivedAt: 0, patience: 50_000, maxPatience: 50_000,
  items: [
    { recipeId: 'pho_bo', noGarnish: true, served: false, quality: 0 },
    { recipeId: 'tra_da', noGarnish: false, served: false, quality: 0 },
  ],
});
run.pass.push(
  { id: 'd1', recipeId: 'pho_bo', quality: 'perfect', noGarnish: false, by: 'Bạn' },
  { id: 'd2', recipeId: 'tra_da', quality: 'perfect', noGarnish: false, by: 'Bạn' },
  { id: 'd3', recipeId: 'com_ga', quality: 'perfect', noGarnish: false, by: 'Bạn' },
);
check(E.pickUpDish(s, 'd1') === null && E.pickUpDish(s, 'd2') === null, 'cầm được 2 món');
check(E.pickUpDish(s, 'd3') !== null, 'không cầm được món thứ 3');
const served = E.autoServeCarried(s, ['c1'], rng);
check(served === 1, `chỉ tự đưa trà đá, không đưa phở có hành cho khách dị ứng (đã đưa ${served})`);
check(run.carrying.length === 1 && run.carrying[0] === 'd1', 'phở có hành vẫn còn trên tay');
check(!run.pass.some((d) => d.id === 'd2'), 'trà đá đã rời quầy');
E.putDownAll(s);
check(run.carrying.length === 0, 'đặt hết món xuống');

// 3. Khách mới được xếp bàn.
let spawned = 0;
for (let i = 0; i < 2000 && spawned < 3; i += 1) {
  E.tick(s, 250, rng);
  if (s.activeEvent) s.activeEvent = null;
  spawned = s.run ? s.run.customers.filter((c) => c.id !== 'c1').length : 0;
}
const tables = s.run!.customers.filter((c) => c.kind !== 'delivery' && c.kind !== 'group').map((c) => c.tableIndex);
check(tables.every((t) => t !== undefined) && new Set(tables).size === tables.length, `khách ngồi bàn riêng: ${tables.join(', ')}`);

// 4. Góc nhìn thứ nhất: thái và khuấy.
{
  const r2 = seededRng(3);
  const g = E.newGame(r2);
  g.activeEvent = null;
  E.buy(g, 'thit_bo', 10);
  E.openShop(g, r2);
  const run2 = g.run!;
  E.playerPrep(g, 'thit_bo');
  const before = run2.playerPrep!.endsAt;
  for (let i = 0; i < 20; i += 1) E.playerChop(g);
  check(run2.playerPrep!.endsAt === run2.elapsed && before > run2.elapsed, 'chạm liên tục thì thái xong ngay, không âm thời gian');
  E.tick(g, 50, r2);
  check((run2.prepped.thit_bo ?? 0) === 4, 'thái xong có 4 phần thịt bò');

  run2.slots[0].job = { recipeId: 'pho_bo', noGarnish: false, progress: 0, cookTime: 7000, by: 'player' };
  for (let i = 0; i < 100; i += 1) E.playerStir(g, run2.slots[0].id);
  check(run2.slots[0].job!.progress === 7000, 'khuấy nhiều cũng chỉ tới lúc chín, không làm cháy');
  run2.slots[1].job = { recipeId: 'com_ga', noGarnish: false, progress: 0, cookTime: 6000, by: 'st99' };
  E.playerStir(g, run2.slots[1].id);
  check(run2.slots[1].job!.progress === 0, 'không khuấy được món nhân viên đang nấu');
}

// 5. Đi chợ giữa giờ bán.
{
  const run5 = (g: ReturnType<typeof E.newGame>, r: () => number) => {
    let spawned = 0;
    for (let i = 0; i < 1600; i += 1) {
      const before = g.run!.customers.length;
      E.tick(g, 100, r);
      if (g.activeEvent) g.activeEvent = null;
      if (!g.run) break;
      if (g.run.customers.length > before) spawned += 1;
    }
    return spawned;
  };
  const r5 = seededRng(11);
  const alone = E.newGame(r5);
  alone.activeEvent = null;
  E.openShop(alone, r5);
  check(!E.buy(alone, 'trung', 1), 'đang bán ở quán thì không mua được');
  E.leaveForMarket(alone);
  check(E.buy(alone, 'trung', 1), 'đi chợ giữa giờ thì mua được');
  check(E.shopClosed(alone), 'chưa có nhân viên: quán tạm đóng');
  check(run5(alone, r5) === 0, 'quán tạm đóng: không có khách mới');
  E.returnToShop(alone);
  check(!alone.run!.ownerAway && !E.shopClosed(alone), 'về quán thì mở lại');

  const r6 = seededRng(11);
  const withStaff = E.newGame(r6);
  withStaff.activeEvent = null;
  withStaff.staff.push({ ...withStaff.candidates[0], trait: 'steady' });
  E.openShop(withStaff, r6);
  E.leaveForMarket(withStaff);
  check(!E.shopClosed(withStaff), 'có nhân viên: quán vẫn mở khi chủ đi chợ');
  check(run5(withStaff, r6) > 0, 'có nhân viên: vẫn có khách mới');
}

// Bếp gộp: đứng một chỗ vẫn vừa thái vừa nấu hai nồi, nhấc món lên tay rồi nấu tiếp.
{
  const r7 = seededRng(5);
  const g = E.newGame(r7);
  g.activeEvent = null;
  for (const id of ['thit_bo', 'hanh', 'rau', 'banh_pho', 'trung', 'banh_mi', 'pate'] as const) E.buy(g, id, 10);
  E.openShop(g, r7);
  const k = g.run!;
  k.slots.forEach((sl) => (sl.job = null));
  const prepAll = (id: 'thit_bo' | 'hanh' | 'rau') => {
    E.playerPrep(g, id);
    for (let i = 0; i < 20; i += 1) E.playerChop(g);
    E.tick(g, 50, r7);
  };
  prepAll('thit_bo');
  prepAll('hanh');
  prepAll('rau');
  const stoves = k.slots.filter((sl) => sl.station === 'stove');
  check(stoves.length >= 2, `có ít nhất 2 bếp (${stoves.length})`);
  check(E.playerCook(g, 'pho_bo', false) === null, 'nấu phở ở bếp 1');
  E.playerPrep(g, 'thit_bo');
  check(k.playerPrep !== null && stoves[0].job !== null, 'vừa thái vừa có nồi đang nấu');
  check(E.playerCook(g, 'banh_mi_trung', false, stoves[0].id) !== null, 'không nấu chồng lên bếp đang bận');
  const err = E.playerCook(g, 'banh_mi_trung', false, stoves[1].id);
  check(err === null && stoves[1].job?.recipeId === 'banh_mi_trung', `nấu bánh mì đúng bếp 2 đang chọn ${err ?? ''}`);
  for (let i = 0; i < 100; i += 1) E.playerStir(g, stoves[0].id);
  E.playerTakeOut(g, stoves[0].id, true);
  check(k.carrying.length === 1 && stoves[0].job === null, 'nhấc phở lên tay, bếp 1 trống để nấu tiếp');
}

// Bớt đồ mua dư ở chợ
{
  const r8 = seededRng(21);
  const g = E.newGame(r8);
  g.activeEvent = null;
  const before = g.money;
  const oldStock = g.stock.filter((b) => b.ingredientId === 'thit_bo').reduce((n, b) => n + b.qty, 0);
  E.buy(g, 'thit_bo', 5);
  check(E.unbuy(g, 'thit_bo', 2), 'bớt được 2 phần thịt bò vừa mua');
  const now = g.stock.filter((b) => b.ingredientId === 'thit_bo').reduce((n, b) => n + b.qty, 0);
  check(now === oldStock + 3, `kho còn 3 phần mới mua (${now - oldStock})`);
  check(g.money === before - g.prices.thit_bo * 3, 'tiền được trả lại đúng giá');
  check(!E.unbuy(g, 'thit_bo', 10) || E.returnableQty(g, 'thit_bo') === 0, 'không bớt quá số đã mua hôm nay');
  check(E.returnableQty(g, 'thit_bo') === 0, 'đã bớt hết phần mua hôm nay còn lại');
  E.buy(g, 'hanh', 3);
  E.openShop(g, r8);
  check(!E.unbuy(g, 'hanh', 1), 'đang bán ở quán thì không bớt được');
}

// Trò chuyện có trả lời
{
  const r9 = seededRng(33);
  const g = E.newGame(r9);
  g.activeEvent = null;
  E.openShop(g, r9);
  check(g.run!.customers.every((c) => !c.chat && !c.question), 'chưa có khách thì không có trò chuyện');
  let asked = false;
  for (let i = 0; i < 3000 && !asked; i += 1) {
    E.tick(g, 200, r9);
    if (g.activeEvent) g.activeEvent = null;
    asked = g.run!.customers.some((c) => c.question);
  }
  check(asked, 'có khách hỏi chủ quán');
  const c = g.run!.customers.find((x) => x.question)!;
  const q = c.question!.id;
  const good = QUESTIONS.find((x) => x.id === q)!.answers.findIndex((a) => a.effect === 'good');
  const p0 = c.patience;
  check(E.answerChat(g, c.id, good) === 'good' && c.patience > p0 && (c.tipBonus ?? 0) > 0, 'trả lời hợp ý: khách chờ lâu hơn, boa thêm');
  check(!c.question && E.answerChat(g, c.id, 0) === null, 'mỗi câu hỏi chỉ trả lời một lần');
  const chatted = g.run!.customers.some((x) => x.chat);
  check(chatted, 'có bong bóng trò chuyện');
}

// Ngày làm quen: ít khách hơn
{
  const count = (day: number) => [99, 100, 101].reduce((sum, seed) => sum + countSeed(day, seed), 0);
  const countSeed = (day: number, seed: number) => {
    const r = seededRng(seed);
    const g = E.newGame(r);
    g.day = day;
    g.activeEvent = null;
    E.openShop(g, r);
    let n = 0;
    for (let i = 0; i < 1500; i += 1) {
      const before = g.run!.customers.length;
      E.tick(g, 200, r);
      if (g.activeEvent) g.activeEvent = null;
      if (!g.run) break;
      if (g.run.customers.length > before) n += 1;
    }
    return n;
  };
  const d1 = count(1);
  const d4 = count(4);
  check(d1 < d4, `ngày 1 ít khách hơn ngày 4 (${d1} < ${d4})`);
}

// Cấp độ & Bếp thử món
{
  const r10 = seededRng(5);
  const g = E.newGame(r10);
  check(g.unlockedRecipes.length === 2 && levelOf(g.xp) === 1, 'bắt đầu cấp 1 với 2 món');
  check(unlockedIngredients(g).length === 6 && !unlockedIngredients(g).includes('gao'), 'cấp 1 chỉ có 6 nguyên liệu');
  check(experiment(g, ['pate', 'banh_mi']).kind === 'new' && g.discovered.includes('banh_mi_pate'), 'bánh mì + pate → Bánh mì pate vào sổ món');
  check(!g.unlockedRecipes.includes('banh_mi_pate'), 'thử ra món chưa tự vào menu');
  check(addToMenu(g, 'banh_mi_pate', () => 0.9) && g.unlockedRecipes.includes('banh_mi_pate'), 'thêm vào menu');
  check(experiment(g, ['banh_mi', 'pate']).kind === 'known', 'thử lại món đã có → đã có');
  check(experiment(g, ['gao', 'trung']).kind === 'nothing', 'chưa mở gạo thì không thử được');
  const xp0 = g.xp;
  addXp(g, 60);
  check(levelOf(g.xp) === 1 && g.xp === 59 && (g.xpHeld ?? 0) === xp0 + 1 && !unlockedIngredients(g).includes('gao'), 'ngày 1: đủ XP vẫn chưa lên cấp, chưa mở nguyên liệu mới (giữ XP dư)');
  g.phase = 'summary';
  g.activeEvent = null;
  E.nextDay(g, r10);
  g.activeEvent = null;
  check(levelOf(g.xp) === 2 && g.xp === xp0 + 60 && !g.xpHeld && g.chefQueue.some((n) => n.kind === 'levelUp' && n.level === 2), 'sáng ngày 2: cộng XP giữ lại, lên cấp 2 và báo đầu bếp');
  addXp(g, 5);
  check(g.xp === xp0 + 65 && !g.xpHeld, 'từ ngày 2: XP cộng như cũ');
  const r3 = experiment(g, ['gao', 'trung', 'hanh']);
  check(r3.kind === 'new' && r3.recipeId === 'com_chien_trung', 'gạo + trứng + hành → Cơm chiên trứng');
  addToMenu(g, 'com_chien_trung', () => 0.9);
  const menuBefore = g.unlockedRecipes.length;
  for (const combo of [['tra', 'pate'], ['da', 'pate'], ['tra', 'trung']] as IngredientId[][]) experiment(g, combo);
  check(Object.values(g.labHints).some((n) => (n ?? 0) > 0), '3 món không chuẩn → lộ gợi ý');
  check(g.unlockedRecipes.length === menuBefore, 'thử món không tự thêm vào menu');
  // Món mới xuất hiện trong đơn khách
  g.activeEvent = null;
  E.openShop(g, r10);
  let saw = false;
  for (let i = 0; i < 4000 && !saw && g.run; i += 1) {
    E.tick(g, 200, r10);
    if (g.activeEvent) g.activeEvent = null;
    saw = Boolean(g.run?.customers.some((c) => c.items.some((it) => it.recipeId === 'com_chien_trung' || it.recipeId === 'banh_mi_pate')));
  }
  check(saw, 'khách gọi món vừa sáng tạo');
}

// Hướng dẫn ngày đầu: đi hết các bước bằng thao tác engine
{
  const r11 = seededRng(8);
  const g = E.newGame(r11);
  g.activeEvent = null;
  const ui = { fpOpen: false };
  const stepId = () => TUTORIAL[g.tutorial.step]?.id;
  const pump = () => {
    for (let k = 0; k < 10; k += 1) {
      const st = currentStep(g);
      if (!st || st.tapToContinue || !st.done(g, ui)) break;
      advanceTutorial(g);
    }
  };
  check(stepId() === 'hello', 'bắt đầu ở bước chào');
  advanceTutorial(g);
  for (const v of ['thit', 'bot', 'rau', 'nuoc']) {
    check(stepId() === `meet-${v}` && tutorialTargets(g).includes(`market.stall:${v}`), `chào sạp ${v}: chỉ vào sạp`);
    advanceTutorial(g);
  }
  check(stepId() === 'buy-hand' && tutorialTargets(g).some((t) => t.startsWith('market.stall:')), 'bước mua tay chỉ vào sạp (không có Mua theo menu)');
  check(!U.shows(g, 'quickBuy'), 'ngày 1 đang hướng dẫn: ẩn Mua theo menu');
  check(M.checkout(g, M.suggestBasket(g)) === null, 'mua đủ + trả tiền được');
  pump();
  check(stepId() === 'open', 'mua đủ → bước mở cửa');
  E.openShop(g, r11);
  pump();
  check(stepId() === 'board', 'mở cửa → bước vào bếp');
  ui.fpOpen = true;
  pump();
  E.playerPrep(g, 'hanh');
  for (let i = 0; i < 20; i += 1) E.playerChop(g);
  E.tick(g, 50, r11);
  pump();
  check(stepId() === 'cook', 'thái hành → bước nấu');
  E.playerCook(g, 'banh_mi_trung', false);
  pump();
  check(stepId() === 'take', 'nấu → bước lấy món');
  for (let i = 0; i < 100; i += 1) E.playerStir(g, g.run!.slots[0].id);
  E.playerTakeOut(g, g.run!.slots[0].id, true);
  pump();
  check(stepId() === 'serve', 'lấy món → bước mang cho khách');
  let tries = 0;
  while (g.run && g.run.customers.length === 0 && tries++ < 200) {
    E.tick(g, 200, r11);
    if (g.activeEvent) g.activeEvent = null;
  }
  check(g.run!.elapsed < 15_000, `khách đầu tiên tới sớm (${Math.round(g.run!.elapsed / 1000)} giây)`);
  const c = g.run!.customers[0];
  E.playerServe(g, g.run!.carrying[0], c.id, r11);
  pump();
  check(stepId() === 'great', 'mang món → bước khen');
  advanceTutorial(g);
  check(g.tutorial.done, 'hoàn thành hướng dẫn');
}

// Mọi tổ hợp đều ra món
{
  const all = ['banh_mi', 'trung', 'pate', 'hanh', 'tra', 'da', 'gao', 'ga', 'thit_bo', 'rau', 'bun', 'tom'] as IngredientId[];
  let ok = true;
  let n = 0;
  for (let a = 0; a < all.length; a += 1)
    for (let b = a + 1; b < all.length; b += 1)
      for (let c = b; c < all.length; c += 1) {
        const combo = c === b ? [all[a], all[b]] : [all[a], all[b], all[c]];
        const d = dishFromCombo(combo);
        n += 1;
        if (!d.name || !(d.price > 0) || !d.emoji) ok = false;
      }
  check(ok, `mọi tổ hợp (${n}) đều ra món có tên, giá, hình`);
  check(dishFromCombo(['banh_pho', 'thit_bo', 'hanh', 'rau']).id === 'pho_bo', 'tổ hợp chuẩn vẫn ra Phở bò');
  const monster = dishFromCombo(['tra', 'da', 'thit_bo']);
  check(monster.kind === 'quai_di', `trà + đá + bò là món quái dị (${monster.name})`);
  check(dishFromCombo(['gao', 'thit_bo', 'hanh']).kind === 'la', `cơm + bò + hành là món lạ (${dishFromCombo(['gao', 'thit_bo', 'hanh']).name})`);
  const g = E.newGame(seededRng(1));
  const noH = resolveCombo(g, ['banh_mi', 'trung', 'pate']);
  check(noH.recipe.id === 'banh_mi_trung' && noH.noGarnish, 'bỏ hành ra khỏi nồi → Bánh mì trứng không hành');
  // Nấu theo nồi tự chọn
  const r = seededRng(3);
  g.activeEvent = null;
  for (const id of ['banh_mi', 'trung', 'pate', 'tra', 'da'] as const) E.buy(g, id, 3);
  E.openShop(g, r);
  g.run!.slots.forEach((sl) => (sl.job = null));
  const stove = g.run!.slots.find((sl) => sl.station === 'stove')!;
  const before = usableQty(g, 'trung');
  check(E.playerCookCombo(g, ['banh_mi', 'trung', 'pate'], stove.id) === null && stove.job?.recipeId === 'banh_mi_trung' && stove.job.noGarnish, 'nồi bánh mì + trứng + pate → nấu bánh mì trứng không hành');
  check(usableQty(g, 'trung') === before - 1, 'nấu nồi trừ đúng nguyên liệu');
  const counter = g.run!.slots.find((sl) => sl.station === 'counter')!;
  check(E.playerCookCombo(g, ['tra', 'da', 'pate'], counter.id) === null && RECIPES[counter.job!.recipeId].kind === 'quai_di', 'nấu ra món quái dị trà đá pate');
  check(g.discovered.includes(counter.job!.recipeId) && !g.unlockedRecipes.includes(counter.job!.recipeId), 'món quái dị vào sổ, không vào menu');
}

// Trend
{
  const g = E.newGame(seededRng(4));
  startTrend(g, 'banh_mi_trung', 'reviewer');
  check(Math.abs(trendHeat(g) - 1) < 1e-9, 'trend mới: độ hot 100%');
  check(Math.abs(trendPriceMult(g, 'banh_mi_trung') - 1.2) < 1e-9 && Math.abs(trendSpawnMult(g) - 2.5) < 1e-9, 'giá +20%, khách +150%');
  check(Math.abs(trendRepMult(g, 'banh_mi_trung') - 1.2) < 1e-9 && trendPriceMult(g, 'tra_da') === 1, 'danh tiếng +20%, món khác không đổi');
  g.day += 1;
  check(Math.abs(trendHeat(g) - 2 / 3) < 1e-6, 'sau 1 ngày còn 67%');
  g.day += 2;
  check(trendHeat(g) === 0, 'sau 3 ngày hết hot');
  const g2 = E.newGame(seededRng(4));
  addToMenu(g2, 'banh_mi_pate', () => 0.9);
  check(orderWeight(g2, 'banh_mi_pate') === 3 && orderWeight(g2, 'tra_da') === 1, 'món mới ra mắt được gọi × 3 ngày đầu');
  // Món quái dị: có phàn nàn và có lúc thành trend
  let complaints = 0;
  let trends = 0;
  for (let seed = 1; seed <= 60; seed += 1) {
    const r = seededRng(seed);
    const g3 = E.newGame(r);
    g3.activeEvent = null;
    for (const id of ['tra', 'da', 'pate'] as const) E.buy(g3, id, 2);
    E.openShop(g3, r);
    const m = dishFromCombo(['tra', 'da', 'pate']);
    registerDish(g3, m);
    g3.unlockedRecipes.push(m.id);
    const c = makeCustomer(g3, r)!;
    c.items = [{ recipeId: m.id, noGarnish: false, served: false, quality: 0 }];
    g3.run!.customers.push(c);
    g3.run!.pass.push({ id: 'dq', recipeId: m.id, quality: 'perfect', noGarnish: false, by: 'Bạn' });
    E.playerServe(g3, 'dq', c.id, r);
    if ((g3.report.complaints ?? 0) > 0) complaints += 1;
    if (g3.trend?.source === 'viral') trends += 1;
  }
  check(complaints > 20 && trends > 0, `món quái dị: ${complaints}/60 lần bị chê, ${trends} lần thành trend`);
}

// Nhân viên theo cấp + sinh viên + sự cố
{
  const r = seededRng(6);
  const g = E.newGame(r);
  check(g.candidates.length === 0 && unlockedRoles(g).length === 0, 'cấp 1 chưa thuê được ai');
  g.xp = 160;
  E.closeDay?.(g);
  g.phase = 'summary';
  E.nextDay(g, r);
  check(unlockedRoles(g).join() === 'prep' && g.candidates.every((c) => c.role === 'prep'), 'cấp 3: chỉ phụ bếp');
  const student = g.candidates.find((c) => c.student)!;
  const normal = g.candidates.find((c) => !c.student)!;
  check(Boolean(student) && student.wage < normal.wage && student.skill <= 30, 'có sinh viên lương rẻ, tay nghề thấp');
  check(errorRate(g, { ...student, skill: 50, mood: 70, trait: 'steady' }) > errorRate(g, { ...student, student: undefined, skill: 50, mood: 70, trait: 'steady' }), 'sinh viên dễ sai hơn');
  g.xp = 540;
  g.phase = 'summary';
  E.nextDay(g, r);
  check(unlockedRoles(g).includes('waiter') && g.candidates.some((c) => c.role === 'waiter' && !c.student) && g.candidates.filter((c) => c.student).length === 2, 'cấp 5: thuê được phục vụ, có 2 sinh viên tự chọn vai');
  // Sinh viên phục vụ vụng về: ép tỉ lệ sai cao, đếm sự cố
  let trips = 0;
  let spills = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const rr = seededRng(seed);
    const h = E.newGame(rr);
    h.activeEvent = null;
    h.xp = 540;
    const w = makeStaff(h, rr, 'waiter', true);
    w.skill = 0;
    w.mood = 10;
    h.staff.push(w);
    E.openShop(h, rr);
    const c = makeCustomer(h, rr)!;
    c.tableIndex = 0;
    c.items = [{ recipeId: 'banh_mi_trung', noGarnish: false, served: false, quality: 0 }];
    h.run!.customers = [c];
    h.run!.pass.push({ id: 'dw', recipeId: 'banh_mi_trung', quality: 'perfect', noGarnish: false, by: 'Bạn' });
    for (let i = 0; i < 30; i += 1) {
      E.tick(h, 200, rr);
      if (h.activeEvent) h.activeEvent = null;
    }
    trips += h.report.trips ?? 0;
    spills += h.report.spills ?? 0;
  }
  check(trips > 0 && spills > 0, `sinh viên phục vụ có vấp té (${trips}) và đổ đồ ăn (${spills})`);
}

// ---------- Kiên nhẫn: chờ lâu hơn, chậm lại khi món đang nấu, hồi khi nhận món ----------
{
  const r = seededRng(21);
  const g = E.newGame(r);
  g.activeEvent = null;
  g.day = 5;
  for (const id of ['banh_mi', 'trung', 'pate', 'hanh'] as IngredientId[]) E.buy(g, id, 10);
  E.openShop(g, r);
  g.activeEvent = null;
  const run = g.run!;
  run.customers = [];
  const mk = (n: number) => {
    const c = makeCustomer(g, r)!;
    c.kind = 'normal';
    c.tableIndex = n;
    c.items = [
      { recipeId: 'tra_da', noGarnish: false, served: false, quality: 0 },
      { recipeId: 'tra_da', noGarnish: false, served: false, quality: 0 },
    ];
    c.patience = c.maxPatience = 100_000;
    return c;
  };
  const a = mk(0);
  const b = mk(1);
  run.customers = [a, b];
  let one = makeCustomer(g, r)!;
  for (let i = 0; i < 50 && one.kind !== 'normal'; i += 1) one = makeCustomer(g, r)!;
  check(one.kind === 'normal' && one.maxPatience >= 75_000 * 1.9, `kiên nhẫn gốc tăng (khách thường ${Math.round(one.maxPatience / 1000)} giây)`);
  // Bàn a có 2 trà đá đang pha / đã xong → được lo; bàn b thì chưa.
  run.pass.push({ id: 'p1', recipeId: 'tra_da', quality: 'perfect', noGarnish: false, by: 'Bạn' });
  run.pass.push({ id: 'p2', recipeId: 'tra_da', quality: 'perfect', noGarnish: false, by: 'Bạn' });
  const set = handledCustomers(run);
  check(set.size === 1, 'chia món đã xong cho một bàn');
  const lucky = set.has(a.id) ? a : b;
  const other = lucky === a ? b : a;
  E.tick(g, 1000, r);
  check(Math.abs(100_000 - lucky.patience - 500) < 1 && Math.abs(100_000 - other.patience - 1000) < 1, 'bàn có món đang lo: kiên nhẫn giảm một nửa');
  other.patience = 50_000;
  E.playerServe(g, 'p1', other.id, r);
  check(other.patience >= 50_000 + 100_000 * 0.15 - 1, 'mang một món: hồi 15% kiên nhẫn');
  // Nồi tự chọn: không truyền bếp thì tự tìm bếp trống; hết bếp thì báo.
  run.prepped.hanh = 5;
  const stoves = run.slots.filter((x) => x.station === 'stove');
  let okAll = true;
  for (let i = 0; i < stoves.length; i += 1) okAll = okAll && E.playerCookCombo(g, ['banh_mi', 'trung', 'pate', 'hanh'], undefined) === null;
  check(okAll && stoves.every((x) => x.job), 'nấu liên tiếp tự vào các bếp trống');
  check(E.playerCookCombo(g, ['banh_mi', 'trung', 'pate', 'hanh'], undefined) === 'Hết bếp trống', 'hết bếp trống thì báo');
  check(dishNeeds(run).get('banh_mi_trung')! <= 0, 'phiếu cần nấu đã trừ món đang nấu');
}

// ---------- Giọng Chú Tư: mọi câu cố định đều có giọng thu sẵn ----------
{
  const lines = voiceLines();
  const missing = lines.filter((l) => !VOICE[l]);
  check(missing.length === 0, `mọi câu cố định có giọng nam thu sẵn (${lines.length} câu)${missing.length ? ' — thiếu: ' + missing.slice(0, 3).join(' | ') + ' → chạy scripts/gen-voice.py' : ''}`);
  check(speechText('Món đầu tiên là 🥪 Bánh mì trứng = 🥖 + 🥚. Bấm +5 nhé!') === 'Món đầu tiên là Bánh mì trứng gồm bánh mì, trứng. Bấm thêm 5 nhé!', 'đọc emoji thành chữ');
}

// ---------- Chợ: sạp, bớt giá bằng số tiền, trả giá, kho có sức chứa ----------
{
  const r = seededRng(33);
  const g = E.newGame(r);
  g.activeEvent = null;
  g.xp = 900;
  g.money = 5_000_000;
  const offsOk = (Object.keys(g.prices) as IngredientId[]).every((id) => {
    const p = M.vendorPrice(g, id);
    return p.final >= Math.ceil(p.base / 2 / 100) * 100 && p.offs.every((o) => o.amount % 100 === 0 && o.amount > 0) && p.final <= p.base;
  });
  check(offsOk, 'mọi khoản bớt là số tiền (bội 100đ), giá không dưới 50%');
  // Khuyến mãi sáng có, rau chiều chỉ sau 13:00
  const morning = M.activeDeals(g);
  check(morning.length === 1 && !['rau', 'hanh'].includes(morning[0].id) && /bớt \d/.test(morning[0].label), `khuyến mãi sáng: ${morning[0]?.label}`);
  E.openShop(g, r);
  g.activeEvent = null;
  g.run!.elapsed = DAY_MS * 0.5;
  const afternoon = M.activeDeals(g);
  check(afternoon.some((d) => d.id === 'rau') && afternoon.every((d) => d.label.includes('chiều')), `rau chiều bớt: ${afternoon.map((d) => d.label).join(', ')}`);
  // Trả giá: đúng 2 lượt / ngày
  const g2 = E.newGame(seededRng(5));
  g2.activeEvent = null;
  let tries = 0;
  while (M.haggle(g2, 'thit', seededRng(tries + 1))) tries += 1;
  check(tries === 2, 'trả giá 2 lượt mỗi ngày');
  // Thân thiết tăng khi mua; trả tiền đúng tổng
  const g3 = E.newGame(seededRng(6));
  g3.activeEvent = null;
  g3.money = 2_000_000;
  const before = g3.money;
  const basket = { trung: 10, banh_mi: 10 } as M.Basket;
  const total = M.basketTotal(g3, basket).cost;
  check(M.checkout(g3, basket) === null && g3.money === before - total, `trả tiền giỏ đúng tổng (${total}đ)`);
  check(g3.vendors.bot.friendship > 0, 'thân thiết tăng khi mua');
  // Bớt đồ mua dư hoàn đúng giá đã trả
  const unit = total / 20;
  const m0 = g3.money;
  E.unbuy(g3, 'trung', 2);
  check(Math.abs(g3.money - m0 - 2 * M.vendorPrice(g3, 'trung').final) <= 2 * unit, 'bớt đồ mua dư hoàn đúng tiền');
  // Sức chứa
  const cap = M.stockCapacity(g3);
  check(M.checkout(g3, { gao: cap } as M.Basket) !== null, 'vượt sức chứa kho thì không mua được');
  // Mua theo menu: đủ đồ làm bánh mì trứng
  const g4 = E.newGame(seededRng(8));
  g4.activeEvent = null;
  const sb = M.suggestBasket(g4);
  check((['banh_mi', 'trung', 'pate', 'hanh'] as IngredientId[]).every((i) => (sb[i] ?? 0) > 0), 'mua theo menu có đủ đồ làm bánh mì trứng');
  // Lưu rồi tải: còn nguyên dữ liệu người bán
  const copy = JSON.parse(JSON.stringify(g3));
  check(copy.vendors.bot.friendship === g3.vendors.bot.friendship, 'dữ liệu người bán nằm trong bản lưu');
  // Ngày mới hồi lượt trả giá
  g2.phase = 'summary';
  E.nextDay(g2, seededRng(9));
  check(g2.vendors.thit.haggles === M.HAGGLES_PER_DAY && g2.vendors.thit.haggleRate === 0, 'sáng mới hồi lượt trả giá');
}

// ================= Sổ tay chủ quán: nhiệm vụ, món đặc biệt, nhật ký; Đường sông =================
{
  const toDay = (g: ReturnType<typeof E.newGame>, day: number, seed: number) => {
    while (g.day < day) {
      g.activeEvent = null;
      g.phase = 'summary';
      E.nextDay(g, seededRng(seed + g.day));
    }
    g.activeEvent = null;
    return g;
  };
  const g1 = E.newGame(seededRng(21));
  g1.activeEvent = null;
  check(g1.missions.day === 1 && g1.missions.list.length === 3 && g1.missions.special === 'banh_mi_trung', 'ngày 1: 3 nhiệm vụ cố định + món đặc biệt 🥪');
  check(g1.tickets === 0 && g1.hopeStars === 0 && g1.diary.length === 0, 'bắt đầu 0 vé, 0 sao, nhật ký trống');
  check(MS.dayFlow(g1).current === 'market' && MS.dayFlow(g1).next.target === 'market.pay', 'đường sông sáng đầu: ĐANG ở chợ, gợi ý Mua theo menu');
  // Mua theo menu → nhiệm vụ mua trứng xong
  check(M.checkout(g1, M.suggestBasket(g1)) === null, 'mua theo menu (sổ tay)');
  const buyM = g1.missions.list.find((m) => m.kind === 'buy')!;
  check(MI.missionProgress(g1, buyM).done, 'nhiệm vụ mua trứng xong sau khi trả tiền');
  check(MS.dayFlow(g1).next.target === 'market.open', 'đủ đồ thì đường sông gợi ý 🏮 Mở cửa');
  const money0 = g1.money;
  const t0 = g1.tickets;
  const rw = MI.claimMission(g1, buyM.id);
  check(Boolean(rw) && g1.money === money0 + buyM.reward.money && g1.tickets === t0 + buyM.reward.tickets, 'nhận thưởng: cộng đúng tiền + vé');
  check(MI.claimMission(g1, buyM.id) === null, 'không nhận được hai lần');
  // Sơ chế trong giờ bán
  E.openShop(g1, seededRng(3));
  g1.activeEvent = null;
  check(MS.dayFlow(g1).current === 'prep', 'mở cửa có hành chưa thái: ĐANG sơ chế');
  check(E.playerPrep(g1, 'hanh') === null, 'bắt đầu thái hành');
  E.tick(g1, PLAYER_PREP_MS + 50, seededRng(4));
  g1.activeEvent = null;
  const prepM = g1.missions.list.find((m) => m.kind === 'prep')!;
  check(g1.today.prepped >= 4 && MI.missionProgress(g1, prepM).done, `nhiệm vụ sơ chế đo đúng (${g1.today.prepped} phần)`);
  // Khách chờ → nấu; cầm món → phục vụ
  g1.run!.customers.push({
    id: 'cx', name: 'Test', emoji: '🙂', kind: 'normal', size: 1, tableIndex: 0, arrivedAt: 0, patience: 90_000, maxPatience: 90_000,
    items: [{ recipeId: 'banh_mi_trung', noGarnish: false, served: false, quality: 0 }],
  });
  check(MS.dayFlow(g1).current === 'cook', 'khách chờ, đủ đồ sơ chế: ĐANG nấu');
  g1.run!.pass.push({ id: 'dx', recipeId: 'banh_mi_trung', quality: 'perfect', noGarnish: false, by: 'Bạn' });
  E.pickUpDish(g1, 'dx');
  check(MS.dayFlow(g1).current === 'serve' && MS.dayFlow(g1).next.station === 'table', 'cầm món: ĐANG phục vụ, chỉ tới bàn');
  // Món đặc biệt: XP ×2
  const xp0 = g1.xp;
  E.serveCarried(g1, 'cx', seededRng(5));
  check(g1.today.specialServed === 1 && g1.xp - xp0 === 20, `phục vụ món đặc biệt: XP ×2 (+${g1.xp - xp0})`);
  const st1 = MS.dayFlow(g1).stages;
  check(st1[0].status === 'done' && st1[1].status === 'done' && st1[4].status === 'todo', 'bến đã làm có ✓ (chợ, sơ chế), tổng kết chưa tới');

  // Ngày 3+: có nhiệm vụ khó, chỉ nhiệm vụ khó có ⭐
  const g3 = toDay(E.newGame(seededRng(22)), 4, 100);
  const hard = g3.missions.list.filter((m) => m.tier === 'hard');
  check(g3.missions.list.length === 4 && hard.length === 1 && hard[0].reward.stars === 1, `ngày 4: 3 thường + 1 khó có ⭐ (${g3.missions.list.map((m) => m.kind).join(', ')})`);
  check(g3.missions.list.filter((m) => m.tier !== 'hard').every((m) => m.reward.stars === 0), 'chỉ nhiệm vụ khó mới cho sao hy vọng');
  const g3b = toDay(E.newGame(seededRng(22)), 4, 100);
  check(JSON.stringify(g3b.missions) === JSON.stringify(g3.missions), 'cùng seed sinh cùng nhiệm vụ');
  check(E.newGame(seededRng(23)).chefQueue.length === 0 && toDay(E.newGame(seededRng(23)), 2, 7).chefQueue.some((n) => n.kind === 'notebook'), 'sáng ngày 2 Chú Tư giới thiệu sổ tay');
  const sp = g3.missions.list.find((m) => m.kind === 'special');
  if (sp) check(sp.reward.money === MI.TIER_REWARD.medium.money * 2, 'nhiệm vụ món đặc biệt thưởng ×2');

  // Nhiệm vụ chốt cuối ngày chỉ xong lúc tổng kết
  const g5 = toDay(E.newGame(seededRng(24)), 3, 200);
  g5.tutorial.done = true;
  const nl: import('../src/game/types').Mission = { id: 'm_test', kind: 'noLost', tier: 'hard', target: 2, reward: { money: 30_000, tickets: 3, stars: 1 }, claimed: false };
  g5.missions.list.push(nl);
  E.openShop(g5, seededRng(1));
  g5.activeEvent = null;
  g5.report.served = 3;
  check(!MI.missionProgress(g5, nl).done, 'nhiệm vụ "không bàn nào bỏ về" chưa xong khi chưa hết ngày');
  E.closeDay(g5);
  check(MI.missionProgress(g5, nl).done, 'tổng kết: nhiệm vụ khó xong');
  check(MS.dayFlow(g5).current === 'summary' && MS.dayFlow(g5).next.target === 'summary.missions', 'tổng kết: đường sông gợi ý Nhận thưởng');
  const stars0 = g5.hopeStars;
  const tk0 = g5.tickets;
  const claimable = MI.claimableCount(g5);
  E.nextDay(g5, seededRng(2));
  check(g5.hopeStars === stars0 + 1 && g5.tickets > tk0 && claimable > 0 && g5.chefQueue.some((n) => n.kind === 'autoClaim'), 'quên nhận thì sang ngày tự nhận (có ⭐)');
  check(g5.missions.day === 4 && g5.today.prepped === 0, 'sáng mới: nhiệm vụ mới, bộ đếm về 0');

  // Nhật ký
  const gd = E.newGame(seededRng(25));
  check(MI.writeDiary(gd, '😄', 'Hôm nay vui quá', ['🍜']) && gd.tickets === 1, 'trang nhật ký đầu tiên trong ngày: +1 🎟️');
  check(!MI.writeDiary(gd, '😢', 'x'.repeat(400)) && gd.tickets === 1 && gd.diary.length === 1, 'viết lại cùng ngày: ghi đè, không thêm vé');
  check(gd.diary[0].mood === '😢' && gd.diary[0].text.length === MI.DIARY_TEXT_MAX, 'cắt còn 300 ký tự');
  for (let d = 2; d <= 70; d += 1) {
    gd.day = d;
    MI.writeDiary(gd, '🙂', `ngày ${d}`);
  }
  check(gd.diary.length === MI.DIARY_MAX && gd.diary[0].day === 70 - MI.DIARY_MAX + 1, 'giữ tối đa 60 trang');

  // Lưu / tải: bản lưu cũ được thêm giá trị mặc định; bản mới giữ nguyên
  const saved = JSON.parse(JSON.stringify({ ...g5, run: null }));
  const back = MG.migrateSave(saved);
  check(back.tickets === g5.tickets && back.hopeStars === g5.hopeStars && JSON.stringify(back.missions) === JSON.stringify(g5.missions), 'lưu rồi tải: còn vé, sao, nhiệm vụ');
  const old = JSON.parse(JSON.stringify({ ...g5, run: null }));
  delete old.tickets;
  delete old.hopeStars;
  delete old.missions;
  delete old.today;
  delete old.diary;
  const up = MG.migrateSave(old);
  check(up.tickets === 0 && up.hopeStars === 0 && up.diary.length === 0 && up.missions.day === up.day && up.missions.list.length >= 3, 'bản lưu cũ: 0 vé, 0 sao, sinh nhiệm vụ hôm nay');
}

// ================= Giao diện gọn cho người mới: lịch mở tính năng =================
{
  const g = E.newGame(seededRng(31));
  const all: UF[] = ['notebook', 'lab', 'staff', 'manage', 'debt', 'stock', 'clean', 'panel', 'arrange', 'modeToggle', 'perfHint', 'quickBuy', 'more', 'street'];
  check(all.every((f) => !U.shows(g, f)), 'ngày 1 đang hướng dẫn: ẩn hết nút phụ');
  g.tutorial.done = true;
  check(!U.shows(g, 'modeToggle') && !U.shows(g, 'street') && !U.shows(g, 'more') && !U.shows(g, 'notebook') && !U.shows(g, 'stock'), 'xong hướng dẫn ngày 1: vẫn gọn (chỉ Chợ + Làm tiếp)');
  g.cleanliness = 50;
  check(U.shows(g, 'clean'), 'quán bẩn thì hiện nút Lau ngay ngày 1');
  g.cleanliness = 100;
  g.activeEvent = null;
  g.phase = 'summary';
  E.nextDay(g, seededRng(1));
  check(U.shows(g, 'notebook') && U.shows(g, 'stock') && U.shows(g, 'quickBuy') && U.shows(g, 'more') && U.shows(g, 'lab') && !U.shows(g, 'manage') && !U.shows(g, 'panel') && !U.shows(g, 'street'), 'ngày 2: mở sổ tay, kho, mua theo menu, sổ món (chưa Nâng cấp / Ra phố)');
  check(g.chefQueue.filter((n) => n.kind === 'unlock').length === 1 && g.chefQueue.some((n) => n.kind === 'notebook') && !g.chefQueue.some((n) => n.kind === 'autoClaim'), 'sáng ngày 2 Chú Tư báo mở tính năng + sổ tay (không báo tự nhận)');
  g.chefQueue = [];
  g.activeEvent = null;
  g.phase = 'summary';
  E.nextDay(g, seededRng(2));
  check(U.shows(g, 'panel') && U.shows(g, 'arrange') && U.shows(g, 'manage') && U.shows(g, 'street') && U.shows(g, 'modeToggle') && g.chefQueue.filter((n) => n.kind === 'unlock').length === 1, 'ngày 3: mở Bảng, Bố trí, Nâng cấp, Ra phố, Đổi chế độ; báo 1 lần');
  check(!U.shows(g, 'staff'), 'chưa tới cấp 3 thì chưa hiện Người giúp');
  addXp(g, 400);
  check(U.shows(g, 'staff'), 'cấp 3 hiện Người giúp');
  const old = MG.migrateSave(JSON.parse(JSON.stringify({ ...g, day: 10, run: null })));
  check(all.every((f) => U.shows(old, f)), 'bản lưu cũ ngày 10: thấy đủ mọi nút');
  const d1 = E.newGame(seededRng(32));
  d1.tutorial.done = true;
  d1.phase = 'summary';
  check(MS.dayFlow(d1).next.target === 'summary.next', 'tổng kết ngày 1 (chưa có sổ tay): gợi ý Ngày mới');
}

// ================= Chơi mới: món khởi đầu; sao lưu tiến độ =================
{
  for (const st of STARTERS) {
    const g = E.newGame(seededRng(41), { starter: st.id, profile: { shopName: 'Quán Thử', name: 'Bé Na' } });
    g.activeEvent = null;
    const ings = Object.keys(RECIPES[st.id].ingredients) as IngredientId[];
    check(g.unlockedRecipes.join() === `${st.id},tra_da` && g.starter === st.id && g.profile.shopName === 'Quán Thử', `${st.id}: menu = món khởi đầu + trà đá, đúng tên quán`);
    check(ings.every((i) => unlockedIngredients(g).includes(i)), `${st.id}: mở sẵn đủ nguyên liệu (${st.extra.join(', ') || 'không cần thêm'})`);
    check(g.missions.special === st.id && g.missions.list[0].ingredientId === st.buy, `${st.id}: món đặc biệt + nhiệm vụ mua ngày 1 theo món`);
    const buyStep = TUTORIAL.find((x) => x.id === 'buy-hand')!;
    const cookStep = TUTORIAL.find((x) => x.id === 'cook')!;
    check(stepSay(buyStep, g).includes(RECIPES[st.id].name) && cookStep.targets(g).includes(`kitchen.recipe:${st.id}`), `${st.id}: hướng dẫn nói và chỉ đúng món`);
    // Mua tay: chỉ chip sạp → ＋ đúng đồ → Xong; đủ giỏ + đóng sạp thì xong bước.
    {
      const need = ings.filter((i) => usableQty(g, i) < 1);
      const basket: Record<string, number> = {};
      let guard = 0;
      let ok = true;
      while (guard++ < 30) {
        const ui = { fpOpen: false, basket: { ...basket }, stall: null as string | null };
        if (buyStep.done(g, ui)) break;
        const t = buyStep.targets(g, ui);
        const stall = t[0]?.startsWith('market.stall:') ? t[0].slice(13) : null;
        if (!stall) {
          ok = false;
          break;
        }
        ui.stall = stall;
        let t2 = buyStep.targets(g, ui);
        while (t2[0]?.startsWith('stall.add5:')) {
          basket[t2[0].slice(11)] = 5;
          t2 = buyStep.targets(g, { ...ui, basket: { ...basket } });
        }
        if (t2[0] !== 'stall.done') ok = false;
      }
      check(ok && need.every((i) => basket[i] === 5) && buyStep.done(g, { fpOpen: false, basket, stall: null }), `${st.id}: mua tay theo viền vàng (+5) đủ ${need.length} món rồi xong bước`);
      const payStep = TUTORIAL.find((x) => x.id === 'pay')!;
      check(payStep.targets(g, { fpOpen: false, basket, stall: null }).join() === 'market.pay', `${st.id}: sau đó chỉ vào 💳`);
    }
    const sb = M.suggestBasket(g);
    check(ings.every((i) => (sb[i] ?? 0) > 0) && M.checkout(g, sb) === null, `${st.id}: mua theo menu đủ đồ và trả tiền được`);
    // Sơ chế đủ đồ cần thái rồi mới qua bước nấu.
    E.openShop(g, seededRng(2));
    g.activeEvent = null;
    g.tutorial.step = TUTORIAL.findIndex((x) => x.id === 'prep');
    const prepStep = TUTORIAL[g.tutorial.step];
    const needs = ings.filter((i) => INGREDIENTS[i].needsPrep);
    for (const i of needs) {
      check(!prepStep.done(g, { fpOpen: true }), `${st.id}: chưa thái ${i} thì chưa xong bước sơ chế`);
      check(prepStep.targets(g).includes(`kitchen.prep:${i}`), `${st.id}: chỉ vào ô ${i}`);
      E.playerPrep(g, i);
      E.tick(g, PLAYER_PREP_MS + 50, seededRng(3));
      g.activeEvent = null;
    }
    check(prepStep.done(g, { fpOpen: true }) && E.playerCook(g, st.id, false) === null, `${st.id}: thái xong thì nấu được món đầu tiên`);
  }
  const ex = E.newGame(seededRng(42), { starter: 'com_ga' });
  MI.writeDiary(ex, '😄', 'Nhật ký sao lưu');
  ex.hopeStars = 3;
  const code = MG.exportSave(ex);
  const back = MG.importSave(code);
  check(back.ok && back.state.starter === 'com_ga' && back.state.hopeStars === 3 && back.state.diary[0].text === 'Nhật ký sao lưu' && back.state.tickets === ex.tickets, 'xuất → nhập mã sao lưu giữ nguyên (món, sao, nhật ký, vé)');
  const broken = code.replace('Nhật ký sao lưu', 'Nhật ký bị sửa');
  check(!MG.importSave(broken).ok && !MG.importSave('abc').ok && !MG.importSave('{"app":"khac"}').ok, 'mã bị sửa / hỏng / của game khác thì báo lỗi');
  const oldSave = JSON.parse(JSON.stringify({ ...ex, run: null }));
  delete oldSave.starter;
  delete oldSave.extraIngredients;
  const up = MG.migrateSave(oldSave);
  check(up.starter === 'banh_mi_trung' && up.extraIngredients.length === 0, 'bản lưu cũ: món khởi đầu mặc định bánh mì trứng');
}

// ================= Thái được nhiều lần =================
{
  const g = E.newGame(seededRng(51));
  g.activeEvent = null;
  M.checkout(g, M.suggestBasket(g));
  E.openShop(g, seededRng(1));
  g.activeEvent = null;
  const first = suggestChop(g);
  check(first === 'hanh', `thớt rảnh: gợi ý thái ${first}`);
  E.playerPrep(g, 'hanh');
  E.tick(g, PLAYER_PREP_MS + 50, seededRng(2));
  g.activeEvent = null;
  const after1 = g.run!.prepped.hanh ?? 0;
  check(suggestChop(g) === 'hanh' && E.playerPrep(g, 'hanh') === null, 'đã có hành thái sẵn vẫn thái thêm được');
  E.tick(g, PLAYER_PREP_MS + 50, seededRng(3));
  check((g.run!.prepped.hanh ?? 0) > after1, `thái lần 2 cộng thêm (${after1} → ${g.run!.prepped.hanh})`);
}

// ================= Ngày 7 phút, khách ngày đầu, nghỉ sớm =================
{
  check(DAY_MS === 420_000, 'một ngày bán hàng 7 phút');
  const g = E.newGame(seededRng(61));
  g.tutorial.done = true;
  g.activeEvent = null;
  M.checkout(g, M.suggestBasket(g));
  E.openShop(g, seededRng(1));
  g.activeEvent = null;
  const r1 = seededRng(2);
  let firstAt = -1;
  for (let t = 0; t < 60_000 && firstAt < 0; t += 250) {
    E.tick(g, 250, r1);
    g.activeEvent = null;
    if (g.run!.customers.length) firstAt = g.run!.elapsed;
  }
  check(firstAt > 0 && firstAt <= 26_000, `ngày 1: khách đầu tiên tới sau ${Math.round(firstAt / 1000)} giây (≤ 25 giây)`);
  const money = g.money;
  check(E.closeEarly(g) && g.phase === 'summary' && g.run === null && g.history.at(-1)!.notes.some((n) => n.includes('Nghỉ sớm')), 'nghỉ sớm: sang tổng kết ngay, ghi vào sự việc trong ngày');
  check(g.money < money, 'nghỉ sớm vẫn trả tiền mặt bằng / điện gas');
  check(!E.closeEarly(g), 'đã tổng kết thì không nghỉ sớm lần nữa');
}

// ================= Tình huống: 124 mới + mini game + hậu quả =================
{

  check(FUN_EVENTS.length >= 124, `có ${FUN_EVENTS.length} tình huống mới (≥ 124)`);
  check(EV.EVENTS.length >= 142, `tổng ${EV.EVENTS.length} tình huống trong một kho chung`);
  const ids = EV.EVENTS.map((e) => e.id);
  check(new Set(ids).size === ids.length, 'id tình huống không trùng');
  const used = new Set(EV.EVENTS.flatMap((e) => e.choices.map((c) => c.mini?.type).filter(Boolean)));
  check(MINI_TYPES.length === 13 && MINI_TYPES.every((t) => used.has(t)), `đủ 13 kiểu mini game được dùng (${[...used].length})`);
  const miniEvents = EV.EVENTS.filter((e) => e.choices.some((c) => c.mini)).length;
  check(miniEvents >= 38, `${miniEvents} tình huống có mini game (≈ 40)`);
  check(MINI_TYPES.every((t) => MINI_INFO[t].name && MINI_INFO[t].hint) && QUIZ.length >= 10 && QUIZ.every((q) => q.a.length === 4), 'mini game có tên, cách chơi; đố vui đủ câu');
  const badChoices = FUN_EVENTS.filter((e) => e.choices.length < 2 || e.choices.length > 3).map((e) => e.id);
  check(badChoices.length === 0, `mỗi tình huống 2–3 lựa chọn ${badChoices.join(', ')}`);

  // Game mẫu theo ngày / nhân viên / cờ.
  const base = (day: number, staff: boolean, flags: boolean) => {
    const r = seededRng(day * 7 + (staff ? 1 : 0) + (flags ? 2 : 0));
    const g = E.newGame(r);
    g.activeEvent = null;
    g.day = day;
    g.money = 3_000_000;
    g.debt = Math.max(g.debt, 2_000_000);
    if (staff) g.staff.push(makeStaff(g, r, 'cook'), makeStaff(g, r, 'waiter'));
    if (flags) g.flags = { cat: 1, camera: 1, watchdog: 1, newLock: 1, hen: 1, parrot: 1, frog: 1, cart: 1, claw: 1 };
    return g;
  };
  const errors: string[] = [];
  const longBody: string[] = [];
  let runs = 0;
  for (const def of EV.EVENTS.filter((e) => e.phase !== 'trigger')) {
    for (const day of [3, 8, 20]) {
      for (const staff of [false, true]) {
        for (const flags of [false, true]) {
          def.choices.forEach((c, i) => {
            for (const score of c.mini ? [0, 0.5, 1] : [undefined]) {
              const g = base(day, staff, flags);
              const r = seededRng(day + i * 13 + (score ?? 0.3) * 100);
              try {
                if (def.phase === 'day') E.openShop(g, r);
                const ctx = def.setup ? def.setup(g, r) : {};
                if (!ctx) continue;
                const body = def.body(ctx, g);
                if (body.length > 160 && !longBody.includes(def.id)) longBody.push(`${def.id}(${body.length})`);
                g.activeEvent = { defId: def.id, ctx };
                if (c.enabled && !c.enabled(g, ctx)) continue;
                E.chooseEventOption(g, i, r, score);
                runs += 1;
                const res = g.eventResult;
                const bad =
                  !Number.isFinite(g.money) || !Number.isFinite(g.debt) || !Number.isFinite(g.reputation) || g.reputation < 0.5 || g.reputation > 5 || !res || !(res.say || res.lines.length) || g.activeEvent;
                if (bad) errors.push(`${def.id}#${i} d${day}${staff ? 'S' : ''}${flags ? 'F' : ''} s=${score}`);
                if (def.phase === 'day') for (let k = 0; k < 40; k += 1) E.tick(g, 250, r);
              } catch (e) {
                errors.push(`${def.id}#${i}: ${(e as Error).message}`);
              }
            }
          });
        }
      }
    }
  }
  check(errors.length === 0, `mọi tình huống × lựa chọn chạy được (${runs} lượt), không NaN, có thẻ kết quả ${errors.slice(0, 6).join(' | ')}`);
  check(longBody.length === 0, `thân bài ≤ 160 ký tự ${longBody.join(', ')}`);

  // Mini game: điểm cao tốt hơn điểm thấp (tiền + danh tiếng×1tr + kho).
  const worth = (g: ReturnType<typeof E.newGame>) => g.money - g.debt + g.reputation * 1_000_000 + g.tickets * 20_000 + g.hopeStars * 100_000 + g.cleanliness * 2_000 + g.stock.reduce((n, b) => n + b.qty, 0) * 5_000 + g.xp * 1_000;
  const worse: string[] = [];
  for (const def of EV.EVENTS) {
    def.choices.forEach((c, i) => {
      if (!c.mini) return;
      const val = (score: number) => {
        const g = base(8, true, false);
        const r = seededRng(3);
        if (def.phase === 'day') E.openShop(g, r);
        const ctx = def.setup ? def.setup(g, r) : {};
        if (!ctx) return null;
        g.activeEvent = { defId: def.id, ctx };
        if (c.enabled && !c.enabled(g, ctx)) return null;
        E.chooseEventOption(g, i, r, score);
        const mods = g.mods.spawnMult + (g.mods.seatDelta ?? 0) * 0.1 + (g.buffs?.length ?? 0) * 0 + (g.pending?.length ?? 0) * 0.05;
        return worth(g) + mods * 300_000 - (g.run ? g.run.powerOutUntil : 0) * 5;
      };
      const lo = val(0);
      const hi = val(1);
      if (lo !== null && hi !== null && hi < lo) worse.push(`${def.id}#${i}`);
    });
  }
  check(worse.length === 0, `mini game: chơi giỏi (1) có lợi hơn chơi kém (0) ${worse.join(', ')}`);
  {
    const g = base(8, false, false);
    const r = seededRng(1);
    E.openShop(g, r);
    g.activeEvent = { defId: 'g_eat_contest', ctx: {} };
    E.chooseEventOption(g, 0, r, 0.9);
    check(g.miniBest?.tap === 0.9, 'kỷ lục mini game được ghi (tap 0,9)');
    E.dismissEventResult(g);
    check(g.eventResult === null, 'bấm OK đóng thẻ kết quả');
  }

  // Thẻ kết quả dừng đồng hồ.
  {
    const g = base(8, false, false);
    const r = seededRng(2);
    E.openShop(g, r);
    g.eventResult = { emoji: '🙂', title: 't', say: 's', lines: [] };
    const t0 = g.run!.elapsed;
    E.tick(g, 1000, r);
    check(g.run!.elapsed === t0, 'thẻ kết quả đang mở thì đồng hồ dừng');
  }

  // Buff nhiều ngày hết hạn đúng ngày; hậu quả hẹn chạy đúng sáng.
  {
    const g = base(5, false, false);
    const r = seededRng(4);
    KIT.crowd(1.3, 2)(g, r);
    KIT.later(1, 'g_celeb')(g, r);
    E.openShop(g, r);
    g.activeEvent = null;
    E.closeEarly(g);
    const rep0 = g.reputation;
    g.eventSeen = Object.fromEntries(EV.EVENTS.map((e) => [e.id, g.day + 1]));
    E.nextDay(g, r);
    check(g.mods.labels.some((l) => l.includes('×1,3')), 'buff 👥 ×1,3 còn ở ngày thứ 2');
    check(g.chefQueue.some((n) => n.kind === 'news' && n.text.includes('5★')) && g.reputation > rep0, 'hậu quả hẹn (review 5★) chạy sáng hôm sau, Chú Tư báo tin');
    check((g.pending ?? []).length === 0, 'hậu quả đã chạy thì xoá khỏi danh sách hẹn');
    g.activeEvent = null;
    E.openShop(g, r);
    g.activeEvent = null;
    E.closeEarly(g);
    E.nextDay(g, r);
    check(!g.mods.labels.some((l) => l.includes('×1,3')) && !(g.buffs ?? []).some((b) => b.spawnMult === 1.3), 'buff hết hạn sau 2 ngày');
  }

  // Cờ: mèo, gà, camera, chó, khoá.
  {
    const g = base(10, false, false);
    g.flags = { cat: 1 };
    const r = seededRng(9);
    let ratSeen = false;
    for (let k = 0; k < 300; k += 1) {
      g.eventSeen = {};
      g.activeEvent = null;
      const ev = EV.rollEvent(g, k % 2 ? 'day' : 'morning', r);
      if (ev && (ev.id === 'rats' || ev.id === 'h_rat_wire')) ratSeen = true;
    }
    check(!ratSeen, 'có mèo: không còn “chuột trong kho” / “chuột cắn dây điện”');

    const h = base(10, false, false);
    h.flags = { hen: 5 };
    h.eventSeen = Object.fromEntries(EV.EVENTS.map((e) => [e.id, h.day + 1]));
    const eggs = () => h.stock.filter((b) => b.ingredientId === 'trung').reduce((n, b) => n + b.qty, 0);
    const r2 = seededRng(5);
    E.openShop(h, r2);
    h.activeEvent = null;
    E.closeEarly(h);
    const e0 = eggs();
    E.nextDay(h, r2);
    check(eggs() >= e0 + 2, `có gà: mỗi sáng +2 trứng (${e0} → ${eggs()})`);

    const t = EV.EVENT_MAP.h_theft;
    const cam = base(10, false, false);
    cam.flags = { camera: 1 };
    check(t.when!(cam) === false && EV.EVENT_MAP.h_theft_caught.when!(cam) === true, 'có camera: trộm két bị bắt, không mất tiền');
    const dog = base(10, false, false);
    dog.flags = { watchdog: 1 };
    let hits = 0;
    const r3 = seededRng(11);
    for (let k = 0; k < 400; k += 1) {
      const d2 = JSON.parse(JSON.stringify(dog));
      if (t.setup!(d2, r3)) hits += 1;
    }
    check(hits > 60 && hits < 180, `có chó giữ nhà: trộm hiếm hơn (${hits}/400 lần)`);
    const lock = base(10, false, false);
    lock.flags = { newLock: 1 };
    check(EV.EVENT_MAP.h_stock_theft.when!(lock) === false, 'có khoá mới: không mất kho');
    const rich = base(10, false, false);
    rich.money = 30_000_000;
    const ctx = t.setup!(rich, seededRng(1));
    check(ctx !== null && Number(ctx.lost) === 1_500_000 && rich.money === 28_500_000, 'két bị trộm tối đa 1,5 triệu');
    const poor = base(10, false, false);
    poor.money = -50_000;
    check(t.setup!(poor, seededRng(1)) === null && poor.money === -50_000, 'hết tiền thì trộm không lấy được, tiền không âm thêm');
    const mid = base(10, false, false);
    mid.money = 400_000;
    t.setup!(mid, seededRng(1));
    check(mid.money === 340_000, `trộm lấy 15% tiền mặt (${mid.money})`);
  }

  // Không lặp lại trong 10 ngày; tần suất 1–2 tình huống / ngày.
  {
    const g = base(12, true, false);
    const r = seededRng(21);
    const seen: string[] = [];
    for (let k = 0; k < 40; k += 1) {
      g.activeEvent = null;
      const ev = EV.rollEvent(g, 'morning', r);
      if (ev) seen.push(ev.id);
    }
    check(seen.length > 5 && new Set(seen).size === seen.length, `không lặp lại tình huống trong 10 ngày (${seen.length} lần chọn, không trùng)`);
    g.day = 23;
    g.activeEvent = null;
    const again = EV.rollEvent(g, 'morning', r);
    check(again !== null, 'sau 10 ngày tình huống cũ được gặp lại');

    const sim = E.newGame(seededRng(33));
    sim.money = 5_000_000;
    const rs = seededRng(34);
    let events = 0;
    let days = 0;
    const perDay: number[] = [];
    for (let d = 0; d < 60; d += 1) {
      let today = 0;
      const resolve = () => {
        if (sim.activeEvent) {
          const def = E.currentEvent(sim)!;
          const i = Math.floor(rs() * def.choices.length);
          const ok = !def.choices[i].enabled || def.choices[i].enabled!(sim, sim.activeEvent.ctx);
          E.chooseEventOption(sim, ok ? i : def.choices.findIndex((c) => !c.enabled || c.enabled(sim, sim.activeEvent!.ctx)), rs, 0.5);
          if (sim.activeEvent) sim.activeEvent = null;
          today += 1;
        }
        if (sim.eventResult) E.dismissEventResult(sim);
      };
      resolve();
      E.openShop(sim, rs);
      resolve();
      while (sim.phase === 'open') {
        E.tick(sim, 500, rs);
        resolve();
      }
      if (sim.day >= 4) {
        events += today;
        days += 1;
        perDay.push(today);
      }
      sim.money = Math.max(sim.money, 2_000_000);
      sim.gameOver = null;
      E.nextDay(sim, rs);
    }
    const avg = events / Math.max(1, days);
    check(avg >= 1 && avg <= 2.2 && Math.max(...perDay) <= 3, `trung bình ${avg.toFixed(2)} tình huống/ngày (1–2), nhiều nhất ${Math.max(...perDay)}`);
    check(!Number.isNaN(sim.money) && sim.reputation >= 0.5 && sim.reputation <= 5, `60 ngày chọn ngẫu nhiên: tiền ${Math.round(sim.money)}, danh tiếng ${sim.reputation.toFixed(2)}`);
  }

  // Bản lưu cũ có mặc định các trường mới.
  {
    const old = JSON.parse(JSON.stringify(E.newGame(seededRng(3)))) as Record<string, unknown>;
    for (const k of ['eventResult', 'buffs', 'pending', 'flags', 'eventSeen', 'miniBest']) delete old[k];
    const m = MG.migrateSave(old as unknown as ReturnType<typeof E.newGame>);
    check(m.eventResult === null && Array.isArray(m.buffs) && Array.isArray(m.pending) && !!m.flags && !!m.eventSeen && !!m.miniBest, 'bản lưu cũ: có mặc định buffs / pending / flags / eventSeen / miniBest');
  }
}

// ================= Quản lý nhân viên trong giờ bán + sinh viên chọn vai + ẩn khối xa =================
{
  const r = seededRng(41);
  const g = E.newGame(r);
  g.activeEvent = null;
  g.xp = 540;
  g.phase = 'summary';
  E.nextDay(g, r);
  g.activeEvent = null;
  const roles = unlockedRoles(g);
  const stu = g.candidates.filter((c) => c.student);
  check(roles.length === 3 && stu.length === 2, `ứng viên: ${stu.length} sinh viên, vai đã mở ${roles.join('/')}`);
  check(E.hire(g, stu[0].id, 'cook') && g.staff.at(-1)!.role === 'cook', 'thuê sinh viên làm đầu bếp (tự chọn vai)');
  const normal = g.candidates.find((c) => !c.student && c.role === 'prep')!;
  check(E.hire(g, normal.id, 'waiter') && g.staff.at(-1)!.role === 'prep', 'nhân viên chính thức giữ chuyên môn khi thuê');
  const s1 = g.staff.find((x) => x.student)!;
  const pro = g.staff.find((x) => !x.student)!;
  check(!E.setStudentRole(g, pro.id, 'waiter') && pro.role === 'prep', 'nhân viên chính thức không đổi vai được');
  check(E.setStudentRole(g, s1.id, 'waiter') && s1.role === 'waiter', 'sinh viên rảnh: đổi vai ngay');

  const lowLv = E.newGame(seededRng(3));
  lowLv.xp = 160;
  lowLv.phase = 'summary';
  E.nextDay(lowLv, seededRng(3));
  const st2 = lowLv.candidates.find((c) => c.student)!;
  check(!E.hire(lowLv, st2.id, 'waiter') && lowLv.staff.length === 0, 'vai chưa mở thì không thuê được');

  // Trong giờ bán.
  E.openShop(g, r);
  g.activeEvent = null;
  const run = g.run!;
  // Sinh viên đang bưng món: đổi vai sau khi xong việc, món không mất.
  run.pass.push({ id: 'dx', recipeId: 'tra_da', quality: 'perfect', noGarnish: false, by: 'Bạn' });
  run.customers.push({ id: 'cx', name: 'T', emoji: '🙂', kind: 'normal', size: 1, tableIndex: 0, arrivedAt: 0, patience: 90_000, maxPatience: 90_000, items: [{ recipeId: 'tra_da', noGarnish: false, served: false, quality: 0 }] });
  s1.task = { kind: 'serve', endsAt: run.elapsed + 1500, dishId: 'dx', customerId: 'cx' };
  s1.skill = 99;
  E.setStudentRole(g, s1.id, 'prep');
  check(s1.role === 'waiter' && s1.nextRole === 'prep', 'sinh viên đang bưng món: hẹn đổi vai khi xong');
  for (let k = 0; k < 12; k += 1) {
    E.tick(g, 250, r);
    g.activeEvent = null;
    g.eventResult = null;
  }
  check(s1.role === 'prep' && !s1.nextRole, 'xong việc thì đổi sang phụ bếp');
  const cx = run.customers.find((c) => c.id === 'cx');
  check(!run.pass.some((d) => d.id === 'dx') && (!cx || cx.items[0].served || s1.task === null), 'món đang bưng vẫn tới khách (không mất)');

  // Nghỉ giải lao.
  const b = g.staff.find((x) => x !== s1)!;
  const bKind = (): string | undefined => b.task?.kind;
  b.task = null;
  b.mood = 50;
  check(E.staffBreak(g, b.id) && bKind() === 'break' && b.mood === 65, '☕ nghỉ giải lao: tâm trạng +15');
  const t0 = run.elapsed;
  let stayed = true;
  while (run.elapsed - t0 < E.BREAK_MS - 500) {
    E.tick(g, 250, r);
    g.activeEvent = null;
    g.eventResult = null;
    if (bKind() !== 'break') stayed = false;
  }
  check(stayed, 'đang nghỉ thì không nhận việc (40 giây)');
  for (let k = 0; k < 8; k += 1) E.tick(g, 250, r);
  check(bKind() !== 'break' && !E.staffBreak(g, b.id), 'nghỉ xong quay lại làm; mỗi ngày chỉ nghỉ 1 lần');

  // Thuê giữa giờ bán: 20 giây sau mới tới.
  const late = g.candidates.find((c) => c.student)!;
  E.hire(g, late.id, 'waiter');
  const nw = g.staff.find((x) => x.id === late.id)!;
  check(nw.lateUntil === run.elapsed + E.HIRE_ARRIVE_MS && staffTarget(nw, g, layout) === null, 'thuê giữa giờ bán: "đang tới" 20 giây');

  // Sa thải lúc đang sơ chế: phần đang làm được trả lại.
  const prepper = g.staff.find((x) => x.role === 'prep')!;
  const before = run.prepped.hanh ?? 0;
  prepper.task = { kind: 'prep', endsAt: run.elapsed + 2000, ingredientId: 'hanh', qty: 3 };
  E.fire(g, prepper.id);
  check(!g.staff.includes(prepper) && (run.prepped.hanh ?? 0) === before + 3, 'sa thải giữa giờ: việc dở dang được trả lại');

  // Ẩn khối xa.
  const chunks = CULL.chunkify([{ x: 1, z: 1 }, { x: 40, z: 1 }, { x: 2, z: 3 }]);
  const near = chunks.find((c) => c.items.some((it) => it.x === 1))!;
  const far = chunks.find((c) => c.items.some((it) => it.x === 40))!;
  const R = CULL.viewRadius(8, 12, 0.87);
  check(chunks.length === 2 && CULL.chunkVisible({ x: 6, z: 5 }, near.info, R) && !CULL.chunkVisible({ x: 6, z: 5 }, far.info, R), `khối gần hiện, khối xa ẩn (R=${R.toFixed(1)})`);
  check(CULL.viewRadius(8, 12, 0.87, true) < R, 'chế độ Tiết kiệm: tầm nhìn ngắn hơn');
}

// ================= Khu phố 5 nơi + mô hình phong cảnh =================
{
  const ST = STREET;
  const L = ST.buildStreetLayout('shop');
  const all5 = ST.STREET_PLACES.every((pl) => findPath(L, L.start, [ST.doorTile(pl.id)]) !== null);
  check(ST.STREET_PLACES.length === 5 && all5, 'khu phố: từ cửa quán đi bộ tới được cửa cả 5 nơi');
  check(!isWalkableTile(L, 5, 1) && !isWalkableTile(L, 3, ST.STREET_ROWS) && isWalkableTile(L, 20, 5), 'khu phố: không đi vào trong nhà / xuống lòng đường, vỉa hè đi được');
  check(ST.buildStreetLayout('market').start.x === ST.doorTile('market').x, 'ra phố từ chợ: đứng trước cổng chợ');
  check(isWalkableTile(layout, 11, 9) === !layout.blocked.has('11,9') && !isWalkableTile(layout, 12, 5), 'bản đồ quán giữ nguyên kích thước 12 × 10');

  // Buổi sáng: ra phố rồi về vẫn ở bước chuẩn bị.
  const r = seededRng(51);
  const g = E.newGame(r);
  g.activeEvent = null;
  E.goStreet(g, 'market');
  check(g.street === true && g.phase === 'market', 'buổi sáng: ra phố');
  E.streetGo(g, 'shop');
  check(!g.street && g.phase === 'market', 'buổi sáng: về quán = quay lại bước chuẩn bị (chưa mở cửa)');

  // Giờ bán: như đi chợ giữa giờ.
  E.openShop(g, r);
  g.activeEvent = null;
  E.goStreet(g, 'shop');
  check(g.street === true && g.run!.ownerAway && E.shopClosed(g), 'giờ bán, chưa có nhân viên: ra phố → quán tạm đóng');
  E.streetGo(g, 'market');
  check(!g.street && g.run!.ownerAway, 'từ phố vào chợ: vẫn vắng quán (chợ giữa giờ)');
  E.goStreet(g, 'market');
  E.streetGo(g, 'shop');
  check(!g.street && !g.run!.ownerAway, 'từ phố về quán: chủ quán có mặt');
  E.goStreet(g, 'shop');
  for (let i = 0; i < 4000 && g.phase === 'open'; i += 1) {
    E.tick(g, 250, r);
    g.activeEvent = null;
    g.eventResult = null;
  }
  check(g.phase === 'summary' && !g.street, 'hết giờ lúc đang ở phố: sang tổng kết, thôi ở phố');

  const old = JSON.parse(JSON.stringify(E.newGame(seededRng(5)))) as Record<string, unknown>;
  delete old.street;
  check(MG.migrateSave(old as unknown as ReturnType<typeof E.newGame>).street === false, 'bản lưu cũ: street = false');

  // Mọi mô hình dùng trong cảnh phong cảnh đều có trong gói (tránh lỗi thiếu mô hình).
  const fs = require('fs');
  const files = ['src/components/scene/Surroundings.tsx', 'src/components/scene/MarketSurroundings.tsx', 'src/components/scene/SceneryKit.tsx', 'src/components/street/StreetScene3D.tsx', 'src/components/market/MarketScene3D.tsx'];
  const names = new Set<string>();
  for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/'([cfnprsuva]_[a-z0-9_]+)'/g)) names.add(m[1]);
  const missing = [...names].filter((n) => !MARKET_BOUNDS[n]);
  check(names.size > 30 && missing.length === 0, `mô hình phong cảnh có đủ trong market.glb (${names.size} tên) ${missing.join(', ')}`);
}

// ================= Chợ: sạp giãn cách, chữ không đè nhau =================
{
  const ML = MARKETL;
  const mk = ML.buildMarketLayout();
  const reach = ML.STALLS.every((st) => findPath(mk, mk.start, st.access) !== null);
  check(reach, 'chợ: đi tới được cả 4 sạp');
  const left = ML.STALLS.filter((st) => st.face === 1);
  const right = ML.STALLS.filter((st) => st.face === -1);
  check(Math.abs(left[0].y - left[1].y) >= 4 && Math.abs(right[0].y - right[1].y) >= 4 && Math.abs(right[0].x - left[0].x) >= 8, 'chợ: sạp cùng bên cách ≥ 4 hàng, hai dãy cách ≥ 8 cột');
  check(ML.PALMS.every(([x, y]) => !ML.STALLS.some((st) => x >= st.x && x < st.x + 2 && y >= st.y && y < st.y + 2)), 'chợ: cây dừa không đè lên sạp');
  // placeLabels: thử nhiều vị trí chip gần nhau + bong bóng ở từng sạp.
  let bad = 0;
  const r = seededRng(8);
  for (const [w, h] of [[390, 790], [1280, 740]]) {
    for (let k = 0; k < 200; k += 1) {
      const chips = Array.from({ length: 4 }, () => ({ x: 40 + r() * (w - 80), y: 60 + r() * (h * 0.6) }));
      const call = { x: chips[k % 4].x + (r() - 0.5) * 60, y: chips[k % 4].y + 40 };
      const owner = k % 3 === 0 ? { x: call.x + 30, y: call.y + 20 } : null;
      const lay = LABELS.placeLabels(chips, call, w, h, 0, 0, owner);
      const rects = [...lay.chips, ...(lay.bubble ? [lay.bubble] : []), ...(lay.owner ? [lay.owner] : [])];
      if (owner && !lay.owner) bad += 1;
      for (let i = 0; i < rects.length; i += 1) for (let j = i + 1; j < rects.length; j += 1) if (LABELS.overlaps(rects[i], rects[j], 0)) bad += 1;
      if (!lay.bubble) bad += 1;
    }
  }
  check(bad === 0, `chữ tên sạp + câu rao + chủ quán chào không đè nhau (400 bố cục ngẫu nhiên, ${bad} lỗi)`);
}

// ================= Nâng cấp mua được tới mức cao nhất; bản lưu lệch mức =================
{
  for (const def of UPGRADES) {
    const g = E.newGame(seededRng(90));
    g.money = 1e9;
    check(def.levels.includes(g.upgrades[def.key]) && def.costs.length === def.levels.length - 1, `${def.key}: mức khởi đầu có trong danh sách, đủ giá`);
    const seen = [g.upgrades[def.key]];
    while (E.buyUpgrade(g, def.key)) seen.push(g.upgrades[def.key]);
    check(seen.join() === def.levels.join(), `${def.key}: mua lần lượt ${seen.join(' → ')}`);
  }
  const old = E.newGame(seededRng(91));
  old.money = 1e9;
  const broken = MG.migrateSave(JSON.parse(JSON.stringify({ ...old, upgrades: { ...old.upgrades, seats: 7 } })));
  const seatsOf = (x: { upgrades: { seats: number } }) => x.upgrades.seats;
  check(seatsOf(broken) === 6 && E.buyUpgrade(broken, 'seats') && seatsOf(broken) === 8, 'bản lưu 7 bàn (lệch mức) → làm tròn 6, mua tiếp được 8');
  const four = E.newGame(seededRng(92));
  four.money = 1e9;
  check(seatsOf(four) === 4 && E.buyUpgrade(four, 'seats') && seatsOf(four) === 5, 'quán 4 bàn mua thêm được bàn thứ 5');
}

// ================= Phong cảnh: mặt cỏ luôn thấp hơn mặt nước =================
{
  const kit = require('fs').readFileSync('src/components/scene/SceneryKit.tsx', 'utf8');
  const num = (name: string) => Number(kit.match(new RegExp(`export const ${name} = (-?[\\d.]+)`))?.[1]);
  const grass = num('GRASS_Y');
  const water = num('WATER_Y');
  check(grass < water - 0.05, `mặt cỏ (${grass}) thấp hơn mặt nước (${water})`);
  let ok = true;
  for (const f of ['src/components/scene/Surroundings.tsx', 'src/components/scene/MarketSurroundings.tsx', 'src/components/street/StreetScene3D.tsx']) {
    const src = require('fs').readFileSync(f, 'utf8');
    // Mặt cỏ lớn (160×160) phải dùng GRASS_Y, không đặt tay.
    for (const m of src.matchAll(/<Flat[^>]*w=\{1[0-9]{2}\}[^>]*>/g)) if (!m[0].includes('GRASS_Y')) ok = false;
  }
  check(ok, 'mặt cỏ lớn ở quán / chợ / khu phố đều dùng GRASS_Y');
}

// ================= Trả lời đánh giá =================
{
  const tone = (t: string, st: number) => RV.analyzeReply(t, st).tone;
  const cases: [string, number, string][] = [
    ['Cảm ơn bạn nhiều nha!', 5, 'thanks'],
    ['cam on ban nhieu nhe', 5, 'thanks'],
    ['🙏', 5, 'thanks'],
    ['ok', 5, 'short'],
    ['ok', 2, 'short'],
    ['Xin lỗi bạn, hôm đó quán đông khách quá, lần sau quán sẽ nhanh hơn.', 2, 'sorry'],
    ['xin loi ban, lan sau quan se co gang hon', 2, 'sorry'],
    ['Cảm ơn góp ý của bạn', 2, 'sorry'],
    ['Quán mất điện nên chậm, xin lỗi bạn', 2, 'sorry'],
    ['Xin lỗi bạn nha, mời bạn quay lại quán tặng ly trà đá!', 1, 'invite'],
    ['xin loi, moi ban quay lai quan giam gia', 1, 'invite'],
    ['Không thích thì đừng ăn nữa', 1, 'rude'],
    ['KHÁCH GÌ KHÓ TÍNH VẬY', 2, 'rude'],
    ['Kệ bạn', 3, 'rude'],
    ['mày biết gì', 1, 'rude'],
    ['Món xào hôm nay quán sáng tạo thêm rau', 5, 'meh'],
    ['Chúc bạn ngủ ngon', 5, 'meh'],
    ['Quán rất vui vì bạn thích món, cảm ơn nha!', 4, 'thanks'],
    ['Hôm đó bếp bị hỏng', 2, 'meh'],
    ['Điện cúp nên chậm, xin lỗi bạn nhiều', 3, 'sorry'],
  ];
  const wrong = cases.filter(([t, st, want]) => tone(t, st) !== want).map(([t, st, want]) => `"${t}" ${st}★ → ${tone(t, st)} (cần ${want})`);
  check(wrong.length === 0, `đọc giọng trả lời đúng ${cases.length - wrong.length}/${cases.length}${wrong.length ? ': ' + wrong.join('; ') : ''}`);

  const g = E.newGame(seededRng(95));
  g.reputation = 3;
  g.report.reviews = [
    { name: 'An', stars: 5, text: 'Ngon!' },
    { name: 'Bình', stars: 1, text: 'Chờ lâu quá' },
    { name: 'Chi', stars: 2, text: 'Hơi mặn' },
    { name: 'Dũng', stars: 1, text: 'Dở' },
  ];
  const r0 = g.reputation;
  const a = RV.replyReview(g, 1, 'Xin lỗi bạn nha, hôm đó đông khách. Mời bạn quay lại, quán tặng ly trà đá!', () => 0.9);
  check(Boolean(a?.reply && a.reply.tone === 'invite' && a.reply.back) && Math.abs(g.reputation - r0 - 0.05) < 1e-9, 'xin lỗi + mời quay lại: +0,05 danh tiếng, khách mai quay lại');
  check(g.buffs.some((b) => b.id === 'reply-back' && b.from === g.day + 1), 'khách quay lại: hôm sau đông khách hơn chút');
  check(RV.replyReview(g, 1, 'Cảm ơn lần nữa') === null, 'mỗi đánh giá chỉ trả lời 1 lần');
  const r1 = g.reputation;
  RV.replyReview(g, 3, 'Không thích thì đừng ăn');
  check(Math.abs(g.reputation - r1 + 0.05) < 1e-9 && g.report.reviews[3].reply?.tone === 'rude' && g.report.reviews[3].reply!.reaction.length > 0, 'thô lỗ: −0,05, khách đáp lại giận');
  RV.replyReview(g, 2, 'x'.repeat(500));
  check(g.report.reviews[2].reply!.text.length === RV.REPLY_MAX, 'câu trả lời dài bị cắt còn 200 chữ');
  // Giới hạn +0,1 mỗi ngày.
  const h = E.newGame(seededRng(96));
  h.reputation = 3;
  h.report.reviews = Array.from({ length: 6 }, (_, i) => ({ name: `K${i}`, stars: 1, text: 'Tệ' }));
  for (let i = 0; i < 6; i += 1) RV.replyReview(h, i, 'Xin lỗi bạn, mời bạn quay lại quán tặng trà đá nha!', () => 0.9);
  check(Math.abs(h.reputation - 3.1) < 1e-9, `danh tiếng từ trả lời tối đa +0,1 mỗi ngày (${(h.reputation - 3).toFixed(3)})`);
  check(RV.unanswered(h) === 0 && RV.answered(h) === 6, 'đếm đánh giá đã / chưa trả lời');
  // Nhiệm vụ trả lời đánh giá: chốt lúc tổng kết.
  const m = { id: 'x', kind: 'reply' as const, tier: 'medium' as const, target: 3, reward: { money: 1, tickets: 1, stars: 0 }, claimed: false };
  h.phase = 'summary';
  check(MI.missionProgress(h, m).done && MI.missionText(m).text.includes('Trả lời 3'), 'nhiệm vụ "Trả lời 3 đánh giá" xong khi trả lời đủ');
  // Chú Tư nhắc cách trả lời lần đầu bị chê.
  const t = E.newGame(seededRng(97));
  t.report.reviews = [{ name: 'Z', stars: 2, text: 'Tệ' }];
  RV.queueReplyTip(t);
  RV.queueReplyTip(t);
  check(t.chefQueue.filter((n) => n.kind === 'news' && n.text === RV.REPLY_TIP).length === 1, 'lần đầu bị chê: Chú Tư nhắc 1 lần');
}

// ================= Nút 👉 Làm tiếp luôn có nhãn + chỗ đi =================
{
  const g = E.newGame(seededRng(98));
  g.activeEvent = null;
  g.tutorial.done = true;
  let ok = true;
  const labels = new Set<string>();
  const look = () => {
    const n = MS.dayFlow(g).next;
    labels.add(n.label);
    if (!n.label || n.label.length > 32) ok = false;
    if (n.station && n.station !== 'table' && !buildLayout(g.upgrades).stations.some((s) => s.id === n.station)) ok = false;
  };
  look();
  M.checkout(g, M.suggestBasket(g));
  look();
  E.openShop(g, seededRng(99));
  for (let i = 0; i < 300 && g.run; i += 1) {
    E.tick(g, 200, seededRng(i));
    g.activeEvent = null;
    look();
  }
  check(ok && labels.size >= 3, `nhãn Làm tiếp ngắn, trạm có thật (${[...labels].slice(0, 6).join(' | ')})`);
}

// ================= Bếp: bấm 👉 Làm tiếp liên tục là nấu xong món cho khách =================
{
  const g = E.newGame(seededRng(120));
  g.activeEvent = null;
  M.checkout(g, M.suggestBasket(g));
  E.openShop(g, seededRng(121));
  g.activeEvent = null;
  const lay = buildLayout(g.upgrades);
  const stoves = lay.stations.filter((x) => x.kind === 'stove' && x.active && x.slotId).map((x) => x.slotId!);
  let guard = 0;
  while (g.run && !g.run.customers.some((c) => c.tableIndex !== undefined) && guard++ < 300) {
    E.tick(g, 200, seededRng(guard));
    g.activeEvent = null;
  }
  const seen: string[] = [];
  let exited = false;
  for (let i = 0; i < 400 && g.run && !exited; i += 1) {
    const n = KF.kitchenNext(g, 'stove', stoves);
    if (!seen.includes(n.action.kind)) seen.push(n.action.kind);
    const a = n.action;
    if (a.kind === 'prep') E.playerPrep(g, a.ingredient);
    else if (a.kind === 'chop') E.playerChop(g);
    else if (a.kind === 'cook') E.playerCookCombo(g, Object.keys(RECIPES[a.recipeId].ingredients) as IngredientId[], a.slotId);
    else if (a.kind === 'stir') E.playerStir(g, a.slotId);
    else if (a.kind === 'take') E.playerTakeOut(g, a.slotId, true);
    else if (a.kind === 'exit') exited = true;
    E.tick(g, 150, seededRng(1000 + i));
    g.activeEvent = null;
  }
  check(exited && g.run!.carrying.length > 0 && ['prep', 'cook', 'take', 'exit'].every((k) => seen.includes(k)), `bếp: chỉ bấm Làm tiếp là thái → nấu → lấy → mang ra (${seen.join(' → ')})`);
}

process.exit(failed ? 1 : 0);
