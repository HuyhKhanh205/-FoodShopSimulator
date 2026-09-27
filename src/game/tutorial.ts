import { INGREDIENTS, RECIPES } from './data';
import { usableQty } from './helpers';
import { ingredientsOfLevel } from './progression';
import type { ChefNote, GameState, IngredientId } from './types';

/** Trạng thái giao diện mà kịch bản cần biết (không nằm trong GameState). */
export interface TutorialUi {
  /** Đang ở màn bếp góc nhìn thứ nhất. */
  fpOpen: boolean;
}

export interface TutorialStep {
  id: string;
  /** Câu đầu bếp nói. */
  say: string;
  /** Đầu bếp đứng trên / dưới để không che chỗ cần bấm. */
  at: 'top' | 'bottom';
  /** Bước chỉ cần bấm ▶ Tiếp. */
  tapToContinue?: boolean;
  /** Các chỗ cần chỉ vào (viền vàng + 👆). */
  targets: (s: GameState) => string[];
  /** Xong bước này chưa. */
  done: (s: GameState, ui: TutorialUi) => boolean;
}

/** Món đầu tiên: bánh mì trứng. */
const FIRST: IngredientId[] = ['banh_mi', 'trung', 'pate', 'hanh'];
const missingFirst = (s: GameState) => FIRST.filter((i) => usableQty(s, i) < 1);
const cookingOrHolding = (s: GameState) =>
  Boolean(s.run && (s.run.slots.some((sl) => sl.job?.by === 'player') || s.run.carrying.length > 0));
const servedSomething = (s: GameState) =>
  Boolean(s.report.served > 0 || s.run?.customers.some((c) => c.items.some((i) => i.served)));

/** Kịch bản dẫn từng bước trong ngày đầu. */
export const TUTORIAL: TutorialStep[] = [
  {
    id: 'hello',
    say: 'Chào chủ quán mới! Mình là bếp trưởng Tư 👨‍🍳. Mình sẽ chỉ bạn bán món đầu tiên nhé!',
    at: 'bottom',
    tapToContinue: true,
    targets: () => [],
    done: () => false,
  },
  {
    id: 'buy',
    say: `Món đầu tiên là 🥪 Bánh mì trứng = ${FIRST.map((i) => INGREDIENTS[i].emoji).join(' + ')}. Bấm +5 ở mỗi thứ nhé!`,
    at: 'top',
    targets: (s) => missingFirst(s).map((i) => `market.buy:${i}`),
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
    say: 'Hành 🧅 phải thái trước. Chọn 🧅 rồi chạm thớt thật nhanh!',
    at: 'top',
    targets: (s) => (s.run?.playerPrep ? ['kitchen.board'] : ['kitchen.prep:hanh']),
    done: (s) => (s.run?.prepped.hanh ?? 0) > 0 || cookingOrHolding(s) || servedSomething(s),
  },
  {
    id: 'cook',
    say: 'Giỏi! Giờ chọn 🥪 để nấu trên bếp.',
    at: 'top',
    targets: () => ['kitchen.recipe:banh_mi_trung'],
    done: (s) => cookingOrHolding(s) || servedSomething(s),
  },
  {
    id: 'take',
    say: 'Chạm vào chảo để đảo cho nhanh. Chín ✅ thì bấm 🍽️ Lấy ra!',
    at: 'top',
    targets: () => ['kitchen.takeout'],
    done: (s) => Boolean(s.run && s.run.carrying.length > 0) || servedSomething(s),
  },
  {
    id: 'serve',
    say: 'Bấm 🍽️➡ để ra quán, rồi chạm vào bàn khách đang chờ 🥪.',
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
export function tutorialTargets(s: GameState): string[] {
  return currentStep(s)?.targets(s) ?? [];
}

/** Sang bước sau (hoặc kết thúc). */
export function advanceTutorial(s: GameState) {
  s.tutorial.step += 1;
  if (s.tutorial.step >= TUTORIAL.length) s.tutorial.done = true;
}

export function skipTutorial(s: GameState) {
  s.tutorial.done = true;
}

/** Câu đầu bếp nói cho một ghi chú (lên cấp, món mới...). */
export function noteText(n: ChefNote): string {
  if (n.kind === 'levelUp') {
    const items = ingredientsOfLevel(n.level).map((i) => INGREDIENTS[i].emoji).join(' ');
    return `⭐ Lên cấp ${n.level}! Mở khoá ${items}. Vào 🧪 Bếp thử món để sáng tạo món mới nhé!`;
  }
  if (n.kind === 'newDish') {
    const r = RECIPES[n.recipeId];
    return `🎉 Món mới: ${r.emoji} ${r.name}! Mình đã thêm vào menu, khách sẽ bắt đầu gọi đó.`;
  }
  return 'Chọn 2–4 nguyên liệu bỏ vào nồi rồi bấm 🧪 Nấu thử!';
}
