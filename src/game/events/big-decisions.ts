import { makeStaff } from '../helpers';
import { all, chance, crowd, dailyIncome, debt, dueDay, flag, follow, fromDay, fun, hasMoney, later, line, money, rent, rep, revenue, say, stockLoss, stove, tell, trend, unflag, clean } from './kit';
import type { EventDef } from './types';

/** G. Quyết định lớn (từ ngày 5) — 10 tình huống, trọng số thấp vì ảnh hưởng nợ / tiền nhà. */

const BIG = 1.5;
const RELATIVE = 'Cháu Tí';

follow('b_relative_leave', (s) => {
  s.staff = s.staff.filter((st) => st.name !== RELATIVE);
  say('Cháu Tí phụ quán 3 ngày xong, về quê đi học rồi.');
});
follow('b_contest', (s, rng) => {
  const bar = s.flags?.contestPrep ? 3.4 : 3.8;
  unflag('contestPrep')(s, rng);
  if (s.reputation >= bar) all(tell('Quán đoạt giải “Quán ngon quận”! Được thưởng trả bớt nợ.'), debt(-1_000_000), rep(0.15))(s, rng);
  else tell('Ban giám khảo khen quán dễ thương, nhưng giải về quán khác.')(s, rng);
});
follow('b_tv_air', chance(0.75, all(tell('Chương trình “Giải cứu quán ăn” lên sóng: cả nước biết quán!'), trend(), rep(0.2), crowd(1.4, 3)), all(tell('Chương trình cắt ghép cảnh bếp bề bộn… khán giả chê.'), rep(-0.1))));

export const BIG_DECISIONS: EventDef[] = [
  fun({
    id: 'b_investor',
    phase: 'morning',
    emoji: '💼',
    title: 'Nhà đầu tư góp vốn',
    weight: BIG,
    when: (s) => s.day >= 5 && s.debt > 0,
    body: 'Một chú doanh nhân muốn góp 2 triệu trả nợ giúp quán, đổi lại chia 10% doanh thu trong 10 ngày.',
    choices: [
      { label: 'Nhận vốn', say: 'Nợ nhẹ bớt, nhưng mỗi ngày phải chia tiền cho chú.', fx: all(debt(-2_000_000), revenue(-0.1, 10, 'Chia lãi nhà đầu tư')) },
      { label: 'Tự lực cánh sinh', say: 'Chú doanh nhân gật gù: “Có chí khí!”', fx: rep(0.02) },
    ],
  }),
  fun({
    id: 'b_bank',
    phase: 'morning',
    emoji: '🏦',
    title: 'Ngân hàng gia hạn nợ',
    weight: BIG,
    when: (s) => s.day >= 5 && s.debt > 0,
    body: 'Ngân hàng đề nghị kéo dài hạn trả nợ thêm 5 ngày, nhưng nợ tăng 10%.',
    choices: [
      { label: 'Đồng ý gia hạn', say: 'Có thêm thời gian thở, nhưng nợ nhiều hơn.', fx: (s, rng) => all(debt(Math.round((s.debt * 0.1) / 1000) * 1000), dueDay(5))(s, rng) },
      { label: 'Không cần', say: 'Quyết tâm trả đúng hạn!' },
    ],
  }),
  fun({
    id: 'b_rent_up',
    phase: 'morning',
    emoji: '🏠',
    title: 'Chủ nhà tăng tiền thuê 20%',
    weight: BIG,
    when: fromDay(5),
    body: 'Chủ nhà báo: “Giá cả lên hết rồi, tiền nhà tăng 20% nha con.”',
    choices: [
      { label: 'Đồng ý', say: 'Chủ nhà vui vẻ, quán yên ổn làm ăn.', fx: rent(1.2, 10) },
      { label: 'Mặc cả', fx: chance(0.5, all(tell('Chủ nhà mềm lòng, giữ nguyên giá cũ!'), rep(0.01)), all(tell('Chủ nhà phật ý, tăng hẳn 30%…'), rent(1.3, 10))) },
    ],
  }),
  fun({
    id: 'b_cart',
    phase: 'morning',
    emoji: '🛺',
    title: 'Mở xe đẩy bán thêm',
    weight: BIG,
    when: (s) => s.day >= 5 && !s.flags?.cart,
    body: 'Có người bán lại xe đẩy 1 triệu. Mở xe đẩy ở đầu hẻm sẽ bán được thêm nhiều.',
    choices: [
      { label: 'Mua xe đẩy', enabled: hasMoney(1_000_000), say: 'Xe đẩy sơn đỏ rực, đầu hẻm thơm mùi đồ ăn!', fx: all(money(-1_000_000), flag('cart'), revenue(0.1, 15, 'Xe đẩy đầu hẻm')) },
      { label: 'Chưa phải lúc', say: 'Để dành tiền đã.' },
    ],
  }),
  fun({
    id: 'b_relative',
    phase: 'morning',
    emoji: '👨‍👩‍👧',
    title: 'Họ hàng xin làm không lương',
    weight: BIG,
    when: (s) => s.day >= 5 && s.staff.length < 6 && !s.staff.some((st) => st.name === RELATIVE),
    body: 'Cháu Tí dưới quê lên chơi 3 ngày, xin phụ quán không lấy lương.',
    choices: [
      {
        label: 'Nhận cháu phụ bếp',
        fx: (s, rng) => {
          const st = makeStaff(s, rng, 'prep');
          st.name = RELATIVE;
          st.wage = 0;
          s.staff.push(st);
          line('🧒 Cháu Tí phụ bếp 3 ngày (không lương)');
          later(3, 'b_relative_leave', 'Cháu Tí ở 3 ngày…')(s, rng);
          chance(0.4, all(tell('Cháu Tí siêng lắm… nhưng hay ăn vụng!'), stockLoss(0.1)), tell('Cháu Tí siêng năng, ngoan ngoãn.'))(s, rng);
        },
      },
      { label: 'Khéo từ chối', say: 'Cháu Tí đi chơi phố với bạn.' },
    ],
  }),
  fun({
    id: 'b_district_contest',
    phase: 'morning',
    emoji: '🏆',
    title: 'Cuộc thi “Quán ngon quận”',
    weight: BIG,
    when: fromDay(5),
    body: 'Quận mở cuộc thi quán ngon, phí 500 nghìn. Ba ngày nữa giám khảo chấm theo sao của quán.',
    choices: [
      {
        label: 'Tập món trước khi thi',
        enabled: hasMoney(500_000),
        game: {
          type: 'sequence',
          params: { options: ['🍜', '🥖', '🍚', '🍵'], need: 5 },
          win: all(money(-500_000), flag('contestPrep'), later(3, 'b_contest', 'Ba ngày nữa giám khảo tới…')),
          lose: all(money(-500_000), later(3, 'b_contest', 'Ba ngày nữa giám khảo tới…')),
          winSay: 'Tập nhuần nhuyễn rồi! Tự tin đăng ký.',
          loseSay: 'Tập chưa kỹ, nhưng vẫn đăng ký thử sức.',
        },
      },
      { label: 'Đăng ký luôn', enabled: hasMoney(500_000), say: 'Đã nộp đơn, chờ giám khảo.', fx: all(money(-500_000), later(3, 'b_contest', 'Ba ngày nữa giám khảo tới…')) },
      { label: 'Không tham gia', say: 'Để năm sau vậy.' },
    ],
  }),
  fun({
    id: 'b_claw',
    phase: 'morning',
    emoji: '🧸',
    title: 'Đặt máy gắp thú',
    weight: BIG,
    when: (s) => s.day >= 5 && !s.flags?.claw,
    body: 'Công ty đồ chơi muốn đặt máy gắp thú ở quán, chia tiền mỗi ngày.',
    choices: [
      { label: 'Đặt máy', say: 'Trẻ con kéo tới gắp thú, quán rộn ràng nhưng bề bộn hơn.', fx: all(flag('claw'), dailyIncome(40_000, 20, 'Máy gắp thú'), crowd(1.05), clean(-5)) },
      { label: 'Không đặt', say: 'Quán vẫn gọn gàng như cũ.' },
    ],
  }),
  fun({
    id: 'b_coffee_contract',
    phase: 'morning',
    emoji: '☕',
    title: 'Hợp đồng cà phê văn phòng',
    weight: BIG,
    when: fromDay(5),
    body: 'Văn phòng gần quán muốn đặt 20 ly mỗi sáng trong 7 ngày, giá sỉ.',
    choices: [
      { label: 'Ký hợp đồng', say: 'Sáng nào cũng giao 20 ly, tiền về đều đều.', fx: all(dailyIncome(100_000, 7, 'Hợp đồng văn phòng'), stove(10_000)) },
      { label: 'Không ký', say: 'Văn phòng tìm chỗ khác.' },
    ],
  }),
  fun({
    id: 'b_audit',
    phase: 'morning',
    emoji: '🧾',
    title: 'Phường kiểm tra sổ sách',
    weight: BIG,
    when: fromDay(5),
    body: 'Cán bộ phường tới kiểm tra sổ thu chi của quán.',
    choices: [
      {
        label: 'Rà sổ cho khớp',
        game: { type: 'spot', params: { prompt: 'Tìm 3 chỗ ghi sai trong sổ!' }, win: rep(0.05), lose: money(-200_000), winSay: 'Sổ sách rõ ràng! Cán bộ khen quán làm ăn đàng hoàng.', loseSay: 'Còn sai sót, bị phạt nhẹ.' },
      },
      { label: 'Nộp thuế đầy đủ', say: 'Mọi thứ minh bạch.', fx: (s, rng) => money(-Math.min(200_000, Math.max(50_000, Math.round((s.money * 0.05) / 1000) * 1000)))(s, rng) },
      { label: '“Sổ bị mèo ăn rồi”', fx: chance(0.4, tell('Cán bộ cười, hẹn lần sau.'), all(tell('Cán bộ không tin, phạt nặng!'), money(-600_000), rep(-0.1))) },
    ],
  }),
  fun({
    id: 'b_tv_rescue',
    phase: 'morning',
    emoji: '📺',
    title: 'TV mời “Giải cứu quán ăn”',
    weight: BIG,
    when: fromDay(5),
    body: 'Chương trình TV muốn tới quay quán. Phải trả lời phỏng vấn và đóng cửa một lúc để quay.',
    choices: [
      {
        label: 'Trả lời phỏng vấn',
        game: { type: 'quiz', win: all(stove(60_000), later(1, 'b_tv_air', 'Chờ chương trình lên sóng…'), rep(0.05)), lose: all(stove(60_000), rep(-0.05)), winSay: 'Trả lời xuất sắc! MC khen chủ quán rất hiểu nghề.', loseSay: 'Lúng túng trước ống kính, phần phỏng vấn bị cắt…' },
      },
      { label: 'Từ chối', say: 'Quán vẫn bình yên như cũ.' },
    ],
  }),
];
