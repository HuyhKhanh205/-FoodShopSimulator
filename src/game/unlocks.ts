import { unlockedRoles } from './progression';
import { levelOf } from './progression';
import type { GameState } from './types';

/**
 * Lịch mở tính năng: ngày đầu chỉ thấy vòng chính (mua → mở cửa → sơ chế → nấu → mang món),
 * các nút khác hiện dần theo ngày / cấp. Một bảng duy nhất để chỉnh.
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
  | 'perfHint'; // bảng "máy chậm"

export function shows(s: GameState, f: UiFeature): boolean {
  const tut = s.tutorial.done;
  switch (f) {
    case 'notebook':
      return tut && s.day >= 2;
    case 'lab':
      return s.day >= 2 || levelOf(s.xp) >= 2;
    case 'staff':
      return unlockedRoles(s).length > 0;
    case 'manage':
    case 'debt':
    case 'stock':
      return s.day >= 2;
    case 'clean':
      return s.day >= 2 || s.cleanliness < 60;
    case 'panel':
    case 'arrange':
      return s.day >= 3;
    case 'modeToggle':
    case 'perfHint':
      return tut;
  }
}

/** Tính năng mở vào sáng ngày `day` (để Chú Tư báo). */
export const UNLOCK_DAY: { day: number; key: 'day2' | 'day3' }[] = [
  { day: 2, key: 'day2' },
  { day: 3, key: 'day3' },
];
