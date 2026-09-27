/** Kiểm tra nhanh chế độ bản đồ (không cần giao diện): `npx tsx scripts/check-map.ts` */
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

process.exit(failed ? 1 : 0);
