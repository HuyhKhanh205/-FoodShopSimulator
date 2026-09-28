import { all, clean, crowd, follow, fun, guests, later, money, rep, stars, stock, tickets, tell, xp } from './kit';
import type { EventDef } from './types';

/** Sự kiện mini game (#113–#124) — thuần vui, thắng thì có thưởng. Trộn chung kho. */

const W = 2.5;
const SKIP = { label: 'Thôi, đang bận', say: 'Để lần sau vậy!' };

follow('mg_fair', all(tell('Hội chợ hôm qua giúp quán nổi tiếng, khách kéo tới!'), crowd(1.2)));
follow('mg_friend_shop', all(tell('Quán bạn giới thiệu khách sang ăn, đông vui!'), crowd(1.15)));

export const MINI_EVENTS: EventDef[] = [
  fun({
    id: 'mg_food_fair',
    phase: 'morning',
    emoji: '🎪',
    title: 'Hội chợ ẩm thực phố',
    weight: W,
    body: 'Hội chợ ẩm thực mở cửa! Chọn một gian trò chơi để thử tài.',
    choices: [
      { label: 'Gian chém rau', game: { type: 'slice', params: { need: 10 }, win: all(tickets(5), later(1, 'mg_fair', 'Hội chợ sẽ giúp quán nổi tiếng…')), lose: tickets(1), winSay: 'Chém rau như ninja! Được 5 vé và tiếng tăm.', loseSay: 'Chém trượt tùm lum, nhận vé an ủi.' } },
      { label: 'Gian xếp bát', game: { type: 'stack', params: { need: 7 }, win: all(tickets(5), later(1, 'mg_fair', 'Hội chợ sẽ giúp quán nổi tiếng…')), lose: tickets(1), winSay: 'Tháp bát cao nhất hội chợ! Được 5 vé.', loseSay: 'Bát đổ mất rồi, nhận vé an ủi.' } },
      { label: 'Gian đố vui', game: { type: 'quiz', win: all(tickets(5), later(1, 'mg_fair', 'Hội chợ sẽ giúp quán nổi tiếng…')), lose: tickets(1), winSay: 'Trả lời đúng hết! Được 5 vé.', loseSay: 'Sai vài câu, nhận vé an ủi.' } },
    ],
  }),
  fun({
    id: 'mg_lanterns',
    phase: 'day',
    emoji: '🏮',
    title: 'Đêm hội đèn lồng',
    weight: W,
    body: 'Phố treo đèn lồng rực rỡ. Ban tổ chức mời các quán thi ghép đôi đèn lồng!',
    choices: [
      { label: 'Tham gia ghép đèn', game: { type: 'memory', params: { need: 5 }, win: all(stars(1), crowd(1.2)), lose: rep(0.01), winSay: 'Ghép đúng hết! Được sao hy vọng, khách tới ngắm đèn đông vui.', loseSay: 'Ghép chưa kịp, nhưng vẫn vui.' } },
      SKIP,
    ],
  }),
  fun({
    id: 'mg_egg_crack',
    phase: 'day',
    emoji: '🥚',
    title: 'Thi đập trứng một tay',
    weight: W,
    body: 'Chú Tư thách: “Đập trứng một tay không vỡ lòng đỏ, ba quả liền!”',
    choices: [
      { label: 'Nhận lời thách', game: { type: 'timing', params: { emoji: '🥚', prompt: 'Chạm đúng lúc để đập trứng!' }, win: xp(40), lose: stock('trung', -3), winSay: 'Ba quả tròn vo! Chú Tư giơ ngón cái.', loseSay: 'Lòng đỏ vỡ tan tành… mất 3 quả trứng.' } },
      SKIP,
    ],
  }),
  fun({
    id: 'mg_ten_bowls',
    phase: 'day',
    emoji: '🍜',
    title: 'Thử thách xếp 10 bát phở',
    weight: W,
    body: 'Khách thách chủ quán xếp chồng bát thật cao. Cả quán hò reo cổ vũ!',
    choices: [
      { label: 'Xếp thử xem', game: { type: 'stack', params: { need: 8 }, win: all(guests(5), rep(0.03)), lose: money(-20_000), winSay: 'Chồng bát cao ngất! Người đi đường dừng lại xem, vào ăn luôn.', loseSay: 'Choang! Vỡ mất vài cái bát.' } },
      SKIP,
    ],
  }),
  fun({
    id: 'mg_chicken_chase',
    phase: 'morning',
    emoji: '🐔',
    title: 'Đuổi gà sổng chuồng quanh chợ',
    weight: W,
    body: 'Gà của Bà Năm sổng chuồng chạy khắp chợ! Bà nhờ bắt giùm.',
    choices: [
      { label: 'Giúp bắt gà', game: { type: 'catch', params: { emoji: '🐔', need: 7 }, win: stock('trung', 10), lose: stock('trung', 2), winSay: 'Bắt đủ gà! Bà Năm tặng 10 quả trứng.', loseSay: 'Gà chạy nhanh quá… bà vẫn tặng 2 quả trứng.' } },
      SKIP,
    ],
  }),
  fun({
    id: 'mg_chili_contest',
    phase: 'day',
    emoji: '🌶️',
    title: 'Cuộc thi ăn ớt của phường',
    weight: W,
    body: 'Phường tổ chức thi ăn ớt. Giải nhất 300 nghìn! Phải bình tĩnh quạt cho nguội.',
    choices: [
      { label: 'Đăng ký thi', game: { type: 'tap', params: { emoji: '🌶️', need: 26, seconds: 7, prompt: 'Chạm thật nhanh để giữ bình tĩnh!' }, win: money(300_000), lose: rep(0.01), winSay: 'Vô địch ăn ớt! Mang về 300 nghìn.', loseSay: 'Cay chảy nước mắt, xin thua!' } },
      SKIP,
    ],
  }),
  fun({
    id: 'mg_falling_veg',
    phase: 'morning',
    emoji: '🧺',
    title: 'Hứng rau rơi từ xe tải',
    weight: W,
    body: 'Xe rau chạy qua ổ gà, rau củ rơi lả tả. Bác tài bảo: “Hứng được bao nhiêu thì lấy!”',
    choices: [
      { label: 'Hứng rau', game: { type: 'catch', params: { emoji: '🥬', need: 10, fall: true, prompt: 'Chạm rau đang rơi!' }, win: all(stock('rau', 10), stock('hanh', 5)), lose: stock('rau', 3), winSay: 'Hứng được cả rổ! Kho rau đầy ắp.', loseSay: 'Hứng được ít rau thôi.' } },
      SKIP,
    ],
  }),
  fun({
    id: 'mg_opening_drum',
    phase: 'day',
    emoji: '🥁',
    title: 'Trống khai trương quán bạn',
    weight: W,
    body: 'Quán của bạn thân khai trương, nhờ mình đánh trống mở màn!',
    choices: [
      { label: 'Đánh trống', game: { type: 'rhythm', params: { emoji: '🥁', need: 12 }, win: later(1, 'mg_friend_shop', 'Quán bạn hứa giới thiệu khách…'), lose: rep(0.01), winSay: 'Trống vang rộn rã! Quán bạn hứa giới thiệu khách sang.', loseSay: 'Lạc nhịp chút xíu, bạn vẫn cảm ơn.' } },
      SKIP,
    ],
  }),
  fun({
    id: 'mg_lost_cat',
    phase: 'day',
    emoji: '🔍',
    title: 'Truy tìm con mèo lạc của khách',
    weight: W,
    body: 'Bé khách khóc vì mèo lạc. Nhìn kỹ hai tấm ảnh, tìm chỗ khác nhau để lần ra mèo!',
    choices: [
      { label: 'Giúp tìm mèo', game: { type: 'spot', win: all(money(100_000), rep(0.05)), lose: rep(0.01), winSay: 'Tìm thấy mèo trốn trong thùng giấy! Bố bé boa lớn, hứa làm khách quen.', loseSay: 'Chưa tìm thấy… may mà mèo tự về.' } },
      SKIP,
    ],
  }),
  fun({
    id: 'mg_ring_toss',
    phase: 'day',
    emoji: '🎯',
    title: 'Ném vòng trúng thưởng',
    weight: W,
    body: 'Hội chợ đầu phố có trò ném vòng, ba vòng trúng là được sao hy vọng!',
    choices: [
      { label: 'Ném thử', game: { type: 'timing', params: { emoji: '⭕', prompt: 'Chạm đúng lúc để ném vòng!' }, win: stars(1), lose: tickets(1), winSay: 'Trúng cả ba! Được một ngôi sao hy vọng.', loseSay: 'Trượt rồi, được vé an ủi.' } },
      SKIP,
    ],
  }),
  fun({
    id: 'mg_uncle_quiz',
    phase: 'morning',
    emoji: '🧠',
    title: 'Đố vui cùng Chú Tư',
    weight: W,
    body: 'Chú Tư vừa nhặt rau vừa đố: “Trả lời đúng, chú dạy thêm bí kíp!”',
    choices: [
      { label: 'Trả lời đố', game: { type: 'quiz', win: all(xp(40), tickets(2)), lose: xp(5), winSay: 'Giỏi quá! Chú Tư dạy thêm bí kíp nấu ăn.', loseSay: 'Chú Tư cười: “Học thêm nha con!”' } },
      SKIP,
    ],
  }),
  fun({
    id: 'mg_speed_clean',
    phase: 'day',
    emoji: '🧹',
    title: 'Tổng vệ sinh thần tốc',
    weight: W,
    body: 'Vết bẩn xuất hiện khắp quán! Cùng lau thật nhanh trong vài giây.',
    choices: [
      { label: 'Lau ngay', game: { type: 'whack', params: { emoji: '🟤', need: 9, prompt: 'Chạm vết bẩn khi nó hiện ra!' }, win: all(clean(100), rep(0.03)), lose: clean(15), winSay: 'Quán sạch bong kin kít!', loseSay: 'Sạch được một ít.' } },
      SKIP,
    ],
  }),
];
