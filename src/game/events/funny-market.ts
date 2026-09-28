import { all, chance, crowd, follow, fun, later, money, rep, sell, stock, stove, tell, tickets } from './kit';
import type { EventDef } from './types';

/** E. Chợ & nhà cung cấp (buổi sáng) — 10 tình huống. */

follow('m_wallet_owner', chance(0.5, all(tell('Chủ chiếc ví tìm tới cảm ơn, gửi 500 nghìn!'), money(500_000)), all(tell('Chủ chiếc ví viết thư cảm ơn dán trước chợ, ai cũng khen quán.'), rep(0.08))));

export const FUNNY_MARKET: EventDef[] = [
  fun({
    id: 'm_double_yolk',
    phase: 'morning',
    emoji: '🥚',
    title: 'Trứng hai lòng đỏ',
    body: 'Đập thử quả trứng: hai lòng đỏ! Bà bán trứng bảo cả rổ này đều vậy.',
    choices: [
      { label: 'Bán “trứng may mắn”', say: 'Khách thích thú gọi món trứng may mắn, giá cao hơn chút.', fx: all(stock('trung', 6), sell(1.08)) },
      { label: 'Ăn thử cho biết', say: 'Ngon tuyệt! Cả quán được bữa trứng ốp la hai lòng đỏ.', fx: stock('trung', 4) },
    ],
  }),
  fun({
    id: 'm_giant_veg',
    phase: 'morning',
    emoji: '🥬',
    title: 'Dì Sáu tặng bó rau khổng lồ',
    body: 'Dì Sáu ôm bó rau to bằng cái bàn: “Tặng con nè, nhưng phải tự cắt nha!”',
    choices: [
      {
        label: 'Cắt rau thật nhanh',
        game: { type: 'slice', params: { need: 8 }, win: all(stock('rau', 12), stock('hanh', 4)), lose: stock('rau', 4), winSay: 'Cắt gọn gàng, kho rau đầy ắp!', loseSay: 'Cắt lộn xộn, chỉ giữ được ít rau.' },
      },
      { label: 'Nhận cả bó', say: 'Kho rau xanh mướt!', fx: stock('rau', 8) },
      { label: 'Chụp ảnh đăng mạng', say: 'Ảnh “bó rau khổng lồ” được thả tim ào ào.', fx: all(stock('rau', 3), crowd(1.1)) },
    ],
  }),
  fun({
    id: 'm_salt_sugar',
    phase: 'morning',
    emoji: '🧂',
    title: 'Mua nhầm muối thành đường',
    body: 'Về tới quán mới biết: bao “đường” mua sáng nay là… muối!',
    choices: [
      { label: 'Quay lại chợ đổi', say: 'Mất chút thời gian và tiền xe, nhưng yên tâm.', fx: all(money(-30_000), stove(15_000)) },
      { label: 'Để vậy dùng tạm', fx: chance(0.5, tell('May mà hôm nay ít món cần đường, không sao!'), all(tell('Chè hôm nay… mặn chát, khách nhăn mặt.'), rep(-0.05))) },
    ],
  }),
  fun({
    id: 'm_fish_escape',
    phase: 'morning',
    emoji: '🐟',
    title: 'Cá lóc nhảy thau chạy khắp chợ',
    body: 'Con cá lóc của Cô Bảy nhảy khỏi thau, trườn khắp lối chợ!',
    choices: [
      {
        label: 'Đuổi bắt cá',
        game: { type: 'catch', params: { emoji: '🐟', need: 5 }, win: all(rep(0.04), stock('tom', 3)), lose: stove(10_000), winSay: 'Bắt được! Cô Bảy cảm ơn, tặng một bịch tôm.', loseSay: 'Trượt chân té ướt nhẹp, về quán trễ.' },
      },
      { label: 'Kệ, đi tiếp', say: 'Cá được người khác bắt giùm.' },
    ],
  }),
  fun({
    id: 'm_grandma_gift',
    phase: 'morning',
    emoji: '🎁',
    title: 'Bà Năm tặng quà khách quen',
    body: 'Bà Năm bán gạo cười: “Khách quen nè, chọn quà đi con!”',
    choices: [
      { label: 'Lấy bao gạo', say: 'Bao gạo thơm phức, nấu cơm dẻo ngon.', fx: stock('gao', 10) },
      { label: 'Lấy vé bốc thăm', say: 'Bà đưa 2 tấm vé may mắn.', fx: tickets(2) },
    ],
  }),
  fun({
    id: 'm_coconuts',
    phase: 'morning',
    emoji: '🥥',
    title: 'Giao nhầm 50 quả dừa',
    body: 'Xe giao hàng đổ xuống 50 quả dừa trước cửa. Quán đâu có đặt dừa!',
    choices: [
      { label: 'Mua rẻ, bán nước dừa', say: 'Nước dừa mát lạnh bán hết veo!', fx: money(150_000) },
      { label: 'Trả lại', say: 'Xe giao hàng cảm ơn rối rít, chở dừa đi.', fx: rep(0.02) },
    ],
  }),
  fun({
    id: 'm_flash_sale',
    phase: 'morning',
    emoji: '⚡',
    title: 'Chợ giảm giá chớp nhoáng',
    body: 'Loa chợ vang lên: “Giảm giá sốc 10 phút!” Ai cũng chen lấn mua.',
    choices: [
      { label: 'Mua tích trữ', say: 'Kho đầy ắp thịt rau, nhớ bán nhanh kẻo hỏng!', fx: all(money(-120_000), stock('thit_heo', 6), stock('rau', 8), stock('ga', 4)) },
      { label: 'Mua vừa đủ', say: 'Mua thêm chút, tiết kiệm được ít tiền.', fx: all(money(-30_000), stock('rau', 4)) },
    ],
  }),
  fun({
    id: 'm_grandma_ride',
    phase: 'morning',
    emoji: '👵',
    title: 'Cụ bà xin đi nhờ xe',
    body: 'Cụ bà xách giỏ nặng, hỏi nhờ chở về gần quán.',
    choices: [
      { label: 'Chở cụ về', say: 'Cụ cảm ơn, kể với cả xóm về chủ quán tốt bụng.', fx: all(stove(20_000), rep(0.06)) },
      { label: 'Chỉ đường cho cụ', say: 'Cụ gật đầu, gọi xe ôm.' },
    ],
  }),
  fun({
    id: 'm_watermelon',
    phase: 'morning',
    emoji: '🍉',
    title: 'Dưa hấu rớt vỡ trước sạp',
    body: 'Xe dưa hấu thắng gấp, vài quả rớt vỡ đỏ au. Chủ xe bán rẻ luôn.',
    choices: [
      { label: 'Mua rẻ làm nước dưa', say: 'Nước ép dưa hấu mát lạnh, khách thích mê!', fx: all(money(-20_000), money(90_000)) },
      { label: 'Đi tiếp', say: 'Hơi tiếc, nhưng thôi.' },
    ],
  }),
  fun({
    id: 'm_found_wallet',
    phase: 'morning',
    emoji: '👛',
    title: 'Nhặt được ví ở chợ',
    body: 'Dưới sạp rau có một chiếc ví dày cộm. Trong ví có giấy tờ tên chủ.',
    choices: [
      { label: 'Trả lại chủ', say: 'Gửi ví cho ban quản lý chợ để trả chủ.', fx: all(rep(0.03), later(1, 'm_wallet_owner', 'Chủ ví sẽ tìm tới…')) },
      { label: 'Giữ lại', fx: chance(0.6, all(tell('Camera chợ quay được… cả chợ xì xào về quán.'), rep(-0.25)), all(tell('Lương tâm cắn rứt, cuối cùng vẫn mang đi trả.'), rep(0.02))) },
    ],
  }),
];
