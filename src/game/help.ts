/**
 * Hướng dẫn bằng hình cho nút "!" trên từng màn: mỗi bước là một hình to + một câu ngắn
 * (đủ để bé 5 tuổi nghe bố mẹ đọc, hoặc bấm 🔊 để máy đọc).
 */
export type HelpTopic = 'home' | 'character' | 'market' | 'shop' | 'kitchen' | 'counter' | 'event' | 'summary' | 'staff' | 'upgrades' | 'lab' | 'notebook';

export interface HelpStep {
  icon: string;
  text: string;
  /** Chỗ viền vàng khi đọc bước này (cùng khoá với hướng dẫn, vd 'market.pay'). */
  target?: string;
}

export const HELP: Record<HelpTopic, { title: string; steps: HelpStep[]; more?: HelpStep[] }> = {
  home: {
    title: 'Mở quán ăn',
    steps: [
      { icon: '🆕', text: 'Bấm Chơi mới để mở quán.' },
      { icon: '🛒', text: 'Buổi sáng đi chợ mua đồ.' },
      { icon: '🏮', text: 'Mở cửa đón khách.' },
      { icon: '🔪', text: 'Thái đồ, rồi nấu, rồi mang cho khách.' },
      { icon: '🐣', text: '3 ngày đầu khách ít để bạn làm quen.' },
      { icon: '⭐', text: 'Khách vui thì được sao và tiền.' },
    ],
    more: [
      { icon: '💳', text: 'Quán đang nợ tiền ngân hàng — kiếm đủ tiền để trả trước hạn.' },
      { icon: '👥', text: 'Có thể thuê người giúp, nhưng họ đôi khi làm sai.' },
    ],
  },
  character: {
    title: 'Làm chủ quán',
    steps: [
      { icon: '👤', text: 'Chọn một bạn nhân vật.' },
      { icon: '🎨', text: 'Chạm vào màu để đổi áo, quần, tóc.' },
      { icon: '🎲', text: 'Bấm xúc xắc để đổi ngẫu nhiên.' },
      { icon: '✅', text: 'Xong thì bấm Lưu.' },
    ],
  },
  market: {
    title: 'Đi chợ',
    steps: [
      { icon: '🏪', text: 'Chợ có 4 sạp: 🥩 thịt tôm (Cô Bảy), 🥚 trứng bột (Bà Năm), 🥬 rau hành (Dì Sáu), 🧋 đồ uống (Chú Ba).', target: 'market.stall:thit' },
      { icon: '👆', text: 'Chạm tên sạp: chủ quán đi tới, bảng hàng của sạp mở ra.', target: 'market.stall:bot' },
      { icon: '➕', text: 'Bấm +5 để bỏ 5 phần vào giỏ, + để thêm 1, − để bớt, hoặc chạm ô số để gõ số phần. Xong bấm ✓ Xong.' },
      { icon: '🤝', text: 'Trong sạp có nút Trả giá: mỗi sạp trả giá 2 lần mỗi ngày. Người bán vui thì bớt tiền cả sạp hôm đó.' },
      { icon: '💳', text: 'Bấm 💳 Trả tiền. Nút mờ là kho hết chỗ hoặc không đủ tiền.', target: 'market.pay' },
      { icon: '🏮', text: 'Mua xong bấm 🏮 Mở cửa để về quán đón khách. Lười chọn thì bấm 🧾 Theo menu cho giỏ tự đủ đồ.', target: 'market.open' },
    ],
    more: [
      { icon: '🤝', text: 'Mỗi sạp trả giá được 2 lần mỗi ngày — trả được thì cả sạp bớt tiền hôm đó.' },
      { icon: '♥', text: 'Mua quen một sạp thì người bán thân hơn và bớt sẵn cho mỗi phần.' },
      { icon: '🏷️', text: 'Có món khuyến mãi mỗi ngày; buổi chiều rau và hành bớt giá.' },
      { icon: '📦', text: 'Kho có hạn chỗ; mua tủ lạnh để chứa thêm và giữ đồ tươi lâu hơn.' },
      { icon: '🦠', text: 'Đồ tươi để lâu sẽ hỏng, phải vứt đi.' },
      { icon: '💳', text: 'Bấm thẻ nợ để trả nợ ngân hàng.' },
    ],
  },
  shop: {
    title: 'Bán hàng',
    steps: [
      { icon: '👆', text: 'Chạm vào chỗ muốn đi, hoặc chạm nhãn màu của bếp, thớt, bàn.' },
      { icon: '🔪', text: 'Tới thớt hoặc bếp để nấu.' },
      { icon: '🍽️', text: 'Cầm món rồi chạm vào bàn khách đang chờ.' },
      { icon: '😊', text: 'Vòng tròn quanh món ngắn dần — nhanh lên kẻo khách buồn!' },
      { icon: '❓', text: 'Khách hỏi thì chạm vào ❓ để trả lời — trả lời khéo được boa thêm!' },
      { icon: '🎮', text: 'Nút Đơn giản trên cùng: chạm ô là làm luôn, không cần đi. Nút 3D: xem quán 3D.' },
    ],
    more: [
      { icon: '⟲', text: 'Nút ⟲ xoay quán, nút cộng trừ để phóng to thu nhỏ.' },
      { icon: '🧱', text: 'Nút Bố trí hiện chỗ trống để mua thêm bếp, quầy, bàn.' },
      { icon: '⌨️', text: 'Máy tính: phím mũi tên / WASD để đi, E hoặc Space để làm.' },
    ],
  },
  kitchen: {
    title: 'Trong bếp',
    steps: [
      { icon: '🔀', text: 'Bếp có 3 màn: 🔪 Sơ chế, 🔥 Bếp, 🧋 Pha chế. Chấm đỏ là màn đó đang có việc.' },
      { icon: '🔪', text: 'Màn Sơ chế: chạm ô nguyên liệu để thái, rồi chạm thớt thật nhiều cho nhanh.' },
      { icon: '🍲', text: 'Màn Bếp: chạm món khách gọi (có ×số) để bỏ vào nồi, rồi bấm 🔥 Nấu.' },
      { icon: '🥄', text: 'Chạm vào nồi để khuấy. Chín rồi thì bấm 🍽️ Lấy.' },
      { icon: '⚠️', text: 'Để lâu quá sẽ cháy!' },
    ],
    more: [{ icon: '⏳', text: 'Món của khách đang nấu thì khách chờ thong thả hơn.' }, { icon: '1️⃣', text: 'Phím 1, 2... khuấy hoặc lấy món ở bếp tương ứng.' }],
  },
  counter: {
    title: 'Pha đồ uống',
    steps: [
      { icon: '🧋', text: 'Bỏ nguyên liệu vào ly rồi bấm 🔥 Nấu.' },
      { icon: '👆', text: 'Chạm để lắc cho nhanh.' },
      { icon: '🍽️', text: 'Xong thì lấy ra mang cho khách.' },
    ],
  },
  event: {
    title: 'Có chuyện xảy ra!',
    steps: [
      { icon: '❗', text: 'Quán gặp chuyện bất ngờ.' },
      { icon: '👆', text: 'Chọn một cách để xử lý.' },
    ],
  },
  summary: {
    title: 'Hết ngày',
    steps: [
      { icon: '⭐', text: 'Sao là khách khen quán.' },
      { icon: '💰', text: 'Số tiền kiếm được hôm nay.' },
      { icon: '😊', text: 'Số khách vui · 😡 số khách bỏ về.' },
      { icon: '☀️', text: 'Bấm để sang ngày mới.' },
    ],
  },
  staff: {
    title: 'Người giúp việc',
    steps: [
      { icon: '👥', text: 'Thuê người giúp nấu, thái, bưng món.' },
      { icon: '💰', text: 'Mỗi ngày phải trả lương.' },
      { icon: '😅', text: 'Người mới hay làm sai hơn người giỏi.' },
    ],
  },
  lab: {
    title: 'Sổ món & Menu',
    steps: [
      { icon: '🥚', text: 'Chạm 2–4 nguyên liệu để bỏ vào nồi thử rồi bấm Nấu thử.' },
      { icon: '🍽️', text: 'Tổ hợp nào cũng ra món: 😋 ngon, 🤔 lạ hoặc 🧟 quái dị.' },
      { icon: '➕', text: 'Thích món nào thì bấm Thêm vào menu — khách sẽ gọi món mới nhiều hơn trong ngày đầu.' },
      { icon: '🧟', text: 'Món quái dị dễ bị khách chê, nhưng biết đâu thành trend!' },
      { icon: '📖', text: 'Chạm vào món trong sổ để đưa vào hoặc bỏ khỏi menu.' },
    ],
  },
  notebook: {
    title: 'Sổ tay chủ quán',
    steps: [
      { icon: '📋', text: 'Mỗi sáng có việc hôm nay. Làm xong thì bấm Nhận thưởng.' },
      { icon: '🎟️', text: 'Thưởng có tiền và vé thưởng. Vé để dành mua đồ trang trí quán sau này.' },
      { icon: '⭐', text: 'Việc khó có thêm sao hy vọng. Sao để dành quay thưởng sau này.' },
      { icon: '🌟', text: 'Bán món đặc biệt hôm nay được gấp đôi điểm.' },
      { icon: '✍️', text: 'Tối về viết nhật ký: chọn mặt cười, nhãn dán, viết vài dòng rồi bấm Lưu trang.' },
    ],
    more: [
      { icon: '💡', text: 'Nhãn xanh nhỏ trên cùng gợi ý việc tiếp theo; chạm vào để thấy chỗ cần bấm.' },
    ],
  },
  upgrades: {
    title: 'Nâng cấp quán',
    steps: [
      { icon: '🔥', text: 'Mua thêm bếp.' },
      { icon: '🪑', text: 'Thêm bàn ghế cho khách.' },
      { icon: '📖', text: 'Học thêm món mới.' },
    ],
  },
};
