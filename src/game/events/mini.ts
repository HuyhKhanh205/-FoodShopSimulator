import type { MiniType } from './types';

/** Tên + cách chơi của 13 kiểu mini game (hiện lúc đếm ngược 3-2-1 và trong sổ Kỷ lục). */
export const MINI_INFO: Record<MiniType, { emoji: string; name: string; hint: string }> = {
  tap: { emoji: '👆', name: 'Chạm thần tốc', hint: 'Chạm thật nhanh!' },
  catch: { emoji: '🏃', name: 'Đuổi bắt', hint: 'Chạm trúng mục tiêu!' },
  sequence: { emoji: '🧠', name: 'Nhớ thứ tự', hint: 'Nhớ rồi bấm lại đúng thứ tự' },
  timing: { emoji: '🎯', name: 'Canh đúng lúc', hint: 'Chạm khi vạch vào ô xanh' },
  pick: { emoji: '🔎', name: 'Chọn đúng', hint: 'Chọn một hình đúng' },
  whack: { emoji: '🔨', name: 'Đập trúng', hint: 'Đập khi nó thò lên!' },
  balance: { emoji: '⚖️', name: 'Giữ thăng bằng', hint: 'Bấm ◀ ▶ giữ mâm thẳng' },
  memory: { emoji: '🃏', name: 'Lật hình', hint: 'Tìm các cặp giống nhau' },
  slice: { emoji: '🔪', name: 'Chém rau', hint: 'Chạm rau bay lên, né 🌶️' },
  stack: { emoji: '🥣', name: 'Xếp bát', hint: 'Chạm để thả bát chồng lên' },
  spot: { emoji: '👀', name: 'Tìm điểm khác', hint: 'Tìm 3 chỗ khác ở hình phải' },
  quiz: { emoji: '❓', name: 'Đố vui', hint: 'Trả lời 3 câu hỏi' },
  rhythm: { emoji: '🥁', name: 'Theo nhịp', hint: 'Chạm khi nốt rơi tới vạch' },
};

export const MINI_TYPES = Object.keys(MINI_INFO) as MiniType[];

/** Ngân hàng câu đố ẩm thực (đáp án đúng luôn là phần tử đầu; khi hiện sẽ xáo trộn). */
export const QUIZ: { q: string; a: string[] }[] = [
  { q: 'Phở bò làm từ bánh gì?', a: ['🍜 Bánh phở', '🥖 Bánh mì', '🍪 Bánh quy', '🍩 Bánh vòng'] },
  { q: 'Trà đá mát nhờ gì?', a: ['🧊 Đá', '🔥 Lửa', '🧂 Muối', '🍯 Mật ong'] },
  { q: 'Nước mắm làm từ gì?', a: ['🐟 Cá', '🥕 Cà rốt', '🍋 Chanh', '🍫 Sô cô la'] },
  { q: 'Cơm nấu từ gì?', a: ['🌾 Gạo', '🌽 Ngô', '🥔 Khoai', '🫘 Đậu'] },
  { q: 'Chè thường có vị gì?', a: ['🍬 Ngọt', '🧂 Mặn', '😖 Đắng', '🍋 Chua'] },
  { q: 'Gỏi cuốn cuốn bằng gì?', a: ['🫓 Bánh tráng', '🍌 Lá chuối', '📰 Giấy báo', '🥖 Bánh mì'] },
  { q: 'Ớt có vị gì?', a: ['🌶️ Cay', '🍬 Ngọt', '🧂 Mặn', '🍋 Chua'] },
  { q: 'Thứ nào dễ hỏng nhất?', a: ['🥩 Thịt tươi', '🧂 Muối', '🍚 Gạo', '🍬 Đường'] },
  { q: 'Trước khi nấu nên làm gì?', a: ['🧼 Rửa tay', '📱 Chơi game', '😴 Đi ngủ', '🏃 Chạy bộ'] },
  { q: 'Bún chả nổi tiếng ở đâu?', a: ['🏯 Hà Nội', '🗼 Paris', '🗻 Tokyo', '🗽 New York'] },
  { q: 'Cà phê sữa đá gồm gì?', a: ['☕ Cà phê, sữa, đá', '🍵 Trà, muối', '🥛 Sữa, ớt', '🧃 Nước cam'] },
  { q: 'Dao thái xong nên làm gì?', a: ['🧽 Rửa sạch, cất gọn', '🗑️ Vứt đi', '🛏️ Để lên giường', '🎒 Bỏ vào cặp'] },
  { q: 'Trứng gà luộc chín thì lòng đỏ màu gì?', a: ['🟡 Vàng', '🟢 Xanh lá', '🔵 Xanh dương', '🟣 Tím'] },
  { q: 'Rau nào hay ăn kèm phở?', a: ['🌿 Húng quế', '🍓 Dâu tây', '🍫 Sô cô la', '🍿 Bắp rang'] },
  { q: 'Bánh mì Việt Nam giòn nhờ đâu?', a: ['🔥 Nướng lò', '🧊 Ướp đá', '💧 Ngâm nước', '🌞 Phơi nắng'] },
  { q: 'Thịt sống nên cất ở đâu?', a: ['🧊 Tủ lạnh', '☀️ Ngoài nắng', '🛋️ Trên ghế', '🎒 Trong cặp'] },
];
