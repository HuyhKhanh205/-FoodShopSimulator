import { all, chance, crowd, delivery, follow, fun, guests, hasMoney, later, money, rep, revenue, stove, tell, tickets, trend } from './kit';
import type { EventDef } from './types';

/** F. Mạng xã hội — 10 tình huống. */

follow('so_cooking_show', all(tell('Video quay chung đã lên sóng, món của quán thành trend!'), trend(), crowd(1.2)));

export const FUNNY_SOCIAL: EventDef[] = [
  fun({
    id: 'so_trip_clip',
    phase: 'morning',
    emoji: '📹',
    title: 'Clip chủ quán vấp té thành hot',
    body: 'Hôm qua ai đó quay cảnh chủ quán vấp té bưng phở. Sáng nay clip đã triệu view!',
    choices: [
      { label: 'Ra “combo vấp té”', say: 'Khách kéo tới đòi xem chủ quán vấp lần nữa!', fx: crowd(1.4, 2) },
      { label: 'Xin gỡ clip', say: 'Clip được gỡ, mọi chuyện lắng xuống.' },
    ],
  }),
  fun({
    id: 'so_spicy',
    phase: 'day',
    emoji: '🌶️',
    title: 'Thử thách ăn cay',
    body: 'Nhóm bạn trẻ đòi tổ chức thử thách “ăn cay không uống nước” ngay tại quán!',
    choices: [
      {
        label: 'Tổ chức, quạt cho khách',
        game: { type: 'tap', params: { emoji: '🌬️', need: 24, seconds: 6, prompt: 'Chạm thật nhanh để quạt mát!' }, win: all(money(150_000), rep(0.05)), lose: all(money(80_000), rep(-0.03)), winSay: 'Quạt mát rượi, ai cũng vượt thử thách! Clip lan khắp nơi.', loseSay: 'Cay xé lưỡi, khách chạy đi tìm nước…' },
      },
      { label: 'Không tổ chức', say: 'Nhóm bạn tiếc, nhưng vẫn ăn bình thường.' },
    ],
  }),
  fun({
    id: 'so_wrong_review',
    phase: 'day',
    emoji: '⭐',
    title: 'Bị review 1★ nhầm quán',
    body: '“Quán dở tệ, không có pizza!” — ai đó review nhầm quán rồi!',
    choices: [
      { label: 'Trả lời hài hước', fx: chance(0.6, all(tell('Câu trả lời “Quán chỉ có phở, pizza đi lạc rồi ạ” được cả triệu người thích!'), rep(0.08), crowd(1.2)), tell('Chẳng ai để ý câu trả lời.')) },
      { label: 'Im lặng', say: 'Review 1★ vẫn nằm đó…', fx: rep(-0.05) },
    ],
  }),
  fun({
    id: 'so_meme',
    phase: 'day',
    emoji: '🐱',
    title: 'Meme “chủ quán ngơ ngác”',
    body: 'Ảnh chủ quán ngơ ngác nhìn nồi phở thành meme lan khắp mạng.',
    choices: [
      { label: 'In áo meme bán', say: 'Áo in hình “chủ quán ngơ ngác” bán hết sạch!', fx: money(150_000) },
      { label: 'Kệ', say: 'Meme trôi qua sau vài ngày.' },
    ],
  }),
  fun({
    id: 'so_idol',
    phase: 'day',
    emoji: '🍜',
    title: 'Idol ăn thử chê nhạt',
    body: 'Một idol ẩm thực ăn thử rồi chê “nhạt quá”. Idol thách đố kiến thức ẩm thực của chủ quán!',
    choices: [
      {
        label: 'Nhận lời thách đố',
        game: { type: 'quiz', win: all(rep(0.1), crowd(1.3)), lose: rep(-0.06), winSay: 'Idol phục sát đất, quay clip khen quán “chủ quán hiểu biết”!', loseSay: 'Trả lời sai be bét, idol đăng clip chê tiếp…' },
      },
      { label: 'Mời ăn lại món khác', fx: chance(0.5, all(tell('Món mới đậm đà, idol khen nức nở!'), rep(0.06)), all(tell('Idol vẫn chê…'), rep(-0.03))) },
      { label: 'Kệ idol', say: 'Khách quen vẫn khen quán ngon.' },
    ],
  }),
  fun({
    id: 'so_delivery_app',
    phase: 'morning',
    emoji: '📲',
    title: 'App giao hàng mời lên sàn',
    when: (s) => s.day >= 4,
    body: 'App giao hàng mời quán lên sàn: đơn nhiều hơn, nhưng mất phí cho sàn.',
    choices: [
      { label: 'Đồng ý lên sàn', say: 'Đơn giao hàng ting ting liên tục!', fx: all(delivery(2, 7), revenue(-0.05, 7, 'Phí sàn giao hàng')) },
      { label: 'Từ chối', say: 'Quán vẫn bán theo cách cũ.' },
    ],
  }),
  fun({
    id: 'so_wrong_tag',
    phase: 'day',
    emoji: '🏅',
    title: 'Bị tag nhầm “quán ngon nhất phố”',
    body: 'Một bài viết nổi tiếng tag nhầm quán là “Quán ngon nhất phố”!',
    choices: [
      { label: 'Tận dụng ngay', fx: all(crowd(1.3), chance(0.5, tell('Khách tới ăn thấy ngon thật, gật gù hài lòng.'), all(tell('Vài khách hụt hẫng: “Tưởng ngon hơn cơ…”'), rep(-0.05)))) },
      { label: 'Đính chính thật thà', say: 'Mọi người khen quán trung thực!', fx: rep(0.06) },
    ],
  }),
  fun({
    id: 'so_cooking_channel',
    phase: 'day',
    emoji: '🎬',
    title: 'Kênh nấu ăn mời quay chung',
    body: 'Một kênh nấu ăn lớn muốn quay chủ quán nấu món đặc biệt.',
    choices: [
      { label: 'Quay ngay', say: 'Bếp dừng một lúc để quay, cả ê-kíp khen ngon.', fx: all(stove(30_000), later(1, 'so_cooking_show', 'Video sẽ lên sóng…')) },
      { label: 'Để dịp khác', say: 'Kênh hẹn lần sau.' },
    ],
  }),
  fun({
    id: 'so_vote',
    phase: 'day',
    emoji: '🥇',
    title: 'Bình chọn “Quán của tháng”',
    body: 'Quán được đề cử “Quán của tháng”! Muốn thắng phải nhớ tên các khách quen.',
    choices: [
      {
        label: 'Nhớ mặt khách quen',
        game: { type: 'memory', params: { need: 5 }, win: all(tickets(10), rep(0.1)), lose: tickets(2), winSay: 'Khách quen bình chọn ào ào! Quán thắng giải tháng.', loseSay: 'Thiếu vài phiếu, về nhì. Vẫn được vé an ủi!' },
      },
      { label: 'Kêu gọi khách bình chọn', fx: chance(0.5, all(tell('Thắng giải! Được thưởng vé.'), tickets(10), rep(0.05)), all(tell('Khách thấy phiền vì bị nhắc hoài…'), rep(-0.03))) },
      { label: 'Thôi', say: 'Quán khác thắng, cũng không sao.' },
    ],
  }),
  fun({
    id: 'so_funny_name',
    phase: 'day',
    emoji: '😂',
    title: 'Tên quán bị đọc chệch',
    body: 'Có người đọc chệch tên quán thành một từ rất buồn cười, cả mạng cười rần rần.',
    choices: [
      { label: 'Đổi bảng hiệu 300k', enabled: hasMoney(300_000), say: 'Bảng mới rõ ràng, không ai đọc nhầm nữa.', fx: money(-300_000) },
      { label: 'Giữ tên, in áo', say: 'Quán tự trêu mình, khách thấy dễ thương ghê!', fx: all(guests(3), money(50_000)) },
    ],
  }),
];
