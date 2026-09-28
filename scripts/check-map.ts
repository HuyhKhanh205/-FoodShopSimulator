/** Kiểm tra nhanh chế độ bản đồ (không cần giao diện): `npx tsx scripts/check-map.ts` */
import { QUESTIONS } from '../src/game/chat';
import { VOICE } from '../src/assets/voice.generated';
import { speechText, voiceLines } from '../src/game/voice';
import { RECIPES } from '../src/game/data';
import { dishFromCombo, registerDish, resolveCombo } from '../src/game/dishes';
import { makeCustomer } from '../src/game/customers';
import { dishNeeds, errorRate, handledCustomers, makeStaff, usableQty as uq } from '../src/game/helpers';
import { addToMenu, unlockedRoles } from '../src/game/progression';
import { orderWeight, startTrend, trendHeat, trendPriceMult, trendRepMult, trendSpawnMult } from '../src/game/trend';
import type { IngredientId } from '../src/game/types';
import { TUTORIAL, advanceTutorial, currentStep, tutorialTargets } from '../src/game/tutorial';
import { addXp, experiment, levelOf, unlockedIngredients } from '../src/game/progression';
const usableQty = uq;
import { START_UPGRADES } from '../src/game/data';
import * as E from '../src/game/engine';
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
  const count = (day: number) => {
    const r = seededRng(99);
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
  addXp(g, 60);
  check(levelOf(g.xp) === 2 && g.chefQueue.some((n) => n.kind === 'levelUp' && n.level === 2), 'đủ 60 XP lên cấp 2 và báo đầu bếp');
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

// Hướng dẫn ngày đầu: đi hết 9 bước bằng thao tác engine
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
  check(tutorialTargets(g).includes('market.buy:banh_mi'), 'bước mua chỉ vào bánh mì');
  for (const id of ['banh_mi', 'trung', 'pate', 'hanh'] as const) E.buy(g, id, 5);
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
  check(unlockedRoles(g).includes('waiter') && g.candidates.some((c) => c.role === 'waiter' && c.student), 'cấp 5: thuê được phục vụ, có sinh viên');
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

process.exit(failed ? 1 : 0);
