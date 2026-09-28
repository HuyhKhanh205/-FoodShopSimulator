import { all, chance, clean, crowd, follow, fun, guests, later, money, none, rep, seats, sell, stock, stove, tell, trend, xp } from './kit';
import type { EventDef } from './types';

/** A. Khách hài hước (trong giờ bán) — 25 tình huống. */

follow('g_ticket_pay', chance(0.7, all(tell('Ông khách vé số quay lại trả gấp đôi, còn cảm ơn rối rít!'), money(60_000)), tell('Ông khách vé số… chưa thấy quay lại.')));
follow('g_couple', all(tell('Cặp đôi hôm qua làm lành rồi, dắt cả nhóm bạn tới ăn!'), crowd(1.1)));
follow('g_wallet', chance(0.6, all(tell('Khách quên ví quay lại trả gấp đôi, kèm hộp bánh!'), money(80_000), rep(0.03)), tell('Khách quên ví… chắc quên luôn đường tới quán.')));
follow('g_celeb', all(tell('Người nổi tiếng hôm qua đăng bài khen quán 5★!'), rep(0.12), crowd(1.2)));
follow('g_grandpa', all(tell('Ông cụ kể chuyện dắt cả hội bạn già tới ăn sáng!'), crowd(1.1, 3), rep(0.03)));
follow('g_fortune_good', all(tell('Thầy bói nói đúng: hôm nay quán đông khách lạ!'), crowd(1.25)));
follow('g_fortune_bad', all(tell('“Có hạn nhỏ”: sáng nay vỡ mất chồng bát…'), money(-60_000)));

export const FUNNY_GUESTS: EventDef[] = [
  fun({
    id: 'g_snorer',
    phase: 'day',
    emoji: '😴',
    title: 'Ông khách ngủ ngáy chiếm bàn',
    body: 'Ăn xong, ông khách gục đầu ngủ ngáy khò khò. Tiếng ngáy to như máy cày!',
    choices: [
      { label: 'Để ông ngủ yên', say: 'Ông ngủ ngon lành, khách khác thấy quán thân thiện ghê.', fx: all(seats(-1), rep(0.03)) },
      { label: 'Bật nhạc sàn đánh thức', fx: chance(0.5, all(tell('Ông bật dậy nhảy theo nhạc, boa luôn 50 nghìn!'), money(50_000)), all(tell('Ông giật mình làm đổ ly trà, cả quán nhìn…'), rep(-0.04), clean(-5))) },
    ],
  }),
  fun({
    id: 'g_lottery_pay',
    phase: 'day',
    emoji: '🎟️',
    title: 'Trả tiền bằng vé số',
    body: 'Ông khách không có tiền lẻ, rút ra tờ vé số: “Trúng thì chia đôi nha!”',
    choices: [
      { label: 'Nhận vé số', fx: chance(0.1, all(tell('Trúng thật! Quán có thêm 2 triệu!'), money(2_000_000)), all(tell('Dò số… trật hết. Coi như mời ông bữa.'), money(-30_000))) },
      { label: 'Cho nợ, mai trả', say: 'Ông hứa mai quay lại trả.', fx: later(1, 'g_ticket_pay', 'Mai xem ông có quay lại không…') },
    ],
  }),
  fun({
    id: 'g_rooster_guest',
    phase: 'day',
    emoji: '🐔',
    title: 'Khách dắt gà trống vào quán',
    body: 'Một chú ôm gà trống vào quán, gà còn đòi ngồi ghế riêng!',
    choices: [
      { label: 'Cho gà ngồi cùng', say: 'Gà gáy “ò ó o” mỗi khi có món ra, người qua đường tò mò ghé vào.', fx: all(guests(2), clean(-10)) },
      { label: 'Mời gà ra ngoài', say: 'Chú khách hơi buồn, ôm gà ngồi ngoài vỉa hè.', fx: rep(-0.03) },
    ],
  }),
  fun({
    id: 'g_star_chef',
    phase: 'day',
    emoji: '👨‍🍳',
    title: '“Tôi là đầu bếp 5 sao!”',
    body: 'Một ông khách đòi vào bếp trổ tài. Ông bảo phải thi nhớ công thức với ông mới phục!',
    choices: [
      {
        label: 'Thi nhớ công thức',
        game: {
          type: 'sequence',
          params: { options: ['🥩', '🧅', '🥬', '🌶️'], need: 4, prompt: 'Nhớ thứ tự cho nguyên liệu!' },
          win: all(xp(30), trend(), rep(0.05)),
          lose: all(stove(10_000), rep(-0.02)),
          winSay: 'Ông phục sát đất, dạy thêm bí quyết nêm nếm rồi kể khắp phố!',
          loseSay: 'Ông cười ha hả rồi lỡ tay làm khét nồi…',
        },
      },
      { label: 'Lịch sự từ chối', say: 'Ông khách gật gù: “Quán có nguyên tắc, tốt!”' },
    ],
  }),
  fun({
    id: 'g_couple',
    phase: 'day',
    emoji: '💑',
    title: 'Cặp đôi cãi nhau ai trả tiền',
    body: 'Cả hai đều giành trả tiền, cãi nhau to tới mức cả quán quay lại nhìn!',
    choices: [
      { label: 'Gợi ý chia đôi', say: 'Mỗi người một nửa, ai cũng vui.' },
      { label: 'Tặng chè hoà giải', say: 'Hai bạn ăn chè ngọt, cười hì hì làm lành.', fx: all(money(-20_000), rep(0.03), later(1, 'g_couple', 'Hai bạn hứa quay lại…')) },
    ],
  }),
  fun({
    id: 'g_tiktok',
    phase: 'day',
    emoji: '💃',
    title: 'Nhóm TikToker nhảy giữa quán',
    body: 'Một nhóm bạn trẻ bật nhạc, nhảy ngay giữa lối đi để quay clip.',
    choices: [
      { label: 'Cho quay thoải mái', fx: chance(0.6, all(tell('Clip nổ tung mạng! Khách kéo tới xem quán “có điệu nhảy”.'), crowd(1.5, 2)), all(tell('Khách khác bực vì bị chắn lối…'), rep(-0.05))) },
      { label: 'Mời ra vỉa hè quay', say: 'Nhóm bạn ra ngoài quay, vẫn gắn tên quán.', fx: guests(1) },
    ],
  }),
  fun({
    id: 'g_ice_tea_100',
    phase: 'day',
    emoji: '🧋',
    title: 'Đặt 100 ly trà đá cho hội thao',
    body: 'Thầy thể dục chạy vào: “Cho 100 ly trà đá, học sinh khát lắm rồi!”',
    choices: [
      { label: 'Nhận cả 100 ly', say: 'Cả quán pha trà đá như chạy giặc, kiếm bộn nhưng hết sạch đá!', fx: all(money(250_000), stock('da', -20), stock('tra', -10), stove(15_000)) },
      { label: 'Nhận 30 ly thôi', say: 'Vừa sức, thầy cảm ơn.', fx: all(money(80_000), stock('da', -6)) },
      { label: 'Từ chối', say: 'Thầy chạy sang quán khác.' },
    ],
  }),
  fun({
    id: 'g_crying_kid',
    phase: 'day',
    emoji: '😭',
    title: 'Bé khóc đòi đồ chơi',
    body: 'Một bé khóc ré lên đòi đồ chơi, bố mẹ dỗ mãi không nín.',
    choices: [
      {
        label: 'Xếp tháp bát dỗ bé',
        game: { type: 'stack', params: { emoji: '🥣', need: 5 }, win: rep(0.06), lose: clean(-5), winSay: 'Tháp bát cao vút! Bé nín khóc, vỗ tay cười khanh khách.', loseSay: 'Bát đổ loảng xoảng, bé… khóc to hơn.' },
      },
      { label: 'Tặng bóng bay', say: 'Bé cầm bóng bay cười toe toét.', fx: all(money(-10_000), rep(0.03)) },
    ],
  }),
  fun({
    id: 'g_mime',
    phase: 'day',
    emoji: '👽',
    title: 'Khách chỉ nói bằng tay chân',
    body: 'Vị khách không nói gì, chỉ múa tay xoay xoay rồi làm động tác húp sùm sụp.',
    choices: [
      {
        label: 'Đoán món khách muốn',
        game: {
          type: 'pick',
          params: { prompt: 'Khách xoay tay, rồi húp sùm sụp. Món gì?', options: ['🍜 Phở', '🥖 Bánh mì', '☕ Cà phê', '🍚 Cơm'], answer: 0 },
          win: money(60_000),
          lose: rep(-0.04),
          winSay: 'Đúng phóc! Khách giơ ngón cái, boa gấp ba.',
          loseSay: 'Sai rồi… khách lắc đầu buồn bã.',
        },
      },
      { label: 'Mang cả menu ra', say: 'Khách chỉ tay vào món, xong xuôi êm đẹp.', fx: stove(5_000) },
    ],
  }),
  fun({
    id: 'g_no_wallet',
    phase: 'day',
    emoji: '👛',
    title: 'Khách quên ví',
    body: 'Ăn xong, khách lục túi mặt đỏ bừng: “Chết, quên ví ở nhà rồi!”',
    choices: [
      { label: 'Cho nợ', say: 'Khách cảm động, hứa mai quay lại.', fx: later(1, 'g_wallet', 'Mai chờ xem khách có trả không…') },
      { label: 'Giữ điện thoại làm tin', say: 'Khách chạy về lấy tiền, nhưng mặt không vui.', fx: rep(-0.04) },
    ],
  }),
  fun({
    id: 'g_see_kitchen',
    phase: 'day',
    emoji: '🕵️',
    title: 'Khách đòi xem bếp',
    body: 'Một vị khách nghiêm nghị: “Cho tôi xem bếp có sạch không đã!”',
    choices: [
      {
        label: 'Tìm chỗ bẩn trước khi mở cửa',
        game: { type: 'spot', params: { prompt: 'Tìm nhanh 3 chỗ lạ trong bếp!' }, win: all(rep(0.1), clean(10)), lose: rep(-0.15), winSay: 'Bếp sáng bóng! Khách gật gù khen hết lời.', loseSay: 'Khách thấy chiếc tất trong nồi… rồi lắc đầu bỏ đi.' },
      },
      { label: 'Cho xem luôn', fx: (s, rng) => (s.cleanliness >= 70 ? all(tell('Bếp sạch tinh tươm, khách khen nức nở!'), rep(0.1)) : all(tell('Khách nhìn sàn bếp rồi nhăn mặt…'), rep(-0.2)))(s, rng) },
      { label: '“Bếp bí mật!”', say: 'Khách hơi nghi ngờ nhưng vẫn ăn.', fx: rep(-0.02) },
    ],
  }),
  fun({
    id: 'g_celebrity',
    phase: 'day',
    emoji: '🕶️',
    title: 'Người nổi tiếng cải trang?',
    body: 'Người đeo kính đen, đội mũ sùm sụp trông rất quen. Có phải ca sĩ nổi tiếng không nhỉ?',
    choices: [
      {
        label: 'Nhận mặt qua ảnh',
        game: {
          type: 'pick',
          params: { prompt: 'Ca sĩ nổi tiếng luôn có nốt ruồi ở má. Ai là thật?', options: ['😎 Có nốt ruồi', '🥸 Có râu', '🤓 Đeo kính cận'], answer: 0 },
          win: all(trend(), rep(0.08)),
          lose: rep(-0.05),
          winSay: 'Đúng là ca sĩ! Chụp ảnh chung đăng mạng, quán nổi rần rần.',
          loseSay: 'Nhầm người rồi… chú khách ngượng đỏ mặt.',
        },
      },
      { label: 'Phục vụ bình thường', say: 'Vị khách ăn xong mỉm cười bí ẩn.', fx: chance(0.5, later(1, 'g_celeb', 'Có chuyện hay chờ ngày mai…'), none) },
    ],
  }),
  fun({
    id: 'g_dry_pho',
    phase: 'day',
    emoji: '🍜',
    title: '“Phở khô mà phải ướt!”',
    body: 'Khách gọi phở khô nhưng đòi thêm thật nhiều nước dùng. Vậy là phở gì?',
    choices: [
      { label: 'Chiều khách', say: 'Làm riêng một bát “khô mà ướt”, khách vui như Tết.', fx: all(stove(10_000), rep(0.04)) },
      { label: 'Giải thích nhẹ nhàng', fx: chance(0.5, all(tell('Khách cười: “À, vậy cho bát phở nước!”'), rep(0.02)), all(tell('Khách cãi tới cùng rồi bỏ về…'), rep(-0.04))) },
    ],
  }),
  fun({
    id: 'g_old_stories',
    phase: 'day',
    emoji: '👴',
    title: 'Ông cụ kể chuyện ngày xưa',
    body: 'Ông cụ kể về các món ngon thời trẻ và hỏi: “Cháu có nhớ được món nào không?”',
    choices: [
      {
        label: 'Ghi nhớ tên các món',
        game: { type: 'memory', params: { need: 4 }, win: all(rep(0.06), later(1, 'g_grandpa', 'Ông cụ hứa sẽ quay lại…')), lose: stove(10_000), winSay: 'Ông cụ cười móm mém: “Cháu nhớ giỏi ghê!”', loseSay: 'Nhớ lộn tùng phèo, ông cụ cười xoà.' },
      },
      { label: 'Ngồi nghe ông kể', say: 'Ông cụ vui lắm, hứa sẽ dắt bạn tới.', fx: all(stove(20_000), rep(0.03), later(1, 'g_grandpa', 'Ông cụ hứa sẽ quay lại…')) },
      { label: 'Nhờ người khác nghe hộ', say: 'Ông cụ hơi buồn nhưng vẫn ăn hết bát.' },
    ],
  }),
  fun({
    id: 'g_heat_soup',
    phase: 'day',
    emoji: '🍲',
    title: 'Khách mang nồi canh nhà nhờ hâm',
    body: 'Cô khách xách nồi canh chua từ nhà tới: “Hâm giùm cô với, bếp nhà hỏng!”',
    choices: [
      { label: 'Hâm giúp', say: 'Cô gửi 10 nghìn cảm ơn, còn cho quán nếm thử canh.', fx: all(stove(30_000), money(10_000), rep(0.02)) },
      { label: 'Từ chối khéo', say: 'Cô gật đầu, ôm nồi canh đi tiếp.' },
    ],
  }),
  fun({
    id: 'g_red_invoice',
    phase: 'day',
    emoji: '🧾',
    title: 'Đòi hoá đơn đỏ cho 1 ly trà đá',
    body: 'Anh khách mặc vest uống 1 ly trà đá 3 nghìn rồi đòi xuất hoá đơn đỏ.',
    choices: [
      { label: 'Ngồi viết hoá đơn', say: 'Viết mất cả buổi, anh khách gật gù hài lòng.', fx: stove(15_000) },
      { label: 'Tặng luôn ly trà', say: 'Anh khách bật cười: “Quán này dễ thương ghê!”', fx: rep(0.03) },
    ],
  }),
  fun({
    id: 'g_livestream',
    phase: 'day',
    emoji: '🤳',
    title: 'Livestream bắt chủ quán hét',
    body: 'Khách đang livestream, dí điện thoại: “Chủ quán hét to ‘Xin chào mọi người’ đi!”',
    choices: [
      { label: 'Hét thật to', fx: chance(0.5, all(tell('Tiếng hét vang cả phố, người xem ùn ùn kéo tới!'), crowd(1.3)), tell('Hét to quá… mạng lag, chẳng ai nghe thấy.')) },
      { label: 'Vẫy tay ngại ngùng', say: 'Người xem thả tim vì chủ quán dễ thương.', fx: rep(0.02) },
    ],
  }),
  fun({
    id: 'g_eat_contest',
    phase: 'day',
    emoji: '🥢',
    title: 'Hai khách thi ăn 5 bát',
    body: 'Hai anh khách đập bàn thách nhau ăn 5 bát. Cả quán hò reo cổ vũ!',
    choices: [
      {
        label: 'Làm trọng tài cổ vũ',
        game: { type: 'tap', params: { emoji: '📣', need: 22, seconds: 6, prompt: 'Chạm thật nhanh để cổ vũ!' }, win: all(money(150_000), guests(2), clean(-5)), lose: clean(-10), winSay: 'Cả phố nghe tiếng hò reo, khách ghé xem đông nghịt!', loseSay: 'Cổ vũ yếu quá, hai anh ăn chậm rì, bàn ghế bề bộn.' },
      },
      { label: 'Can ngăn', say: 'Hai anh ngượng ngùng, ăn vừa đủ thôi. Khách khác khen quán chu đáo.', fx: rep(0.03) },
    ],
  }),
  fun({
    id: 'g_birthday',
    phase: 'day',
    emoji: '🎂',
    title: 'Sinh nhật bất ngờ',
    body: 'Nhóm bạn xin tắt đèn để tổ chức sinh nhật bất ngờ cho bạn thân.',
    choices: [
      {
        label: 'Đánh trống hát mừng',
        game: { type: 'rhythm', params: { emoji: '🎂', need: 10 }, win: all(rep(0.1), money(60_000)), lose: stove(10_000), winSay: 'Cả quán hát “Mừng ngày sinh nhật”, bạn nhỏ khóc vì xúc động, boa to!', loseSay: 'Lệch nhịp tùm lum, cả quán cười bò.' },
      },
      { label: 'Hát nhỏ thôi', say: 'Nhóm bạn vẫn vui.', fx: rep(0.02) },
    ],
  }),
  fun({
    id: 'g_fortune',
    phase: 'day',
    emoji: '🧙',
    title: 'Thầy bói xem tướng quán',
    body: 'Ông thầy vuốt râu: “Trả lời đúng câu đố của ta, ta sẽ nói vận quán!”',
    choices: [
      {
        label: 'Giải đố của thầy',
        game: { type: 'quiz', win: all(later(1, 'g_fortune_good', 'Thầy phán: sắp phát tài!'), xp(10)), lose: later(1, 'g_fortune_bad', 'Thầy phán: có hạn nhỏ…'), winSay: 'Thầy cười: “Quán này sắp phát!”', loseSay: 'Thầy lắc đầu: “Hừm, có hạn nhỏ đây…”' },
      },
      { label: 'Mời ăn rồi tiễn', say: 'Thầy ăn xong đi, không phán gì.', fx: money(-20_000) },
    ],
  }),
  fun({
    id: 'g_pizza',
    phase: 'day',
    emoji: '🍕',
    title: 'Khách gọi pizza ở quán phở',
    body: 'Cậu bé ngây thơ: “Cho con một cái pizza ạ!”',
    choices: [
      { label: 'Chế pizza bánh tráng', fx: chance(0.5, all(tell('“Pizza bánh tráng” ngon bất ngờ! Cậu bé kể khắp trường.'), xp(20), guests(2)), all(tell('Món… quái dị. Cậu bé nhăn mặt nhưng vẫn cảm ơn.'), stove(10_000))) },
      { label: 'Giới thiệu món khác', say: 'Cậu bé chọn bánh mì, ăn ngon lành.' },
    ],
  }),
  fun({
    id: 'g_slow_eater',
    phase: 'day',
    emoji: '🐢',
    title: 'Khách ăn chậm nhất thế giới',
    body: 'Một sợi phở… nhai 30 lần. Bát phở đã ăn gần một tiếng!',
    choices: [
      { label: 'Kệ khách', say: 'Khách ăn thong thả, bàn đó bận cả buổi.', fx: seats(-1) },
      { label: 'Tặng “ly trà tiễn khách”', say: 'Khách cười ha hả, uống xong đứng dậy về.', fx: money(-3_000) },
    ],
  }),
  fun({
    id: 'g_big_onion',
    phase: 'day',
    emoji: '📣',
    title: 'Khách chê hành quá to',
    body: 'Khách cầm cọng hành lên soi: “Hành gì to như cây tre vậy!”',
    choices: [
      { label: 'Cả ngày thái hành nhỏ', say: 'Hành nhỏ xíu, khách hài lòng nhưng món hơi nhạt.', fx: all(sell(0.95), rep(0.02)) },
      { label: 'Tặng thêm hành', fx: chance(0.5, all(tell('Khách thích hành, cười: “Vậy mới đã!”'), rep(0.03)), all(tell('Khách giận: “Đã bảo to mà!”'), rep(-0.03))) },
    ],
  }),
  fun({
    id: 'g_spoon_karaoke',
    phase: 'day',
    emoji: '🎤',
    title: 'Khách hát karaoke bằng muỗng',
    body: 'Một chú khách cầm muỗng làm micro, hát vang “Như có Bác trong ngày vui đại thắng”!',
    choices: [
      {
        label: 'Gõ nhịp cùng chú',
        game: { type: 'rhythm', params: { emoji: '🥄', need: 10 }, win: all(guests(3), rep(0.04)), lose: clean(-5), winSay: 'Tiếng gõ muỗng rộn ràng, người đi đường ghé vào xem!', loseSay: 'Gõ lung tung, chú khách cười rồi… hát tiếp.' },
      },
      { label: 'Nhắc nhẹ', say: 'Chú khách ngượng ngùng, hát nhỏ lại.' },
    ],
  }),
  fun({
    id: 'g_twins',
    phase: 'day',
    emoji: '👯',
    title: 'Sinh đôi gọi 1 phần ăn chung',
    body: 'Hai anh em sinh đôi giống hệt nhau, gọi 1 phần: “Tụi em là một người mà!”',
    choices: [
      { label: 'Tính 2 phần', fx: chance(0.5, all(tell('Hai anh em cười, trả đủ 2 phần.'), money(30_000)), all(tell('Hai anh em cãi nhau ai là “người thật”…'), rep(-0.03))) },
      { label: 'Cho qua', say: 'Hai anh em thích quá, hứa rủ cả lớp tới.', fx: all(money(-15_000), rep(0.04)) },
    ],
  }),
];
