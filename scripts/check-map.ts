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

process.exit(failed ? 1 : 0);
