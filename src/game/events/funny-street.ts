import { all, bigOrder, chance, crowd, delivery, follow, fun, guests, hasMoney, later, money, none, rent, rep, seats, sell, stove, tell } from './kit';
import type { EventDef } from './types';

/** D. Hàng xóm & phố phường — 15 tình huống. */

follow('st_wedding', all(tell('Nhà hàng xóm cưới xong, đặt quán 20 phần cỗ cảm ơn!'), money(400_000), stove(20_000)));
follow('st_neighbor', all(tell('Nhà hát karaoke thành khách quen, còn rủ cả họ tới ăn!'), crowd(1.1, 3)));
follow('st_lion', all(tell('Lộc múa lân tới rồi! Khách kéo tới đông vui.'), crowd(1.3)));
follow('st_lottery', chance(0.05, all(tell('Vé số hôm qua trúng 1 triệu! Hên quá!'), money(1_000_000)), tell('Vé số hôm qua… trật lất rồi.')));
follow('st_landlord_good', chance(0.3, all(tell('Chủ nhà vui vẻ, miễn tiền nhà hôm nay!'), rent(0, 1)), tell('Chủ nhà khen món ngon, hẹn lần sau ghé tiếp.')));
follow('st_landlord_bad', chance(0.5, all(tell('Chủ nhà phật ý, tăng tiền nhà mấy hôm…'), rent(1.2, 5)), tell('Chủ nhà quên chuyện hôm qua rồi.')));
follow('st_band', all(tell('Ban nhạc giới thiệu quán cho fan, fan kéo tới ăn!'), crowd(1.15)));

export const FUNNY_STREET: EventDef[] = [
  fun({
    id: 'st_wedding',
    phase: 'day',
    emoji: '💒',
    title: 'Đám cưới hàng xóm mượn bàn',
    body: 'Nhà bên có đám cưới, thiếu bàn ghế. Cô dâu chú rể sang xin mượn!',
    choices: [
      {
        label: 'Xếp bàn ghế giúp',
        game: { type: 'stack', params: { emoji: '🪑', need: 5, prompt: 'Chồng ghế thật cao mang sang!' }, win: all(seats(-1), later(1, 'st_wedding', 'Nhà cưới hứa cảm ơn…')), lose: all(seats(-2), rep(0.02)), winSay: 'Chồng ghế cao vút mang sang một lượt, nhà cưới cảm ơn rối rít!', loseSay: 'Ghế đổ ầm ầm, phải mang sang mấy lượt… mất thêm bàn.' },
      },
      { label: 'Cho mượn 2 bàn', say: 'Nhà cưới vui lắm, hứa sẽ đền đáp.', fx: all(seats(-2), later(1, 'st_wedding', 'Nhà cưới hứa cảm ơn…')) },
      { label: 'Từ chối', say: 'Nhà bên đi mượn chỗ khác.' },
    ],
  }),
  fun({
    id: 'st_karaoke',
    phase: 'day',
    emoji: '🎤',
    title: 'Nhà bên hát karaoke ầm ĩ',
    body: 'Nhà bên mở loa kéo hát “Em của ngày hôm qua” to hết cỡ. Khách không nghe nhau nói!',
    choices: [
      {
        label: 'Hát đè cho vui',
        game: { type: 'rhythm', params: { emoji: '🎵', need: 12 }, win: all(guests(3), rep(0.04)), lose: rep(-0.04), winSay: 'Quán hát hay hơn! Người đi đường dừng lại xem, vào ăn luôn.', loseSay: 'Hai bên hát loạn xạ, khách bịt tai bỏ đi…' },
      },
      { label: 'Mang bánh sang làm quen', say: 'Nhà bên ngại quá, vặn nhỏ loa, còn hứa ghé ăn.', fx: all(money(-20_000), later(1, 'st_neighbor', 'Hàng xóm có vẻ quý quán…')) },
    ],
  }),
  fun({
    id: 'st_roadworks',
    phase: 'morning',
    emoji: '🚧',
    title: 'Đào đường trước quán',
    body: 'Sáng ra, công nhân rào chắn, đào một cái hố to ngay trước cửa quán!',
    choices: [
      { label: 'Làm bảng chỉ lối 100k', enabled: hasMoney(100_000), say: 'Bảng chỉ lối vẽ mũi tên to, khách vẫn tìm được.', fx: all(money(-100_000), crowd(0.9)) },
      { label: 'Kệ', say: 'Khách thấy rào chắn là quay đầu…', fx: crowd(0.6, 2) },
    ],
  }),
  fun({
    id: 'st_lion_dance',
    phase: 'day',
    emoji: '🦁',
    title: 'Đoàn múa lân ghé',
    body: 'Tùng tùng xèng! Đoàn múa lân dừng trước quán, xin được múa lấy lộc.',
    choices: [
      {
        label: 'Đánh trống cùng đoàn',
        game: { type: 'timing', params: { emoji: '🥁', prompt: 'Đánh trống đúng nhịp!' }, win: all(money(-50_000), crowd(1.2), later(1, 'st_lion', 'Lộc sẽ tới…')), lose: money(-50_000), winSay: 'Trống vang rộn rã, lân nhảy cực đẹp! Đoàn chúc quán phát tài.', loseSay: 'Lệch nhịp, lân vấp chân… vẫn vui!' },
      },
      { label: 'Lì xì 100k', enabled: hasMoney(100_000), say: 'Lân múa đẹp tuyệt, chúc quán năm nay phát lộc.', fx: all(money(-100_000), later(1, 'st_lion', 'Lộc sẽ tới…')) },
      { label: 'Không lì xì', fx: chance(0.5, tell('Đoàn lân cười, múa xong đi tiếp.'), all(tell('Lân ngồi lì trước cửa, khách không vào được…'), stove(20_000), crowd(0.9))) },
    ],
  }),
  fun({
    id: 'st_lottery_seller',
    phase: 'day',
    emoji: '🎫',
    title: 'Cô bán vé số mời mua',
    body: 'Cô bán vé số cười hiền: “Mua giùm cô một tờ lấy hên nha con!”',
    choices: [
      { label: 'Mua 1 tờ 10k', say: 'Cô cảm ơn, chúc quán mua may bán đắt.', fx: all(money(-10_000), later(1, 'st_lottery', 'Mai dò số…')) },
      { label: 'Thôi ạ', say: 'Cô vẫn cười, đi tiếp.' },
    ],
  }),
  fun({
    id: 'st_no_water',
    phase: 'morning',
    emoji: '🚱',
    title: 'Cúp nước',
    body: 'Vòi nước chỉ nhỏ giọt tong tong. Hôm nay cả phố bị cúp nước!',
    choices: [
      { label: 'Mua nước bình 80k', enabled: hasMoney(80_000), say: 'Có nước sạch, bếp chạy bình thường.', fx: money(-80_000) },
      { label: 'Tiết kiệm nước', say: 'Rửa bát chậm, bếp cũng chậm theo.', fx: stove(30_000) },
    ],
  }),
  fun({
    id: 'st_sidewalk',
    phase: 'day',
    emoji: '👮',
    title: 'Dân phòng nhắc lấn vỉa hè',
    body: 'Chú dân phòng thổi còi: “Bàn ghế lấn ra vỉa hè rồi nha!”',
    choices: [
      { label: 'Dọn ghế vào ngay', say: 'Chú dân phòng khen quán chấp hành tốt.', fx: all(seats(-1), rep(0.02)) },
      { label: 'Nộp phạt 100k', say: 'Nộp phạt xong, bàn ghế vẫn để ngoài.', fx: money(-100_000) },
    ],
  }),
  fun({
    id: 'st_tourists',
    phase: 'day',
    emoji: '🗺️',
    title: 'Đoàn khách du lịch Tây',
    body: '“Hello! Six phở please, very fast!” Cả đoàn khách Tây đói bụng kéo vào.',
    choices: [
      {
        label: 'Bưng nhanh 6 bát',
        game: { type: 'balance', params: { emoji: '🍜🍜🍜' }, win: all(money(180_000), rep(0.06)), lose: all(money(60_000), rep(-0.02)), winSay: 'Six phở nóng hổi! Khách Tây giơ ngón cái: “Very good!”', loseSay: 'Đổ mất 2 bát… khách Tây vẫn cười nhưng chờ lâu.' },
      },
      { label: 'Vẽ menu bằng hình', say: 'Khách Tây chỉ hình gọi món, ai cũng vui.', fx: all(guests(4), stove(10_000)) },
      { label: 'Chỉ tay ra hiệu', say: 'Khách Tây gọi lung tung, rồi đi quán khác.' },
    ],
  }),
  fun({
    id: 'st_marathon',
    phase: 'day',
    emoji: '🏃',
    title: 'Giải chạy bộ đi ngang',
    body: 'Hàng trăm người chạy bộ đi ngang qua quán, ai cũng mồ hôi nhễ nhại.',
    choices: [
      { label: 'Phát nước miễn phí', say: 'Vận động viên cảm ơn, ban tổ chức khen quán trên loa!', fx: all(money(-60_000), rep(0.15)) },
      { label: 'Bán nước', say: 'Bán đắt như tôm tươi!', fx: money(120_000) },
    ],
  }),
  fun({
    id: 'st_students',
    phase: 'day',
    emoji: '🎓',
    title: 'Học sinh thi xong ùa vào',
    body: 'Chuông reo, học sinh thi xong ùa ra như ong vỡ tổ, bụng đói meo!',
    choices: [
      { label: 'Giảm giá học sinh', say: 'Học sinh đông nghịt, lời ít nhưng vui!', fx: all(sell(0.85), crowd(1.5)) },
      { label: 'Giá bình thường', say: 'Vài bạn vào ăn, còn lại đi hàng rong.', fx: guests(1) },
    ],
  }),
  fun({
    id: 'st_fire_drill',
    phase: 'day',
    emoji: '🚒',
    title: 'Diễn tập cứu hoả',
    body: 'Đội cứu hoả diễn tập trong phố, mời các quán cùng tham gia.',
    choices: [
      {
        label: 'Tìm lối thoát hiểm',
        game: { type: 'spot', params: { prompt: 'Tìm 3 chỗ nguy hiểm trong bếp!' }, win: all(stove(15_000), rep(0.08)), lose: stove(20_000), winSay: 'Tìm ra hết! Đội cứu hoả tặng giấy khen “Quán an toàn”.', loseSay: 'Còn sót vài chỗ, đội cứu hoả nhắc nhở nhẹ.' },
      },
      { label: 'Tham gia diễn tập', say: 'Cả quán xếp hàng thoát hiểm, được khen ngoan.', fx: all(stove(20_000), rep(0.04)) },
      { label: 'Bán tiếp', say: 'Quán vẫn bán, đội cứu hoả hơi phật lòng.' },
    ],
  }),
  fun({
    id: 'st_lost_shipper',
    phase: 'day',
    emoji: '🛵',
    title: 'Shipper lạc đường gọi 5 lần',
    body: 'Anh shipper gọi lần thứ năm: “Quán ở đâu vậy chị ơi, em chạy vòng vòng nãy giờ!”',
    choices: [
      { label: 'Chỉ đường kiên nhẫn', say: 'Anh shipper tới nơi, còn nhận thêm đơn giúp quán.', fx: all(stove(8_000), delivery(1.5)) },
      { label: 'Huỷ đơn', say: 'Mất đơn, khách đặt hơi buồn.', fx: rep(-0.02) },
    ],
  }),
  fun({
    id: 'st_landlord',
    phase: 'morning',
    emoji: '🏡',
    title: 'Chủ nhà ghé chơi',
    body: 'Sáng sớm, bà chủ nhà ghé qua “xem quán làm ăn sao rồi”.',
    choices: [
      { label: 'Mời bà ăn sáng', say: 'Bà ăn ngon miệng, cười tít mắt.', fx: all(money(-30_000), later(1, 'st_landlord_good', 'Bà chủ nhà có vẻ vui…')) },
      { label: 'Lảng tránh', say: 'Bà chủ nhà nhìn quán, không nói gì.', fx: later(1, 'st_landlord_bad', 'Bà chủ nhà có vẻ không vui…') },
    ],
  }),
  fun({
    id: 'st_street_band',
    phase: 'day',
    emoji: '🎷',
    title: 'Ban nhạc đường phố xin diễn',
    body: 'Một ban nhạc với kèn, trống, ghi-ta xin diễn trước quán.',
    choices: [
      {
        label: 'Chơi nhạc cùng ban',
        game: { type: 'rhythm', params: { emoji: '🎷', need: 12 }, win: all(crowd(1.2), later(1, 'st_band', 'Ban nhạc hứa giới thiệu quán…')), lose: none, winSay: 'Hợp tấu đỉnh cao! Người xem vỗ tay rần rần.', loseSay: 'Lạc nhịp, ban nhạc cười rồi tự diễn tiếp.' },
      },
      { label: 'Cho diễn, boa 50k', say: 'Nhạc hay, khách ghé nghe rồi ăn luôn.', fx: all(money(-50_000), crowd(1.15)) },
      { label: 'Từ chối', say: 'Ban nhạc chuyển sang góc phố khác.' },
    ],
  }),
  fun({
    id: 'st_construction',
    phase: 'day',
    emoji: '🏗️',
    title: 'Công trường gọi 20 suất',
    body: 'Chú đội trưởng công trường gọi: “Cho 20 suất trưa, giao liền nha!”',
    choices: [
      { label: 'Nhận đơn lớn', say: 'Cả bếp hì hục nấu, công nhân khen no bụng!', fx: bigOrder(20) },
      { label: 'Từ chối', say: 'Chú đội trưởng gọi quán khác.' },
    ],
  }),
];
