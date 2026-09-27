/**
 * Hướng dẫn bằng hình cho nút "!" trên từng màn: mỗi bước là một hình to + một câu ngắn
 * (đủ để bé 5 tuổi nghe bố mẹ đọc, hoặc bấm 🔊 để máy đọc).
 */
export type HelpTopic = 'home' | 'character' | 'market' | 'shop' | 'kitchen' | 'counter' | 'event' | 'summary' | 'staff' | 'upgrades' | 'lab';

export interface HelpStep {
  icon: string;
  text: string;
}

export const HELP: Record<HelpTopic, { title: string; steps: HelpStep[]; more?: HelpStep[] }> = {
  home: {
    title: 'Mở quán ăn',
    steps: [
      { icon: '🆕', text: 'Bấm Chơi mới để mở quán.' },
      { icon: '🛒', text: 'Buổi sáng đi chợ mua đồ.' },
      { icon: '🏮', text: 'Mở cửa đón khách.' },
      { icon: '🔪', text: 'Thái đồ, rồi 🔥 nấu, rồi 🍽️ mang cho khách.' },
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
      { icon: '🏮', text: 'Xong thì bấm Vào quán.' },
    ],
  },
  market: {
    title: 'Đi chợ',
    steps: [
      { icon: '➕', text: 'Bấm + để mua đồ, bấm − nếu lỡ mua dư.' },
      { icon: '📦', text: 'Số trong hộp là đồ đang có trong kho.' },
      { icon: '🍜', text: 'Số trên món là số bát nấu được.' },
      { icon: '🔪', text: 'Thịt, rau, hành phải thái trước khi nấu.' },
      { icon: '🏮', text: 'Mua xong bấm Mở cửa.' },
    ],
    more: [
      { icon: '🦠', text: 'Đồ tươi để lâu sẽ hỏng, phải vứt đi.' },
      { icon: '↑', text: 'Mũi tên đỏ: hôm nay giá đắt. Mũi tên xanh: giá rẻ.' },
      { icon: '💳', text: 'Bấm thẻ nợ để trả nợ ngân hàng.' },
      { icon: '👥', text: 'Thuê người giúp · 🔧 mua thêm bếp, bàn, món mới.' },
    ],
  },
  shop: {
    title: 'Bán hàng',
    steps: [
      { icon: '👆', text: 'Chạm vào chỗ muốn đi.' },
      { icon: '🔪', text: 'Tới thớt hoặc 🔥 bếp để nấu.' },
      { icon: '🍽️', text: 'Cầm món tới bàn khách.' },
      { icon: '😊', text: 'Thanh xanh trên đầu khách ngắn dần — nhanh lên kẻo khách buồn!' },
      { icon: '❓', text: 'Khách hỏi thì chạm vào ❓ để trả lời — trả lời khéo được boa thêm!' },
      { icon: '⏸️', text: 'Nút ⏸️ để nghỉ, 🧽 để lau quán, 🛒 để chạy ra chợ.' },
    ],
    more: [
      { icon: '🚫', text: 'Khách dặn "không hành" thì bật nút 🚫 trước khi nấu.' },
      { icon: '⌨️', text: 'Máy tính: phím mũi tên / WASD để đi, E hoặc Space để làm.' },
    ],
  },
  kitchen: {
    title: 'Trong bếp',
    steps: [
      { icon: '🥩', text: 'Chọn đồ để thái.' },
      { icon: '👆', text: 'Chạm thớt thật nhiều để thái nhanh.' },
      { icon: '🍜', text: 'Chọn món để nấu.' },
      { icon: '🥄', text: 'Chạm vào nồi để khuấy.' },
      { icon: '✅', text: 'Chín rồi thì bấm 🍽️ để lấy ra.' },
      { icon: '⚠️', text: 'Để lâu quá sẽ cháy!' },
    ],
    more: [{ icon: '1️⃣', text: 'Chạm vào nồi khác (hoặc phím 1, 2...) để đổi bếp.' }],
  },
  counter: {
    title: 'Pha đồ uống',
    steps: [
      { icon: '🧋', text: 'Chọn đồ uống.' },
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
    title: 'Bếp thử món',
    steps: [
      { icon: '🥚', text: 'Chạm vào 2–4 nguyên liệu để bỏ vào nồi.' },
      { icon: '🧪', text: 'Bấm Nấu thử.' },
      { icon: '🎉', text: 'Đúng công thức thì có món mới trong menu!' },
      { icon: '🤏', text: '"Gần đúng rồi" là thiếu hoặc thừa 1 thứ.' },
      { icon: '❓', text: 'Ô ❓ là món bí ẩn — thử sai nhiều sẽ lộ gợi ý.' },
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
