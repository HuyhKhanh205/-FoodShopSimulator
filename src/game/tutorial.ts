import { INGREDIENTS, RECIPES, STARTERS } from './data';
import { VENDORS, vendorIntro, vendorOf } from './market';
import type { VendorId } from './market';
import { usableQty } from './helpers';
import { ingredientsOfLevel } from './progression';
import type { ChefNote, GameState, IngredientId } from './types';

/** Trạng thái giao diện mà kịch bản cần biết (không nằm trong GameState). */
export interface TutorialUi {
  /** Đang ở màn bếp góc nhìn thứ nhất. */
  fpOpen: boolean;
  /** Chợ: giỏ chưa trả tiền + sạp đang mở (hướng dẫn mua tay chỉ đúng nút). */
  basket?: Record<string, number>;
  stall?: string | null;
}

export interface TutorialStep {
  id: string;
  /** Câu đầu bếp nói (có câu đổi theo món khởi đầu). */
  say: string | ((s: GameState) => string);
  /** Đầu bếp đứng trên / dưới để không che chỗ cần bấm. */
  at: 'top' | 'bottom';
  /** Bước chỉ cần bấm ▶ Tiếp. */
  tapToContinue?: boolean;
  /** Các chỗ cần chỉ vào (viền vàng + 👆). */
  targets: (s: GameState, ui?: TutorialUi) => string[];
  /** Xong bước này chưa. */
  done: (s: GameState, ui: TutorialUi) => boolean;
}

/** Món đầu tiên = món đặc trưng khởi đầu (mặc định bánh mì trứng). */
const firstRecipe = (s: Pick<GameState, 'starter'>) => RECIPES[s.starter] ?? RECIPES.banh_mi_trung;
const firstIngredients = (s: Pick<GameState, 'starter'>) => Object.keys(firstRecipe(s).ingredients) as IngredientId[];
const missingFirst = (s: GameState) => firstIngredients(s).filter((i) => usableQty(s, i) < 1);
/** Đồ của món đầu còn thiếu mà giỏ chưa có. */
const notInBasket = (s: GameState, ui?: TutorialUi) => missingFirst(s).filter((i) => !((ui?.basket?.[i] ?? 0) > 0));
/** Mua tay ngày đầu: chỉ chip sạp còn đồ cần mua → nút ＋ của đúng đồ → "Xong sạp này". */
function buyHandTargets(s: GameState, ui?: TutorialUi): string[] {
  const left = notInBasket(s, ui);
  if (ui?.stall) {
    const here = left.find((i) => vendorOf(i).id === ui.stall);
    return here ? [`stall.add5:${here}`] : ['stall.done'];
  }
  return left.length ? [`market.stall:${vendorOf(left[0]).id}`] : [];
}
const buyHandSay = (s: Pick<GameState, 'starter'>) => {
  const r = firstRecipe(s);
  return `Giờ tự mua nha! Món đầu là ${r.emoji} ${r.name} = ${firstIngredients(s).map((i) => INGREDIENTS[i].emoji).join(' + ')}. Chạm sạp sáng vàng, bấm +5 bỏ 5 phần vào giỏ (hoặc gõ số), rồi bấm Xong. Muốn rẻ thì bấm 🤝 Trả giá!`;
};
const meetStep = (v: VendorId): TutorialStep => ({
  id: `meet-${v}`,
  say: vendorIntro(v),
  at: 'top',
  tapToContinue: true,
  targets: () => [`market.stall:${v}`],
  done: () => false,
});
const prepList = (s: Pick<GameState, 'starter'>) => firstIngredients(s).filter((i) => INGREDIENTS[i].needsPrep);
const prepSay = (s: Pick<GameState, 'starter'>) => {
  const list = prepList(s);
  if (list.length === 1 && list[0] === 'hanh') return 'Hành 🧅 phải thái trước. Chạm ô 🧅 bên dưới, rồi chạm thớt thật nhanh!';
  return `Đồ có 🔪 phải thái trước: ${list.map((i) => INGREDIENTS[i].emoji).join(' + ')}. Chạm từng ô bên dưới, rồi chạm thớt thật nhanh!`;
};
const cookSay = (s: Pick<GameState, 'starter'>) => `Giỏi! Bấm nút 🔥 Bếp để qua màn bếp, chạm ${firstRecipe(s).emoji} để bỏ đồ vào nồi, rồi bấm 🔥 Nấu.`;
const serveSay = (s: Pick<GameState, 'starter'>) => `Bấm 🍽️➡ góc trên để ra quán, rồi chạm vào bàn khách đang chờ ${firstRecipe(s).emoji}.`;

/** Câu hiển thị của một bước. */
export function stepSay(step: TutorialStep, s: GameState): string {
  return typeof step.say === 'function' ? step.say(s) : step.say;
}

/** Mọi biến thể câu hướng dẫn (theo từng món khởi đầu) — để sinh giọng thu sẵn. */
export function tutorialLines(): string[] {
  return TUTORIAL.flatMap((st) => (typeof st.say === 'function' ? STARTERS.map((x) => (st.say as (s: GameState) => string)({ starter: x.id } as GameState)) : [st.say]));
}
const cookingOrHolding = (s: GameState) =>
  Boolean(s.run && (s.run.slots.some((sl) => sl.job?.by === 'player') || s.run.carrying.length > 0));
const servedSomething = (s: GameState) =>
  Boolean(s.report.served > 0 || s.run?.customers.some((c) => c.items.some((i) => i.served)));

/** Kịch bản dẫn từng bước trong ngày đầu. */
export const TUTORIAL: TutorialStep[] = [
  {
    id: 'hello',
    say: 'Chào chủ quán mới! Chú là Chú Tư bếp trưởng 👨‍🍳. Chú sẽ chỉ con bán món đầu tiên nhé!',
    at: 'bottom',
    tapToContinue: true,
    targets: () => [],
    done: () => false,
  },
  // Buổi chợ đầu: Chú Tư dẫn đi chào 4 người bán, rồi chủ quán tự mua bằng tay.
  ...VENDORS.map((v) => meetStep(v.id)),
  {
    id: 'buy-hand',
    say: buyHandSay,
    at: 'top',
    targets: buyHandTargets,
    done: (s, ui) => s.phase !== 'market' || missingFirst(s).length === 0 || (notInBasket(s, ui).length === 0 && !ui.stall),
  },
  {
    id: 'pay',
    say: 'Đủ đồ trong giỏ rồi! Bấm 💳 Trả tiền cho các cô chú nha.',
    at: 'top',
    targets: (s, ui) => (notInBasket(s, ui).length === 0 ? ['market.pay'] : buyHandTargets(s, ui)),
    done: (s) => s.phase !== 'market' || missingFirst(s).length === 0,
  },
  {
    id: 'open',
    say: 'Đủ đồ rồi! Bấm 🏮 Mở cửa để đón khách.',
    at: 'top',
    targets: () => ['market.open'],
    done: (s) => s.phase === 'open',
  },
  {
    id: 'board',
    say: 'Khách sắp tới! Chạm vào 🔪 Thớt để vào bếp.',
    at: 'bottom',
    targets: () => ['shop.board'],
    done: (s, ui) => ui.fpOpen || cookingOrHolding(s) || servedSomething(s),
  },
  {
    id: 'prep',
    say: prepSay,
    at: 'top',
    targets: (s) => {
      if (s.run?.playerPrep) return ['kitchen.board'];
      const next = prepList(s).find((i) => (s.run?.prepped[i] ?? 0) <= 0);
      return next ? [`kitchen.prep:${next}`] : [];
    },
    // Đã thái đủ mọi thứ của món đầu tiên (bánh mì trứng: hành; cơm gà: hành + gà).
    done: (s) => prepList(s).every((i) => (s.run?.prepped[i] ?? 0) > 0) || cookingOrHolding(s) || servedSomething(s),
  },
  {
    id: 'cook',
    say: cookSay,
    at: 'top',
    targets: (s) => [`kitchen.recipe:${firstRecipe(s).id}`, 'kitchen.cook'],
    done: (s) => cookingOrHolding(s) || servedSomething(s),
  },
  {
    id: 'take',
    say: 'Chạm vào chảo để đảo cho mau chín. Chín ✅ thì bấm 🍽️ Lấy!',
    at: 'top',
    targets: () => ['kitchen.takeout'],
    done: (s) => Boolean(s.run && s.run.carrying.length > 0) || servedSomething(s),
  },
  {
    id: 'serve',
    say: serveSay,
    at: 'bottom',
    targets: () => ['kitchen.exit', 'shop.table'],
    done: (s) => servedSomething(s),
  },
  {
    id: 'great',
    say: 'Tuyệt vời! 🎉 Cứ thế phục vụ khách tới tối nhé. Phục vụ nhiều sẽ lên cấp ⭐, có nguyên liệu mới để sáng tạo món!',
    at: 'bottom',
    tapToContinue: true,
    targets: () => [],
    done: () => false,
  },
];

export function currentStep(s: GameState): TutorialStep | null {
  if (s.tutorial.done) return null;
  return TUTORIAL[s.tutorial.step] ?? null;
}

/** Chỗ đang được chỉ vào. */
export function tutorialTargets(s: GameState, ui?: TutorialUi): string[] {
  return currentStep(s)?.targets(s, ui) ?? [];
}

/** Sang bước sau (hoặc kết thúc). */
export function advanceTutorial(s: GameState) {
  s.tutorial.step += 1;
  if (s.tutorial.step >= TUTORIAL.length) s.tutorial.done = true;
}

export function skipTutorial(s: GameState) {
  s.tutorial.done = true;
}

/** Câu Chú Tư giới thiệu nút mới sáng ngày 2 / 3 (có giọng đọc). */
export const UNLOCK_SAY = {
  day2: '🔓 Quen chợ rồi! Từ nay bấm 🧾 Mua theo menu là giỏ tự đủ đồ. Mở thêm 📒 Sổ tay, 📦 Kho, 🧽 Lau và 📖 Sổ món nha con!',
  day3: '🔓 Mở thêm 🚶 Ra phố, 🔧 Nâng cấp (mua thêm bàn, bếp), 🧱 Bố trí, 📋 Bảng và 👥 Người giúp. Từ từ khám phá nha!',
};

/** Câu đầu bếp nói cho một ghi chú (lên cấp, món mới...). */
export function noteText(n: ChefNote): string {
  if (n.kind === 'levelUp') {
    const items = ingredientsOfLevel(n.level).map((i) => INGREDIENTS[i].emoji).join(' ');
    return `⭐ Lên cấp ${n.level}! Mở khoá ${items}. Vào 📖 Sổ món thử kết hợp nguyên liệu tạo món mới nhé!`;
  }
  if (n.kind === 'newDish') {
    const r = RECIPES[n.recipeId];
    return `🎉 ${r.emoji} ${r.name} lên menu rồi! Hôm nay khách sẽ gọi món mới nhiều hơn đó.`;
  }
  if (n.kind === 'trend') {
    const r = RECIPES[n.recipeId];
    const why = n.source === 'viral' ? 'Khách quay clip lên mạng' : n.source === 'reviewer' ? 'Food reviewer khen' : 'Món mới ra mắt gây sốt';
    return `🔥 ${why}: ${r.emoji} ${r.name} thành TREND! 3 ngày tới giá +20%, khách đông gấp rưỡi. Nấu nhiều vào nhé!`;
  }
  if (n.kind === 'role') {
    const role = n.role === 'prep' ? '🔪 phụ bếp' : n.role === 'cook' ? '👨‍🍳 đầu bếp' : '🍽️ phục vụ';
    return `👥 Giờ con thuê được ${role} rồi! Có cả 🎓 sinh viên giá rẻ — nhưng coi chừng các em vụng về nha.`;
  }
  if (n.kind === 'news') return n.text;
  if (n.kind === 'unlock')
    return n.key === 'day2' ? UNLOCK_SAY.day2 : UNLOCK_SAY.day3;
  if (n.kind === 'notebook') return '📒 Mở Sổ tay coi việc hôm nay nè! Xong việc có tiền, 🎟️ vé thưởng, việc khó còn có ⭐ sao hy vọng. Tối về nhớ viết nhật ký nha!';
  if (n.kind === 'autoClaim') return '🎁 Hôm qua con quên nhận thưởng nhiệm vụ, chú bỏ vô túi cho con rồi đó!';
  return 'Chọn 2–4 nguyên liệu bỏ vào nồi rồi bấm 🧪 Nấu thử!';
}
