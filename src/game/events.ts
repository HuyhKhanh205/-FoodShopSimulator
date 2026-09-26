import { INGREDIENTS, RECIPES } from './data';
import { makeCustomer } from './customers';
import {
  changeRep,
  clamp,
  expiredQty,
  formatMoney,
  log,
  menuRecipes,
  note,
  pick,
  prepIngredients,
  spend,
  usableQty,
} from './helpers';
import type { GameState, IngredientId, RecipeId, Rng } from './types';

type Ctx = Record<string, string | number>;

export interface EventChoice {
  label: string;
  apply: (s: GameState, ctx: Ctx, rng: Rng) => void;
  enabled?: (s: GameState, ctx: Ctx) => boolean;
}

export interface EventDef {
  id: string;
  /** morning: đầu ngày ở chợ; day: ngẫu nhiên khi mở cửa; trigger: do hành động gây ra. */
  phase: 'morning' | 'day' | 'trigger';
  emoji: string;
  title: string;
  weight: number;
  /** Chuẩn bị ngữ cảnh + áp dụng ảnh hưởng ban đầu; trả null nếu không phù hợp. */
  setup?: (s: GameState, rng: Rng) => Ctx | null;
  body: (ctx: Ctx, s: GameState) => string;
  choices: EventChoice[];
}

const staffById = (s: GameState, id: string | number) => s.staff.find((st) => st.id === id);
const now = (s: GameState) => s.run?.elapsed ?? 0;

function inspect(s: GameState) {
  const expired = expiredQty(s);
  const dirty = s.cleanliness < 50;
  if (!expired && !dirty) {
    changeRep(s, 0.05);
    log(s, '✅ Thanh tra: quán đạt chuẩn vệ sinh!', 'good');
    note(s, 'Thanh tra vệ sinh: đạt chuẩn');
    return;
  }
  const fine = (expired ? 500_000 : 0) + (dirty ? 500_000 : 0);
  spend(s, fine, 'fines');
  changeRep(s, -0.1 * ((expired ? 1 : 0) + (dirty ? 1 : 0)));
  const why = [expired ? 'kho có đồ hết hạn' : '', dirty ? 'quán bẩn' : ''].filter(Boolean).join(', ');
  log(s, `🚨 Bị phạt ${formatMoney(fine)} vì ${why}`, 'bad');
  note(s, `Bị thanh tra phạt ${formatMoney(fine)} (${why})`);
}

export const EVENTS: EventDef[] = [
  // ---------------- Buổi sáng ----------------
  {
    id: 'meat_price',
    phase: 'morning',
    emoji: '📈',
    title: 'Giá thịt tăng vọt',
    weight: 10,
    setup: (s) => {
      for (const ing of Object.values(INGREDIENTS)) if (ing.group === 'meat') s.mods.priceMult[ing.id] = 1.6;
      s.mods.labels.push('Thịt đắt +60%');
      return {};
    },
    body: () => 'Dịch bệnh ở trang trại, giá thịt, trứng, tôm hôm nay tăng 60%. Mua ít thôi hoặc chấp nhận lãi mỏng.',
    choices: [{ label: 'Đành chịu', apply: () => {} }],
  },
  {
    id: 'holiday',
    phase: 'morning',
    emoji: '🎉',
    title: 'Ngày lễ',
    weight: 7,
    setup: (s) => {
      s.mods.spawnMult *= 1.8;
      s.mods.labels.push('Ngày lễ: khách ×1.8');
      return {};
    },
    body: () => 'Hôm nay là ngày lễ, người ra đường đông gấp đôi. Nhớ mua thêm nguyên liệu!',
    choices: [
      {
        label: 'Tăng giá bán 10%',
        apply: (s) => {
          s.mods.sellPriceMult *= 1.1;
          s.mods.spawnMult *= 0.9;
          s.mods.labels.push('Giá bán +10%');
        },
      },
      { label: 'Giữ giá (khách quý mến)', apply: (s) => changeRep(s, 0.05) },
    ],
  },
  {
    id: 'rain',
    phase: 'morning',
    emoji: '🌧️',
    title: 'Mưa bão',
    weight: 10,
    setup: (s) => {
      s.mods.spawnMult *= 0.75;
      s.mods.deliveryMult = 4;
      s.mods.labels.push('Mưa: ít khách, nhiều đơn giao');
      return {};
    },
    body: () => 'Trời mưa to cả ngày. Ít khách ngồi quán nhưng đơn giao hàng tăng mạnh (bị trừ 20% phí sàn).',
    choices: [{ label: 'Chuẩn bị áo mưa cho shipper', apply: () => {} }],
  },
  {
    id: 'rival',
    phase: 'morning',
    emoji: '🏪',
    title: 'Quán đối thủ khai trương',
    weight: 7,
    setup: (s) => {
      s.mods.spawnMult *= 0.7;
      s.mods.labels.push('Đối thủ: khách −30%');
      return {};
    },
    body: () => 'Quán mới bên kia đường khai trương, giảm giá 30%. Khách của bạn bị hút bớt.',
    choices: [
      {
        label: 'Khuyến mãi giảm 15%',
        apply: (s) => {
          s.mods.sellPriceMult *= 0.85;
          s.mods.spawnMult *= 1.3;
          s.mods.labels.push('Khuyến mãi −15%');
        },
      },
      { label: 'Kệ họ, giữ chất lượng', apply: () => {} },
    ],
  },
  {
    id: 'supplier_short',
    phase: 'morning',
    emoji: '🚚',
    title: 'Nhà cung cấp giao thiếu',
    weight: 8,
    setup: (s, rng) => {
      const options = prepIngredients(s);
      if (!options.length) return null;
      const id = pick(rng, options);
      s.mods.unavailable.push(id);
      return { id };
    },
    body: (ctx) => `Mối quen báo hôm nay hết ${INGREDIENTS[ctx.id as IngredientId].name}. Không mua được ở chỗ quen.`,
    choices: [
      {
        label: 'Mua ở chợ khác (đắt gấp rưỡi)',
        apply: (s, ctx) => {
          const id = ctx.id as IngredientId;
          s.mods.unavailable = s.mods.unavailable.filter((x) => x !== id);
          s.prices[id] = Math.round((s.prices[id] * 1.5) / 100) * 100;
        },
      },
      {
        label: 'Chịu thiếu hôm nay',
        apply: (s, ctx) => s.mods.labels.push(`Hết ${INGREDIENTS[ctx.id as IngredientId].name}`),
      },
    ],
  },
  {
    id: 'staff_sick',
    phase: 'morning',
    emoji: '🤒',
    title: 'Nhân viên xin nghỉ ốm',
    weight: 8,
    setup: (s, rng) => {
      const pool = s.staff.filter((st) => !st.absent);
      if (!pool.length) return null;
      const st = pick(rng, pool);
      st.absent = true;
      return { id: st.id, name: st.name };
    },
    body: (ctx) => `${ctx.name} nhắn tin: "Em sốt quá, xin nghỉ hôm nay ạ." Hôm nay thiếu người.`,
    choices: [
      {
        label: 'Cho nghỉ, vẫn trả lương',
        apply: (s, ctx) => {
          const st = staffById(s, ctx.id);
          if (st) st.mood = clamp(st.mood + 10, 0, 100);
        },
      },
      {
        label: 'Trừ lương ngày hôm nay',
        apply: (s, ctx) => {
          const st = staffById(s, ctx.id);
          if (!st) return;
          st.mood = clamp(st.mood - 20, 0, 100);
          s.money += st.wage;
          s.report.wages -= st.wage;
        },
      },
    ],
  },
  {
    id: 'local_news',
    phase: 'morning',
    emoji: '📰',
    title: 'Lên báo địa phương',
    weight: 4,
    setup: (s) => {
      if (s.reputation < 3.5) return null;
      s.mods.spawnMult *= 1.3;
      s.mods.labels.push('Lên báo: khách ×1.3');
      changeRep(s, 0.1);
      return {};
    },
    body: () => 'Một trang ẩm thực viết bài khen quán bạn. Hôm nay sẽ đông khách!',
    choices: [{ label: 'Tuyệt vời!', apply: () => {} }],
  },

  // ---------------- Trong ngày ----------------
  {
    id: 'power_outage',
    phase: 'day',
    emoji: '🔌',
    title: 'Cúp điện',
    weight: 8,
    body: () => 'Khu phố bị cúp điện! Bếp điện, máy hút mùi ngừng chạy.',
    choices: [
      {
        label: 'Chờ có điện (bếp dừng 20 giây)',
        apply: (s) => {
          s.run!.powerOutUntil = now(s) + 20_000;
          log(s, '🔌 Cúp điện — bếp tạm dừng', 'bad');
        },
      },
      {
        label: 'Thuê máy phát (200.000đ)',
        apply: (s) => {
          spend(s, 200_000, 'otherCosts');
          log(s, '⚡ Đã thuê máy phát điện', 'info');
        },
      },
    ],
  },
  {
    id: 'gas_out',
    phase: 'day',
    emoji: '🛢️',
    title: 'Hết gas giữa giờ',
    weight: 8,
    body: () => 'Bình gas hết đúng lúc đang đông khách!',
    choices: [
      {
        label: 'Gọi giao gấp (350.000đ)',
        apply: (s) => spend(s, 350_000, 'otherCosts'),
      },
      {
        label: 'Giao thường (250.000đ, bếp dừng 30 giây)',
        apply: (s) => {
          spend(s, 250_000, 'otherCosts');
          s.run!.gasOutUntil = now(s) + 30_000;
          log(s, '🛢️ Chờ giao gas — bếp tạm dừng', 'bad');
        },
      },
    ],
  },
  {
    id: 'inspector',
    phase: 'day',
    emoji: '🕵️',
    title: 'Thanh tra an toàn thực phẩm',
    weight: 6,
    body: (_ctx, s) =>
      `Đoàn thanh tra ghé kiểm tra bất ngờ. Vệ sinh hiện tại: ${Math.round(s.cleanliness)}%. Đồ hết hạn trong kho: ${expiredQty(s)}.`,
    choices: [
      { label: 'Mời vào kiểm tra', apply: (s) => inspect(s) },
      {
        label: 'Xin 1 phút dọn dẹp (thuê dọn 150.000đ, bỏ đồ hỏng)',
        apply: (s) => {
          spend(s, 150_000, 'otherCosts');
          s.cleanliness = clamp(s.cleanliness + 30, 0, 100);
          s.stock = s.stock.filter((b) => b.expiresOnDay >= s.day);
          inspect(s);
        },
      },
    ],
  },
  {
    id: 'staff_argue',
    phase: 'day',
    emoji: '🗯️',
    title: 'Nhân viên cãi nhau với khách',
    weight: 6,
    setup: (s, rng) => {
      const waiters = s.staff.filter((st) => st.role === 'waiter' && !st.absent);
      if (!waiters.length) return null;
      const st = pick(rng, waiters);
      return { id: st.id, name: st.name };
    },
    body: (ctx) => `${ctx.name} to tiếng với một khách vì khách chê đồ ăn. Cả quán đang nhìn.`,
    choices: [
      {
        label: 'Bênh nhân viên',
        apply: (s, ctx) => {
          const st = staffById(s, ctx.id);
          if (st) st.mood = clamp(st.mood + 15, 0, 100);
          changeRep(s, -0.1);
        },
      },
      {
        label: 'Xin lỗi khách, nhắc nhở nhân viên',
        apply: (s, ctx) => {
          const st = staffById(s, ctx.id);
          if (st) st.mood = clamp(st.mood - 15, 0, 100);
          changeRep(s, 0.02);
        },
      },
    ],
  },
  {
    id: 'staff_raise',
    phase: 'day',
    emoji: '💸',
    title: 'Nhân viên đòi tăng lương',
    weight: 6,
    setup: (s, rng) => {
      const pool = s.staff.filter((st) => st.daysWorked >= 2 && !st.absent);
      if (!pool.length) return null;
      const st = pick(rng, pool);
      return { id: st.id, name: st.name, wage: st.wage };
    },
    body: (ctx) => `${ctx.name}: "Chủ ơi, em làm cực quá, lương ${formatMoney(Number(ctx.wage))}/ngày không đủ sống."`,
    choices: [
      {
        label: 'Tăng lương 20%',
        apply: (s, ctx) => {
          const st = staffById(s, ctx.id);
          if (!st) return;
          st.wage = Math.round((st.wage * 1.2) / 10_000) * 10_000;
          st.mood = clamp(st.mood + 25, 0, 100);
        },
      },
      {
        label: 'Từ chối',
        apply: (s, ctx, rng) => {
          const st = staffById(s, ctx.id);
          if (!st) return;
          st.mood = clamp(st.mood - 25, 0, 100);
          if (st.mood < 35 && rng() < 0.4) {
            s.staff = s.staff.filter((x) => x.id !== st.id);
            log(s, `🚪 ${st.name} tức giận bỏ việc ngay lập tức!`, 'bad');
            note(s, `${st.name} bỏ việc vì không được tăng lương`);
          }
        },
      },
    ],
  },
  {
    id: 'rats',
    phase: 'day',
    emoji: '🐀',
    title: 'Chuột trong kho',
    weight: 6,
    setup: (s, rng) => {
      if (s.cleanliness >= 60) return null;
      const ids = [...new Set(s.stock.filter((b) => b.expiresOnDay >= s.day).map((b) => b.ingredientId))];
      if (!ids.length) return null;
      const id = pick(rng, ids);
      const lost = Math.ceil(usableQty(s, id) * 0.4);
      s.stock = s.stock.map((b) => (b.ingredientId === id ? { ...b, qty: Math.max(0, b.qty - lost) } : b)).filter((b) => b.qty > 0);
      return { id, lost };
    },
    body: (ctx) => `Quán bẩn nên chuột mò vào kho, gặm mất ${ctx.lost} phần ${INGREDIENTS[ctx.id as IngredientId].name}!`,
    choices: [
      {
        label: 'Gọi diệt chuột (300.000đ)',
        apply: (s) => {
          spend(s, 300_000, 'otherCosts');
          s.cleanliness = clamp(s.cleanliness + 15, 0, 100);
        },
      },
      {
        label: 'Để mai tính',
        apply: (s) => {
          changeRep(s, -0.1);
          log(s, '🐀 Khách thấy chuột chạy qua... danh tiếng giảm', 'bad');
        },
      },
    ],
  },
  {
    id: 'big_order',
    phase: 'day',
    emoji: '🏢',
    title: 'Đơn đặt hàng lớn',
    weight: 7,
    setup: (s, rng) => {
      const mains = menuRecipes(s).filter((r) => !r.drink);
      if (!mains.length) return null;
      const r = pick(rng, mains);
      return { recipeId: r.id, qty: 6 };
    },
    body: (ctx) =>
      `Một công ty gọi đặt ${ctx.qty} phần ${RECIPES[ctx.recipeId as RecipeId].name}, chờ tối đa ~100 giây. Làm tốt được thưởng thêm 20% và tăng danh tiếng.`,
    choices: [
      {
        label: 'Nhận đơn',
        apply: (s, ctx, rng) => {
          const c = makeCustomer(s, rng, 'group', { recipeId: ctx.recipeId as RecipeId, qty: Number(ctx.qty) });
          if (c) s.run!.customers.push(c);
        },
      },
      { label: 'Từ chối (không đủ người)', apply: () => {} },
    ],
  },
  {
    id: 'staff_theft',
    phase: 'day',
    emoji: '🥷',
    title: 'Nhân viên ăn vụng',
    weight: 5,
    setup: (s, rng) => {
      const pool = s.staff.filter((st) => st.mood < 50 && !st.absent);
      const meats = [...new Set(s.stock.filter((b) => INGREDIENTS[b.ingredientId].group === 'meat' && b.expiresOnDay >= s.day).map((b) => b.ingredientId))];
      if (!pool.length || !meats.length) return null;
      const st = pick(rng, pool);
      const id = pick(rng, meats);
      s.stock = s.stock.map((b) => (b.ingredientId === id ? { ...b, qty: Math.max(0, b.qty - 2) } : b)).filter((b) => b.qty > 0);
      return { id: st.id, name: st.name, ing: INGREDIENTS[id].name };
    },
    body: (ctx) => `Camera quay được ${ctx.name} lén mang ${ctx.ing} về nhà.`,
    choices: [
      {
        label: 'Đuổi việc',
        apply: (s, ctx) => {
          s.staff = s.staff.filter((x) => x.id !== ctx.id);
          note(s, `Đuổi việc ${ctx.name} vì lấy trộm nguyên liệu`);
        },
      },
      {
        label: 'Nhắc nhở',
        apply: (s, ctx) => {
          const st = staffById(s, ctx.id);
          if (st) st.mood = clamp(st.mood - 10, 0, 100);
        },
      },
      { label: 'Bỏ qua', apply: () => {} },
    ],
  },
  {
    id: 'broken_bowl',
    phase: 'day',
    emoji: '🍽️',
    title: 'Em bé làm vỡ bát',
    weight: 5,
    body: () => 'Một em bé nghịch làm vỡ bộ bát đĩa (50.000đ). Bố mẹ bé ngại ngùng xin lỗi.',
    choices: [
      {
        label: 'Không sao đâu ạ',
        apply: (s) => {
          spend(s, 50_000, 'otherCosts');
          changeRep(s, 0.03);
        },
      },
      {
        label: 'Xin đền 50.000đ',
        apply: (s) => changeRep(s, -0.04),
      },
    ],
  },

  // ---------------- Do hành động gây ra ----------------
  {
    id: 'hair_complaint',
    phase: 'trigger',
    emoji: '🦱',
    title: 'Có tóc trong đồ ăn!',
    weight: 0,
    body: (ctx) => `${ctx.name} phát hiện sợi tóc trong món ăn và gọi chủ quán ra.`,
    choices: [
      {
        label: 'Hoàn tiền',
        apply: (s, ctx) => {
          const amount = Number(ctx.amount);
          s.money -= amount;
          s.report.revenue -= amount;
        },
      },
      {
        label: 'Làm lại món khác miễn phí',
        apply: (s) => {
          spend(s, 20_000, 'otherCosts');
          changeRep(s, 0.02);
        },
      },
      {
        label: 'Tặng ly trà đá, xin lỗi',
        apply: (s, ctx, rng) => {
          changeRep(s, -0.03);
          if (rng() < 0.4) {
            changeRep(s, -0.1);
            s.report.reviews.push({ name: String(ctx.name), stars: 1, text: 'Ăn trúng tóc mà chỉ được ly trà đá!' });
            log(s, `📱 ${ctx.name} đăng bài chê quán lên mạng!`, 'bad');
          }
        },
      },
    ],
  },
];

export const EVENT_MAP: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** Chọn và khởi tạo một sự kiện ngẫu nhiên cho giai đoạn cho trước. */
export function rollEvent(s: GameState, phase: 'morning' | 'day', rng: Rng, exclude: string[] = []) {
  const pool = EVENTS.filter((e) => e.phase === phase && !exclude.includes(e.id));
  // Thử vài lần vì có sự kiện không phù hợp hoàn cảnh (setup trả null).
  for (let attempt = 0; attempt < 5 && pool.length; attempt += 1) {
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    let r = rng() * total;
    let chosen = pool[0];
    for (const e of pool) {
      r -= e.weight;
      if (r <= 0) {
        chosen = e;
        break;
      }
    }
    const ctx = chosen.setup ? chosen.setup(s, rng) : {};
    if (ctx) {
      s.activeEvent = { defId: chosen.id, ctx };
      return chosen;
    }
    pool.splice(pool.indexOf(chosen), 1);
  }
  return null;
}

export function resolveEvent(s: GameState, choiceIndex: number, rng: Rng) {
  const ev = s.activeEvent;
  if (!ev) return;
  const def = EVENT_MAP[ev.defId];
  const choice = def?.choices[choiceIndex];
  if (def && choice?.enabled && !choice.enabled(s, ev.ctx)) return;
  s.activeEvent = null;
  if (!def || !choice) return;
  choice.apply(s, ev.ctx, rng);
  note(s, `${def.emoji} ${def.title}: ${choice.label}`);
}
