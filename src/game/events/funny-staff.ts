import { all, chance, clean, flag, follow, fun, guests, hasMoney, hasStaff, helper, later, line, money, mood, rep, skill, staffOff, stock, stove, tell, trend, xp } from './kit';
import type { EventDef } from './types';

/** B. Nhân viên & Chú Tư — 15 tình huống. Chưa có nhân viên thì Chú Tư đóng vai. */

follow('s_exam', all(tell('Bạn sinh viên thi đậu rồi quay lại, làm việc hăng hơn hẳn!'), skill(5), mood(10)));
follow('s_slow_cook', all(tell('Nhờ bài “nấu chậm mà chắc”, cả bếp ít cháy món hơn.'), xp(20), skill(3)));
follow('s_bonus_forgot', (s, rng) => (s.flags?.bonusPaid ? tell('Tiền thưởng đã trao, cả quán vui vẻ.') : all(tell('Hứa thưởng mà quên… nhân viên buồn thiu.'), mood(-20)))(s, rng));
follow('s_contest', chance(0.45, all(tell('Chú Tư thắng giải Đầu bếp phố! Mang về 1 triệu và tấm bằng khen.'), money(1_000_000), rep(0.1)), tell('Chú Tư thua sát nút, về kể chuyện cười cả buổi.')));
follow('s_chick_grown', all(tell('Gà con lớn rồi, bắt đầu đẻ trứng mỗi sáng!'), flag('hen'), () => line('🥚 Mỗi sáng +2 trứng')));

export const FUNNY_STAFF: EventDef[] = [
  fun({
    id: 's_karaoke',
    phase: 'day',
    emoji: '🎤',
    title: 'Chú Tư hát giữa giờ',
    body: 'Chú Tư cầm vá làm micro, hát “Lý cây bông” giữa lúc đang đông khách!',
    choices: [
      {
        label: 'Hát bè cùng chú',
        game: { type: 'timing', params: { emoji: '🎤', prompt: 'Chạm đúng nhịp để hát bè!' }, win: all(rep(0.06), guests(2)), lose: stove(20_000), winSay: 'Song ca hay tuyệt! Khách vỗ tay rần rần.', loseSay: 'Lạc giọng mất rồi… bếp chậm cả buổi vì cười.' },
      },
      { label: 'Nhắc Chú Tư', say: 'Chú Tư gãi đầu: “Ờ ha, hát tối nay!”' },
    ],
  }),
  fun({
    id: 's_sleepy',
    phase: 'day',
    emoji: '😪',
    title: 'Phụ bếp ngủ quên trong kho',
    when: hasStaff,
    body: (s) => `${helper(s)} ngủ gục trên bao gạo, ngáy o o.`,
    choices: [
      { label: 'Đánh thức nhẹ nhàng', say: 'Bạn ấy xin lỗi rồi làm việc chăm chỉ.', fx: mood(8) },
      { label: 'Chụp ảnh đăng nhóm', fx: all(mood(-10), chance(0.4, all(tell('Ảnh “ngủ trên bao gạo” thành meme, khách tò mò ghé!'), guests(3)), tell('Ảnh chẳng ai xem, bạn ấy thì giận.'))) },
    ],
  }),
  fun({
    id: 's_onion_tears',
    phase: 'day',
    emoji: '😭',
    title: 'Thái hành khóc cả quán',
    body: 'Thái hành cay mắt quá, cả bếp khóc như mưa. Khách tưởng quán có chuyện buồn!',
    choices: [
      {
        label: 'Thái hành thần tốc',
        game: { type: 'slice', params: { need: 8 }, win: all(stock('hanh', 5), xp(10)), lose: stock('hanh', -3), winSay: 'Thái nhanh như chớp, chưa kịp khóc đã xong!', loseSay: 'Khóc tèm lem, lỡ tay làm rơi mất ít hành.' },
      },
      { label: 'Mua kính bơi 30k', say: 'Đeo kính bơi thái hành, khách cười nghiêng ngả.', fx: all(money(-30_000), rep(0.02)) },
      { label: 'Khóc chung', say: 'Cả quán cùng khóc… rồi cùng cười.' },
    ],
  }),
  fun({
    id: 's_love',
    phase: 'day',
    emoji: '💘',
    title: 'Hai nhân viên phải lòng nhau',
    when: (s) => s.staff.length >= 2,
    body: 'Hai bạn nhân viên cứ nhìn nhau cười tủm tỉm, mang nhầm món liên tục.',
    choices: [
      { label: 'Ủng hộ hai bạn', fx: all(mood(20), chance(0.5, tell('Hai bạn làm việc hăng say hơn hẳn!'), all(tell('Mải nhìn nhau, làm rơi 2 bát phở…'), money(-30_000)))) },
      { label: 'Cấm “yêu trong giờ”', say: 'Hai bạn nghiêm túc lại, nhưng mặt buồn thiu.', fx: mood(-6) },
    ],
  }),
  fun({
    id: 's_flying_egg',
    phase: 'day',
    emoji: '🍳',
    title: 'Chế món “trứng chiên bay”',
    body: (s) => `${helper(s)} muốn tung trứng chiên lên trời rồi hứng bằng chảo!`,
    choices: [
      {
        label: 'Cho thử tung trứng',
        game: { type: 'slice', params: { need: 6, prompt: 'Chạm trứng bay lên, né ớt!' }, win: all(xp(25), guests(2)), lose: stock('trung', -5), winSay: 'Trứng bay vèo vèo, khách quay clip ầm ầm!', loseSay: 'Bộp bộp bộp… 5 quả trứng nằm dưới sàn.' },
      },
      { label: 'Làm như cũ', say: 'Trứng chiên bình thường, vẫn ngon.' },
    ],
  }),
  fun({
    id: 's_exam',
    phase: 'day',
    emoji: '🧑‍🎓',
    title: 'Nhân viên xin nghỉ đi thi',
    when: hasStaff,
    body: (s) => `${helper(s)} run run: “Chiều nay em thi, cho em nghỉ nha!”`,
    choices: [
      { label: 'Cho nghỉ', say: 'Bạn ấy cảm ơn rối rít, chạy đi thi.', fx: all(staffOff(), later(1, 's_exam', 'Chờ kết quả thi…')) },
      { label: 'Không cho nghỉ', say: 'Bạn ấy ở lại nhưng buồn ghê lắm.', fx: mood(-15) },
    ],
  }),
  fun({
    id: 's_tray_dance',
    phase: 'day',
    emoji: '🕺',
    title: 'Vừa bưng mâm vừa nhảy',
    body: (s) => `${helper(s)} bưng mâm phở mà cứ nhún nhảy theo nhạc!`,
    choices: [
      {
        label: 'Tự bưng mâm cho chắc',
        game: { type: 'balance', params: { emoji: '🍜🍜🍜' }, win: all(rep(0.04), guests(1)), lose: all(money(-40_000), clean(-10)), winSay: 'Mâm thẳng tắp, khách vỗ tay khen “nghệ sĩ bưng mâm”!', loseSay: 'Ối! Mâm phở đổ nghiêng, sàn nhà lênh láng.' },
      },
      { label: 'Cho nhảy tiếp', fx: chance(0.6, all(tell('Khách thích điệu nhảy, gọi thêm món!'), guests(2)), all(tell('Vấp chân… bát phở bay!'), money(-30_000), clean(-8))) },
      { label: 'Nhắc nghiêm túc', say: 'Bạn ấy bưng mâm cẩn thận lại.' },
    ],
  }),
  fun({
    id: 's_slow_cook',
    phase: 'day',
    emoji: '🐌',
    title: 'Chú Tư dạy “nấu chậm mà chắc”',
    body: 'Chú Tư muốn dạy cả bếp bí kíp: “Nấu chậm một chút, món ngon gấp đôi!”',
    choices: [
      { label: 'Học ngay', say: 'Hôm nay bếp chậm hơn, nhưng ai cũng học được nhiều.', fx: all(stove(25_000), later(1, 's_slow_cook', 'Bài học sẽ có tác dụng…')) },
      { label: 'Để dịp khác', say: 'Chú Tư gật gù: “Ừ, lúc rảnh học nha.”' },
    ],
  }),
  fun({
    id: 's_phone',
    phase: 'day',
    emoji: '📱',
    title: 'Nhân viên nghiện điện thoại',
    when: hasStaff,
    body: (s) => `${helper(s)} cứ lén lướt điện thoại, khách gọi mãi không nghe.`,
    choices: [
      { label: 'Thu điện thoại', say: 'Làm việc tập trung hẳn, nhưng hơi buồn.', fx: all(mood(-8), skill(2)) },
      { label: 'Cho nghỉ 5 phút', say: 'Lướt xong, bạn ấy làm việc vui vẻ.', fx: all(mood(10), stove(8_000)) },
    ],
  }),
  fun({
    id: 's_salt_tea',
    phase: 'day',
    emoji: '🧂',
    title: 'Nhầm muối thành đường cả nồi trà',
    body: 'Nồi trà sữa hôm nay… mặn chát! Ai đó đã nhầm muối với đường.',
    choices: [
      { label: 'Đổ bỏ, pha lại', say: 'Tiếc đứt ruột nhưng an toàn.', fx: all(stock('tra', -5), stock('sua', -2)) },
      { label: 'Bán “trà muối” độc lạ', fx: chance(0.45, all(tell('“Trà muối” thành món hot, khách xếp hàng thử!'), trend()), all(tell('Khách uống một ngụm… phun phì phì.'), rep(-0.06))) },
    ],
  }),
  fun({
    id: 's_bonus',
    phase: 'day',
    emoji: '🎁',
    title: 'Nhân viên đòi thưởng nóng',
    when: hasStaff,
    body: 'Hôm nay đông khách, cả bếp nhìn chủ quán: “Có thưởng không chủ ơi?”',
    choices: [
      { label: 'Thưởng 50k', say: 'Cả bếp hoan hô, làm việc như bay!', fx: all(money(-50_000), mood(20), flag('bonusPaid')) },
      { label: 'Hứa cuối tuần', say: 'Mọi người gật đầu… nhớ giữ lời nha.', fx: later(3, 's_bonus_forgot', 'Nhớ lời hứa cuối tuần…') },
    ],
  }),
  fun({
    id: 's_contest',
    phase: 'day',
    emoji: '🏆',
    title: 'Chú Tư muốn thi đầu bếp phố',
    body: 'Phường tổ chức thi đầu bếp, phí 200 nghìn. Chú Tư xin tập trước một bài!',
    choices: [
      {
        label: 'Tập nhớ công thức với chú',
        enabled: hasMoney(200_000),
        game: {
          type: 'sequence',
          params: { options: ['🍜', '🥩', '🧅', '🌿'], need: 5 },
          win: all(money(-200_000), (s, rng) => chance(0.8, all(tell('Chú Tư thắng giải! Mang về 1 triệu.'), money(1_000_000), rep(0.1)), tell('Chú Tư thua sát nút.'))(s, rng)),
          lose: all(money(-200_000), later(2, 's_contest', 'Chờ ngày thi…')),
          winSay: 'Tập kỹ rồi, Chú Tư tự tin đi thi ngay!',
          loseSay: 'Tập chưa kỹ lắm… vẫn đăng ký, hên xui.',
        },
      },
      { label: 'Đăng ký luôn', enabled: hasMoney(200_000), say: 'Chú Tư hí hửng đi đăng ký.', fx: all(money(-200_000), later(2, 's_contest', 'Chờ ngày thi…')) },
      { label: 'Thôi chú ơi', say: 'Chú Tư tiếc nhưng vẫn cười.' },
    ],
  }),
  fun({
    id: 's_slippery',
    phase: 'day',
    emoji: '🧹',
    title: 'Lau sàn quá trơn',
    body: 'Sàn vừa lau bóng loáng như sân băng. Khách bước vào cứ trượt trượt!',
    choices: [
      {
        label: 'Bưng món qua sàn trơn',
        game: { type: 'balance', params: { emoji: '🍜🍵' }, win: all(clean(10), rep(0.03)), lose: all(rep(-0.04), money(-20_000)), winSay: 'Lướt như vận động viên trượt băng, món vẫn nguyên!', loseSay: 'Trượt một cái “oạch”, đổ luôn bát phở.' },
      },
      { label: 'Đặt biển cảnh báo', say: 'An toàn là trên hết!', fx: clean(5) },
      { label: 'Kệ', fx: chance(0.5, tell('May quá, không ai trượt.'), all(tell('Một khách trượt ngã, dù không sao nhưng giận lắm.'), rep(-0.08))) },
    ],
  }),
  fun({
    id: 's_sneeze',
    phase: 'day',
    emoji: '🤧',
    title: 'Chú Tư hắt xì liên tục',
    body: 'Hắt xì! Hắt xì! Chú Tư bị cảm, hắt xì tới rung cả nồi.',
    choices: [
      { label: 'Đưa khẩu trang', say: 'Chú Tư đeo khẩu trang, bếp sạch sẽ an toàn.', fx: clean(3) },
      { label: 'Pha trà gừng cả quán', say: 'Trà gừng thơm lừng, khách cũng được một ly ấm bụng.', fx: all(money(-10_000), rep(0.04)) },
    ],
  }),
  fun({
    id: 's_chick',
    phase: 'day',
    emoji: '🐣',
    title: 'Mang gà con đi làm',
    when: (s) => !s.flags?.hen,
    body: (s) => `${helper(s)} mang theo một hộp gà con kêu chiếp chiếp.`,
    choices: [
      { label: 'Nuôi gà ở quán', say: 'Gà con được làm tổ ở góc sân, chiếp chiếp suốt ngày.', fx: all(clean(-3), later(5, 's_chick_grown', 'Chờ gà lớn…')) },
      { label: 'Mang về nhà', say: 'Gà con về nhà với mẹ.' },
    ],
  }),
];
