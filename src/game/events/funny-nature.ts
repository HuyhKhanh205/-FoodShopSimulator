import { all, chance, clean, closeNow, crowd, flag, follow, fun, guests, hasMoney, later, line, money, noFlag, patience, rep, sell, stock, stove, tell, tickets } from './kit';
import type { EventDef } from './types';

/** C. Động vật & thời tiết — 15 tình huống. */

follow('n_dog_owner', all(tell('Chú chó hôm qua dẫn chủ tới ăn, chủ còn rủ cả xóm!'), crowd(1.15)));
follow('n_circus', all(tell('Gánh xiếc gửi tặng vé xem xiếc cảm ơn quán!'), tickets(3)));

export const FUNNY_NATURE: EventDef[] = [
  fun({
    id: 'n_stray_cat',
    phase: 'day',
    emoji: '🐈',
    title: 'Mèo hoang xin ăn',
    when: noFlag('cat'),
    body: 'Một chú mèo mướp ngồi trước cửa, kêu “meo” thật đáng thương.',
    choices: [
      { label: 'Cho mèo ăn, nhận nuôi', say: 'Mèo ở lại quán luôn! Từ nay chuột sợ chạy mất dép.', fx: all(flag('cat'), rep(0.03), () => line('🐈 Có mèo: không còn chuột')) },
      { label: 'Đuổi đi', say: 'Mèo buồn bã đi sang quán khác.' },
    ],
  }),
  fun({
    id: 'n_dog_meat',
    phase: 'day',
    emoji: '🐕',
    title: 'Chó tha mất thịt',
    body: 'Một chú chó lẻn vào, ngoạm miếng thịt rồi chạy biến!',
    choices: [
      {
        label: 'Đuổi theo',
        game: { type: 'catch', params: { emoji: '🐕', need: 5 }, win: rep(0.03), lose: all(stock('thit_bo', -2), stock('thit_heo', -2)), winSay: 'Bắt kịp! Chú chó nhả thịt, vẫy đuôi xin lỗi.', loseSay: 'Chó chạy nhanh quá, mất luôn miếng thịt.' },
      },
      { label: 'Tặng luôn cho chó', say: 'Chú chó vẫy đuôi cảm ơn rồi chạy về nhà.', fx: all(stock('thit_heo', -2), later(1, 'n_dog_owner', 'Chú chó có vẻ nhớ quán…')) },
    ],
  }),
  fun({
    id: 'n_rooster',
    phase: 'day',
    emoji: '🐓',
    title: 'Gà trống gáy sai giờ',
    when: noFlag('hen'),
    body: 'Giữa trưa, con gà nhà bên gáy “ò ó o” liên tục. Chủ nhà muốn bán gà đi.',
    choices: [
      { label: 'Mua cặp gà 200k', enabled: hasMoney(200_000), say: 'Quán có cặp gà! Từ mai mỗi sáng có trứng tươi.', fx: all(money(-200_000), flag('hen'), () => line('🥚 Mỗi sáng +2 trứng')) },
      { label: 'Bịt tai chịu đựng', say: 'Gà gáy tới chiều, cả quán quen luôn.' },
    ],
  }),
  fun({
    id: 'n_ducks',
    phase: 'day',
    emoji: '🦆',
    title: 'Bầy vịt diễu hành qua quán',
    body: 'Một bầy vịt lạch bạch đi ngang quán. Chủ vịt nhờ đếm giùm xem có lạc con nào!',
    choices: [
      {
        label: 'Giúp đếm vịt',
        game: { type: 'memory', params: { need: 4, prompt: 'Nhớ và ghép đôi thật nhanh!' }, win: all(guests(3), rep(0.03)), lose: stove(10_000), winSay: 'Đủ vịt! Người xem vỗ tay, ghé vào ăn luôn.', loseSay: 'Đếm lộn xộn… vịt chạy tán loạn.' },
      },
      { label: 'Dừng bán ngắm vịt', say: 'Khách hiếu kỳ ghé xem, tiện ăn luôn.', fx: all(stove(15_000), guests(3)) },
      { label: 'Lùa vịt đi', say: 'Vịt kêu quàng quạc đi mất.' },
    ],
  }),
  fun({
    id: 'n_bee',
    phase: 'day',
    emoji: '🐝',
    title: 'Ong bay vào quán',
    body: 'Một đàn ong nhỏ bay vo ve quanh bình nước đường. Khách hoảng hốt!',
    choices: [
      {
        label: 'Xua ong ra ngoài',
        game: { type: 'catch', params: { emoji: '🐝', need: 6 }, win: rep(0.03), lose: all(rep(-0.04), patience(0.7)), winSay: 'Xua hết ong ra cửa, khách thở phào.', loseSay: 'Ong càng bay loạn, khách chạy tán loạn…' },
      },
      { label: 'Mở cửa chờ ong đi', say: 'Ong bay đi dần, bếp phải chờ một lúc.', fx: stove(10_000) },
    ],
  }),
  fun({
    id: 'n_monkey',
    phase: 'day',
    emoji: '🐒',
    title: 'Khỉ trốn gánh xiếc',
    body: 'Một chú khỉ mặc áo đỏ nhảy lên quầy, chộp lấy nải chuối!',
    choices: [
      { label: 'Cho chuối, xem khỉ diễn', say: 'Khỉ làm xiếc tung hứng bát, người xem đông nghịt!', fx: all(guests(3), clean(-10)) },
      { label: 'Gọi gánh xiếc', say: 'Gánh xiếc tới đón khỉ, cảm ơn rối rít.', fx: later(1, 'n_circus', 'Gánh xiếc hứa cảm ơn…') },
    ],
  }),
  fun({
    id: 'n_hail',
    phase: 'day',
    emoji: '🧊',
    title: 'Mưa đá bất chợt',
    body: 'Mưa đá rơi lộp độp! Người đi đường chạy tán loạn tìm chỗ trú.',
    choices: [
      { label: 'Mời mọi người vào trú', say: 'Quán chật kín, nhiều người trú mưa gọi luôn món!', fx: all(guests(4), clean(-8)) },
      { label: 'Đóng cửa kính lại', say: 'Trong quán ấm áp, yên tĩnh.' },
    ],
  }),
  fun({
    id: 'n_sign_wind',
    phase: 'day',
    emoji: '🌪️',
    title: 'Gió thổi bay bảng hiệu',
    body: 'Một cơn gió mạnh cuốn bảng hiệu bay lăn lóc ra giữa đường!',
    choices: [
      { label: 'Sửa ngay 300k', enabled: hasMoney(300_000), say: 'Bảng hiệu mới còn đẹp hơn bảng cũ.', fx: money(-300_000) },
      { label: 'Để mai sửa', say: 'Không có bảng, khách đi ngang không biết quán ở đâu…', fx: crowd(0.8, 2) },
    ],
  }),
  fun({
    id: 'n_flood',
    phase: 'day',
    emoji: '🌊',
    title: 'Nước ngập mắt cá',
    body: 'Mưa to, nước ngập tới mắt cá chân. Dép khách trôi lềnh bềnh!',
    choices: [
      { label: 'Bán “phở thuyền”', fx: chance(0.5, all(tell('Bưng phở trên chậu nhựa, khách chụp ảnh viral!'), crowd(1.3, 2)), all(tell('Chậu lật… cả bát phở trôi theo dòng.'), money(-40_000))) },
      { label: 'Nghỉ sớm hôm nay', say: 'Đóng cửa về nhà, an toàn là trên hết.', fx: closeNow() },
    ],
  }),
  fun({
    id: 'n_heatwave',
    phase: 'day',
    emoji: '🔥',
    title: 'Nắng 40 độ',
    body: 'Trời nóng như đổ lửa! Ai đi ngang cũng nhìn ly trà đá thèm thuồng.',
    choices: [
      { label: 'Tăng giá gấp đôi', say: 'Thu được nhiều tiền, nhưng khách lẩm bẩm “quán chặt chém”.', fx: all(sell(1.2), rep(-0.06)) },
      { label: 'Tặng nước mát', say: 'Khách cảm động, kể khắp phố về quán tốt bụng.', fx: all(money(-30_000), stock('da', -5), rep(0.08)) },
    ],
  }),
  fun({
    id: 'n_frog',
    phase: 'day',
    emoji: '🐸',
    title: 'Ếch nhảy vào thùng rau',
    when: noFlag('frog'),
    body: 'Mở thùng rau ra, một chú ếch xanh nhảy “ộp” lên mặt!',
    choices: [
      { label: 'Thả về ao', say: 'Ếch về nhà, nhưng rau bị dẫm nát mất ít.', fx: stock('rau', -5) },
      { label: 'Nuôi làm linh vật', say: 'Ếch “Xanh” thành linh vật, khách thích chụp ảnh cùng!', fx: all(flag('frog'), () => line('🐸 Linh vật: khách +3% mỗi ngày')) },
    ],
  }),
  fun({
    id: 'n_mosquito',
    phase: 'day',
    emoji: '🦟',
    title: 'Muỗi cả đàn',
    body: 'Chiều xuống, muỗi bay vo ve. Khách vừa ăn vừa gãi!',
    choices: [
      {
        label: 'Tự tay đập muỗi',
        game: { type: 'whack', params: { emoji: '🦟', need: 8 }, win: rep(0.04), lose: patience(0.7), winSay: 'Bộp bộp! Hết muỗi, khách ăn ngon lành.', loseSay: 'Muỗi đông quá, khách sốt ruột muốn về.' },
      },
      { label: 'Đốt nhang muỗi 20k', say: 'Khói nhang bay nhè nhẹ, muỗi chạy hết.', fx: money(-20_000) },
      { label: 'Kệ', say: 'Khách gãi sồn sột, kém kiên nhẫn hơn hẳn.', fx: patience(0.6) },
    ],
  }),
  fun({
    id: 'n_rainbow',
    phase: 'day',
    emoji: '🌈',
    title: 'Cầu vồng đôi',
    body: 'Sau cơn mưa, hai chiếc cầu vồng hiện ra ngay trên mái quán. Đẹp quá!',
    choices: [
      { label: 'Khuyến mãi “cầu vồng” −10%', say: 'Khách kéo tới chụp ảnh, ăn luôn!', fx: all(sell(0.9), crowd(1.3)) },
      { label: 'Ngắm thôi', say: 'Cả quán ngắm cầu vồng, lòng vui phơi phới.', fx: rep(0.01) },
    ],
  }),
  fun({
    id: 'n_snake',
    phase: 'day',
    emoji: '🐍',
    title: 'Rắn nhỏ trong thùng rau',
    body: 'Một chú rắn nhỏ cuộn tròn trong thùng rau. Không độc, nhưng ai cũng sợ!',
    choices: [
      { label: 'Gọi đội bắt rắn 150k', enabled: hasMoney(150_000), say: 'Đội bắt rắn tới đưa rắn về rừng an toàn.', fx: money(-150_000) },
      { label: 'Chú Tư bắt', fx: chance(0.6, all(tell('Chú Tư bắt rắn gọn gàng, khách vỗ tay “anh hùng”!'), rep(0.06)), all(tell('Rắn trườn khắp quán, khách la hét…'), rep(-0.05), stock('rau', -4))) },
    ],
  }),
  fun({
    id: 'n_parrot',
    phase: 'day',
    emoji: '🦜',
    title: 'Vẹt biết nói “ngon quá!”',
    when: noFlag('parrot'),
    body: 'Chú vẹt của khách cứ nói “ngon quá, ngon quá!”. Chủ vẹt muốn bán lại.',
    choices: [
      { label: 'Mua vẹt 300k', enabled: hasMoney(300_000), say: 'Vẹt đứng cửa chào khách “ngon quá!” suốt ngày.', fx: all(money(-300_000), flag('parrot'), () => line('🦜 Vẹt chào khách: khách +5% mỗi ngày')) },
      { label: 'Trả vẹt cho chủ', say: 'Chủ vẹt cảm ơn, khen quán thật thà.', fx: rep(0.03) },
    ],
  }),
];

