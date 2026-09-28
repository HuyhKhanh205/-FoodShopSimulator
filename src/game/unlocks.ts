import { unlockedRoles } from './progression';
import { levelOf } from './progression';
import type { GameState } from './types';

/**
 * Lịch mở tính năng (3 ngày đầu ẩn bớt nút cho dễ chơi):
 * – ngày 1: chỉ 🛒 Chợ + 👉 Làm tiếp (ở chợ: sạp, giỏ, 💳, 🏮);
 * – ngày 2: 📒 Sổ tay, 🧽 Lau, 📦 Kho, 🧾 Mua theo menu, 📋 ngăn Thêm, 📖 Sổ món;
 * – ngày 3: 🚶 Ra phố, 👥 Người, 📋 Bảng, 🧱 Bố trí, 🔲 Đổi chế độ, 🔧 Nâng cấp, 🧑‍🍳 Chủ quán, 💳 Nợ.
 * Một bảng duy nhất để chỉnh.
 */
export type UiFeature =
  | 'notebook' // 📒 Sổ tay + 🌟 món đặc biệt
  | 'lab' // 📖 Sổ món + thanh cấp
  | 'staff' // 👥 Người giúp
  | 'manage' // 🔧 Nâng cấp, 🧑‍🍳 Chủ quán, 💳 nợ
  | 'debt' // số nợ trên HUD
  | 'stock' // 📦 Kho
  | 'clean' // 🧽 Lau
  | 'panel' // 📋 Bảng
  | 'arrange' // 🧱 Bố trí
  | 'modeToggle' // nút Đơn giản / 3D
  | 'perfHint' // bảng "máy chậm"
  | 'quickBuy' // 🧾 Mua theo menu (ngày đầu mua tay theo Chú Tư)
  | 'more' // 📋 ngăn Thêm ở chợ (cấp, món)
  | 'street'; // 🚶 Ra phố

export function shows(s: GameState, f: UiFeature): boolean {
  const tut = s.tutorial.done;
  switch (f) {
    case 'notebook':
      return tut && s.day >= 2;
    case 'lab':
      return s.day >= 2 || levelOf(s.xp) >= 2;
    case 'staff':
      return s.day >= 3 && unlockedRoles(s).length > 0;
    case 'stock':
    case 'more':
      return s.day >= 2;
    case 'quickBuy':
      return s.day >= 2 || tut;
    case 'manage':
    case 'debt':
    case 'street':
      return s.day >= 3;
    case 'clean':
      return s.day >= 2 || s.cleanliness < 60;
    case 'panel':
    case 'arrange':
      return s.day >= 3;
    case 'modeToggle':
      return tut && s.day >= 3;
    case 'perfHint':
      return tut;
  }
}

/** Tính năng mở vào sáng ngày `day` (để Chú Tư báo). */
export const UNLOCK_DAY: { day: number; key: 'day2' | 'day3' }[] = [
  { day: 2, key: 'day2' },
  { day: 3, key: 'day3' },
];
