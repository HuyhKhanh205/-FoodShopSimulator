import { formatMoney } from '../helpers';
import { all, chance, closeNow, crowd, dailyCost, flag, follow, fun, hasMoney, later, line, money, noFlag, rep, revenue, seats, stockLoss, stove, tell, xp } from './kit';
import type { EventDef } from './types';

/**
 * H. Sự cố nghiêm trọng — trộm, phá quán, lừa đảo (trộn chung kho với mọi tình huống).
 * Kể vui, không bạo lực. Đồ bảo vệ: 📹 camera, 🐕 chó giữ nhà, 🔑 khoá mới, 🐈 mèo.
 */

const THEFT_CAP = 1_500_000;

follow('h_theft_police', (s, rng) => {
  const lost = s.flags?.theftLoss ?? 0;
  if (s.flags) delete s.flags.theftLoss;
  chance(0.5, all(tell('Công an bắt được tên trộm, trả lại một nửa số tiền!'), money(Math.round(lost / 2 / 1000) * 1000)), tell('Công an vẫn đang truy tìm tên trộm…'))(s, rng);
});
follow('h_dine_dash', chance(0.5, all(tell('Nhóm bùng tiền thấy ảnh trên nhóm phường, xấu hổ quay lại trả đủ!'), money(300_000)), tell('Nhóm bùng tiền vẫn chưa thấy đâu…')));
follow('h_stock_again', (s, rng) => {
  if (s.flags?.newLock) return tell('Kẻ trộm quay lại nhưng khoá mới chắc quá, bỏ đi!')(s, rng);
  all(tell('Kẻ trộm kho quay lại lần nữa! Kho mất thêm một ít.'), stockLoss(0.2))(s, rng);
});
follow('h_truck_pay', all(tell('Công ty xe tải gửi tiền bồi thường mái hiên.'), money(700_000)));

export const SERIOUS: EventDef[] = [
  fun({
    id: 'h_theft',
    phase: 'morning',
    emoji: '🦹',
    title: 'Trộm lẻn vào lấy két tiền',
    when: noFlag('camera'),
    setup: (s, rng) => {
      if (s.flags?.watchdog && rng() < 0.7) return null;
      const lost = Math.min(THEFT_CAP, Math.floor((Math.max(0, s.money) * 0.15) / 1000) * 1000);
      if (lost < 20_000) return null;
      s.money -= lost;
      s.report.otherCosts += lost;
      s.flags = { ...(s.flags ?? {}), theftLoss: lost };
      return { lost };
    },
    body: (_s, ctx) => `Sáng ra, két tiền bị cạy! Tên trộm vụng về để lại dấu dép, lấy mất ${formatMoney(Number(ctx.lost))}.`,
    choices: [
      {
        label: 'Lần theo dấu dép',
        game: {
          type: 'catch',
          params: { emoji: '🦹', need: 6, prompt: 'Chạm trúng tên trộm!' },
          win: (s, rng) => {
            const back = Math.round(((s.flags?.theftLoss ?? 0) * 0.8) / 1000) * 1000;
            if (s.flags) delete s.flags.theftLoss;
            all(money(back), rep(0.05))(s, rng);
          },
          lose: later(2, 'h_theft_police', 'Đã báo công an…'),
          winSay: 'Tóm được tên trộm đang trốn sau sạp rau! Lấy lại gần hết tiền.',
          loseSay: 'Tên trộm chạy mất… đành nhờ công an.',
        },
      },
      { label: 'Lắp camera 400k', enabled: hasMoney(400_000), say: 'Camera mới lắp, từ nay trộm vào là bị quay rõ mặt!', fx: all(money(-400_000), flag('camera'), () => line('📹 Có camera: trộm két sẽ bị bắt')) },
      { label: 'Nuôi chó giữ nhà 300k', enabled: hasMoney(300_000), say: 'Chú chó “Mực” canh quán, sủa gâu gâu khi có người lạ!', fx: all(money(-300_000), flag('watchdog'), () => line('🐕 Có chó giữ nhà: trộm ít dám vào')) },
    ],
  }),
  fun({
    id: 'h_theft_caught',
    phase: 'morning',
    emoji: '📹',
    title: 'Camera tóm gọn tên trộm!',
    weight: 1.5,
    when: (s) => !!s.flags?.camera,
    body: 'Đêm qua có trộm lẻn vào, nhưng camera quay rõ mặt. Công an bắt ngay, không mất đồng nào!',
    choices: [
      { label: 'Cảm ơn công an', say: 'Cả phố khen quán cẩn thận, an toàn.', fx: rep(0.05) },
      { label: 'Khuyên trộm đi làm', say: 'Tên trộm xin lỗi, hứa sẽ tìm việc tử tế.', fx: all(rep(0.03), xp(15)) },
    ],
  }),
  fun({
    id: 'h_drunk',
    phase: 'day',
    emoji: '🍺',
    title: 'Khách quá chén làm đổ bàn',
    body: 'Bàn khách nhậu hát hò rồi làm đổ nghiêng 2 cái bàn. Bát đĩa vỡ loảng xoảng!',
    choices: [
      { label: 'Gọi công an', fx: all(stove(30_000), chance(0.6, all(tell('Công an tới, khách phải đền tiền sửa bàn.'), money(300_000), seats(-2)), all(tell('Khách xin lỗi nhưng không có tiền đền…'), seats(-2, 2)))) },
      {
        label: 'Chú Tư dỗ khách về',
        game: { type: 'timing', params: { emoji: '🍵', prompt: 'Rót trà giải rượu đúng lúc!' }, win: all(rep(0.06), seats(-2)), lose: seats(-3, 2), winSay: 'Uống trà xong, khách tỉnh lại, xin lỗi rồi tự dựng bàn lên.', loseSay: 'Khách còn say, vấp đổ thêm một bàn nữa…' },
      },
      { label: 'Bắt đền ngay', fx: chance(0.5, all(tell('Khách ngượng ngùng, trả đủ tiền sửa.'), money(300_000), seats(-2)), all(tell('Khách bỏ chạy, bàn vẫn gãy…'), seats(-2, 2), rep(-0.03))) },
    ],
  }),
  fun({
    id: 'h_dine_dash',
    phase: 'day',
    emoji: '🏃',
    title: 'Cả bàn 6 người bùng tiền',
    body: 'Bàn 6 người ăn no nê rồi lén đứng dậy, chạy ào ra cửa!',
    choices: [
      {
        label: 'Đuổi theo',
        game: { type: 'catch', params: { emoji: '🏃', need: 6 }, win: all(money(300_000), stove(20_000)), lose: stove(30_000), winSay: 'Đuổi kịp ở đầu hẻm! Cả nhóm xấu hổ trả đủ tiền.', loseSay: 'Chạy hụt hơi… quán vắng chủ một lúc.' },
      },
      { label: 'Đăng ảnh lên nhóm phường', say: 'Ảnh được chia sẻ khắp phường.', fx: later(1, 'h_dine_dash', 'Chờ xem có ai nhận ra…') },
      { label: 'Bỏ qua', say: 'Coi như xui, bài học để lần sau để ý hơn.', fx: xp(5) },
    ],
  }),
  fun({
    id: 'h_fake_inspector',
    phase: 'day',
    emoji: '🧑‍💼',
    title: 'Kẻ giả thanh tra',
    body: 'Một người đeo thẻ “thanh tra” đòi “phí kiểm tra” 500 nghìn tiền mặt, không đưa biên lai.',
    choices: [
      { label: 'Đưa tiền cho xong', say: 'Người đó đi rồi… sau mới biết là giả.', fx: money(-500_000) },
      { label: 'Gọi phường xác minh', fx: chance(0.7, all(tell('Phường xác nhận là giả! Kẻ lừa bị bắt, quán lên báo phường.'), rep(0.1)), all(tell('Gọi mãi không được, kẻ lừa bỏ đi mất.'), stove(20_000))) },
      {
        label: 'Kiểm tra giấy tờ',
        game: { type: 'pick', params: { prompt: 'Giấy thanh tra thật phải có gì?', options: ['🔴 Con dấu đỏ', '✏️ Chữ viết tay', '🖍️ Hình vẽ màu'], answer: 0 }, win: rep(0.1), lose: money(-500_000), winSay: 'Không có con dấu — giả rồi! Kẻ lừa bỏ chạy.', loseSay: 'Bị lừa mất 500 nghìn…' },
      },
    ],
  }),
  fun({
    id: 'h_gas',
    phase: 'morning',
    emoji: '💥',
    title: 'Bình gas xì, bếp hỏng',
    body: 'Sáng ra ngửi thấy mùi gas! May phát hiện sớm, không ai sao, nhưng một bếp bị hỏng.',
    choices: [
      { label: 'Thay bếp mới 800k', enabled: hasMoney(800_000), say: 'Bếp mới lắp xong, an toàn tuyệt đối.', fx: money(-800_000) },
      {
        label: 'Dọn gọn cho thợ sửa',
        game: { type: 'stack', params: { emoji: '🍳', need: 5, prompt: 'Xếp nồi chảo gọn gàng!' }, win: money(-500_000), lose: all(money(-800_000), stove(30_000)), winSay: 'Dọn gọn gàng, thợ sửa nhanh và lấy rẻ hơn!', loseSay: 'Đồ đạc bề bộn, thợ sửa lâu, tốn tiền hơn.' },
      },
      { label: 'Dùng tạm bếp còn lại', say: 'Nấu chậm hơn mấy hôm…', fx: revenue(-0.15, 3, 'Thiếu một bếp') },
    ],
  }),
  fun({
    id: 'h_fake_money',
    phase: 'day',
    emoji: '💵',
    title: 'Nhận nhầm tờ tiền giả',
    body: 'Đếm tiền mới thấy một tờ 500 nghìn sờ vào nhám nhám, không có dải bạc. Tiền giả!',
    choices: [
      { label: 'Nộp cho công an', say: 'Mất 500 nghìn nhưng công an khen quán trung thực.', fx: all(money(-500_000), rep(0.05)) },
      {
        label: 'Soi lại cả két',
        game: {
          type: 'pick',
          params: { prompt: 'Tờ nào là tiền giả?', options: ['💵 Không có dải bạc', '💵 Có dải bạc lấp lánh', '💵 Có hình chìm'], answer: 0 },
          win: all(money(-500_000), rep(0.03)),
          lose: money(-1_000_000),
          winSay: 'Soi chuẩn! Chỉ có một tờ giả, từ nay quán cảnh giác hơn.',
          loseSay: 'Còn một tờ giả nữa lọt lưới… mất gấp đôi.',
        },
      },
      { label: 'Tiêu lại cho người khác', fx: chance(0.3, all(tell('Không ai phát hiện… nhưng lòng áy náy mãi.'), rep(-0.02)), all(tell('Bị phát hiện ngay! Bị phạt và mất uy tín.'), money(-800_000), rep(-0.3))) },
    ],
  }),
  fun({
    id: 'h_rat_wire',
    phase: 'day',
    emoji: '🐀',
    title: 'Chuột cắn dây điện',
    when: noFlag('cat'),
    body: 'Đèn chớp tắt liên tục! Một con chuột đang gặm dây điện sau bếp.',
    choices: [
      {
        label: 'Đập chuột trước đã',
        game: { type: 'whack', params: { emoji: '🐀', need: 7 }, win: money(-200_000), lose: all(money(-500_000), stove(30_000)), winSay: 'Đuổi sạch chuột! Dây chỉ hỏng nhẹ, sửa rẻ.', loseSay: 'Chuột chạy khắp nơi, dây đứt nhiều chỗ…' },
      },
      { label: 'Gọi thợ điện 500k', enabled: hasMoney(500_000), say: 'Thợ điện sửa gọn, bọc dây chống chuột.', fx: all(money(-500_000), stove(15_000)) },
      { label: 'Tự sửa', fx: chance(0.5, all(tell('Sửa ngon lành, tiết kiệm tiền thợ!'), xp(15)), all(tell('Chập điện cái bụp! Phải đóng cửa nghỉ sớm.'), closeNow())) },
    ],
  }),
  fun({
    id: 'h_blackmail',
    phase: 'day',
    emoji: '😡',
    title: 'Khách doạ “bóc phốt”',
    body: 'Một khách doạ đăng bài chê quán nếu không được ăn miễn phí cả tuần.',
    choices: [
      { label: 'Chiều khách', say: 'Khách ăn free mỗi ngày…', fx: dailyCost(50_000, 7, 'Khách doạ ăn free') },
      { label: 'Từ chối thẳng', fx: chance(0.5, all(tell('Khách đăng bài bóc phốt, nhiều người tin…'), rep(-0.3), crowd(0.8, 3)), all(tell('Khách quen vào bênh quán, bài bóc phốt bị chê ngược!'), rep(0.05))) },
    ],
  }),
  fun({
    id: 'h_short_circuit',
    phase: 'day',
    emoji: '🔥',
    title: 'Chập điện cháy xém biển hiệu',
    body: 'Xẹt xẹt! Biển hiệu đèn led chập điện, bốc khói đen.',
    choices: [
      { label: 'Ngắt điện, dập ngay', say: 'Dập kịp, sửa lại biển hiệu 200 nghìn.', fx: all(money(-200_000), stove(15_000)) },
      { label: 'Gọi cứu hoả', say: 'Cứu hoả tới kiểm tra an toàn. Hôm nay nghỉ sớm cho chắc.', fx: all(rep(0.05), closeNow()) },
    ],
  }),
  fun({
    id: 'h_stock_theft',
    phase: 'morning',
    emoji: '🔑',
    title: 'Nhân viên cũ lấy trộm kho',
    when: noFlag('newLock'),
    setup: (s, rng) => {
      if (s.stock.reduce((n, b) => n + b.qty, 0) < 5) return null;
      stockLoss(0.3)(s, rng);
      return {};
    },
    body: 'Kho bị mở bằng chìa khoá cũ! Mất khoảng một phần ba nguyên liệu. Hàng xóm thấy người quen lấy.',
    choices: [
      { label: 'Thay khoá mới 200k', enabled: hasMoney(200_000), say: 'Khoá mới chắc chắn, chìa cũ hết tác dụng!', fx: all(money(-200_000), flag('newLock'), () => line('🔑 Khoá mới: kho an toàn')) },
      { label: 'Kệ, chắc không dám nữa', say: 'Hi vọng vậy…', fx: later(4, 'h_stock_again', 'Nhớ để ý kho…') },
    ],
  }),
  fun({
    id: 'h_scam',
    phase: 'morning',
    emoji: '🎰',
    title: 'Người lạ rủ “đầu tư nhân đôi tiền”',
    body: 'Người lạ thì thầm: “Đưa anh 1 triệu, tuần sau anh trả 2 triệu!”',
    choices: [
      { label: 'Đưa 1 triệu', enabled: hasMoney(1_000_000), fx: chance(0.1, all(tell('Ơ… trả thật! Nhưng may mắn hiếm lắm đó.'), money(1_000_000)), all(tell('Người lạ biến mất cùng 1 triệu. Lừa đảo rồi!'), money(-1_000_000))) },
      { label: 'Từ chối', say: 'Chú Tư khen: “Không tham là không bị lừa!”', fx: xp(30) },
    ],
  }),
  fun({
    id: 'h_truck',
    phase: 'day',
    emoji: '🚚',
    title: 'Xe tải lùi tông mái hiên',
    body: 'Rầm! Xe tải lùi tông sập mái hiên. May không ai sao, nhưng mất một bàn.',
    choices: [
      { label: 'Đòi bồi thường', say: 'Tài xế ghi giấy hẹn, công ty sẽ gửi tiền.', fx: all(seats(-1, 2), later(2, 'h_truck_pay', 'Chờ tiền bồi thường…')) },
      { label: 'Bỏ qua cho tài xế', say: 'Tài xế cảm ơn rối rít, cả phố khen quán rộng lượng.', fx: all(seats(-1, 2), rep(0.05)) },
    ],
  }),
];
