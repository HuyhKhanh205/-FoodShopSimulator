import { pick } from './helpers';
import type { GameState, Rng } from './types';

/**
 * Khách trò chuyện: câu nói ngẫu nhiên về đời sống hiện trong bong bóng trên đầu khách,
 * khách bàn bên đôi khi đáp lời; thỉnh thoảng khách hỏi chủ quán — chọn câu trả lời bằng hình.
 */

export interface ChatLine {
  icon: string;
  text: string;
}

export const SMALL_TALK: ChatLine[] = [
  // Thời tiết
  { icon: '☔', text: 'Mưa to quá, may mà quán gần nhà!' },
  { icon: '☀️', text: 'Trời nóng ghê, uống ly trà đá cho mát.' },
  { icon: '🌬️', text: 'Hôm nay gió mát dễ chịu thật.' },
  { icon: '🌈', text: 'Vừa thấy cầu vồng ngoài đầu ngõ đó!' },
  // Gia đình
  { icon: '👶', text: 'Con tôi mới biết đi, vui lắm!' },
  { icon: '👵', text: 'Cuối tuần về quê thăm bà nội.' },
  { icon: '🎂', text: 'Hôm nay sinh nhật vợ tôi, phải mua bánh.' },
  { icon: '🐣', text: 'Nhà tôi mới nuôi thêm mấy con gà con.' },
  // Công việc
  { icon: '💼', text: 'Sếp giao việc nhiều quá, mệt ghê.' },
  { icon: '💻', text: 'Chiều nay còn họp online nữa.' },
  { icon: '🎉', text: 'Tôi mới được tăng lương đó!' },
  { icon: '🛠️', text: 'Sáng giờ sửa xe cho khách mỏi cả tay.' },
  // Trường học
  { icon: '📚', text: 'Mai con tôi thi học kỳ rồi.' },
  { icon: '🏫', text: 'Trường gần đây mới xây thêm sân chơi.' },
  { icon: '✏️', text: 'Bé nhà tôi được điểm 10 môn vẽ!' },
  // Thể thao
  { icon: '⚽', text: 'Tối qua đội tuyển thắng 2–0, đã quá!' },
  { icon: '🏸', text: 'Sáng nào tôi cũng đánh cầu lông.' },
  { icon: '🏃', text: 'Tôi đang tập chạy bộ để giảm cân.' },
  // Giao thông
  { icon: '🚗', text: 'Đường kẹt xe cả tiếng đồng hồ.' },
  { icon: '🛵', text: 'Xe tôi vừa thủng lốp giữa đường.' },
  { icon: '🚌', text: 'Xe buýt hôm nay đến trễ quá.' },
  // Giá cả, chợ búa
  { icon: '🥬', text: 'Rau ngoài chợ dạo này lên giá.' },
  { icon: '🍉', text: 'Mùa này dưa hấu ngọt lắm.' },
  { icon: '🛒', text: 'Siêu thị đang giảm giá nửa tháng nay.' },
  // Lễ tết, du lịch
  { icon: '🏮', text: 'Sắp Trung thu rồi, phải mua lồng đèn.' },
  { icon: '🧧', text: 'Còn mấy tháng nữa là Tết rồi đó.' },
  { icon: '🏖️', text: 'Hè này cả nhà đi biển Nha Trang.' },
  { icon: '⛰️', text: 'Tôi mới leo núi Bà Đen về.' },
  // Thú cưng
  { icon: '🐶', text: 'Con chó nhà tôi biết bắt tay rồi.' },
  { icon: '🐱', text: 'Mèo nhà tôi ăn vụng cá hoài.' },
  { icon: '🐟', text: 'Mới mua thêm bể cá vàng cho con.' },
  // Sức khoẻ, đời thường
  { icon: '🤧', text: 'Dạo này trời chuyển mùa dễ cảm quá.' },
  { icon: '🧘', text: 'Tôi mới tập yoga, thấy khoẻ hẳn.' },
  { icon: '📱', text: 'Điện thoại tôi hết pin rồi, chán ghê.' },
  { icon: '🎤', text: 'Tối nay đi hát karaoke với bạn.' },
  { icon: '📺', text: 'Phim tối qua hay ghê, xem chưa?' },
  { icon: '🌻', text: 'Tôi mới trồng chậu hoa hướng dương.' },
  { icon: '🍜', text: 'Quán này nấu giống mẹ tôi nấu ghê.' },
  { icon: '😋', text: 'Đói bụng quá, mong món ra nhanh!' },
  { icon: '👃', text: 'Mùi thơm từ bếp bay ra ngon quá!' },
];

/** Câu đáp lời của khách bàn bên. */
export const REPLIES: ChatLine[] = [
  { icon: '😄', text: 'Thật hả? Hay quá!' },
  { icon: '👍', text: 'Đúng đó, tôi cũng vậy!' },
  { icon: '😂', text: 'Haha, vui ghê!' },
  { icon: '😮', text: 'Ồ, lần đầu nghe luôn.' },
  { icon: '🤝', text: 'Hôm nào mình đi chung nhé!' },
  { icon: '😅', text: 'Nhà tôi cũng y chang.' },
];

export interface ChatAnswer {
  icon: string;
  label: string;
  effect: 'good' | 'ok' | 'bad';
  /** Khách nói lại sau khi nghe trả lời. */
  reply: string;
}

export interface ChatQuestion {
  id: string;
  icon: string;
  text: string;
  answers: ChatAnswer[];
}

export const QUESTIONS: ChatQuestion[] = [
  {
    id: 'hungry_kid',
    icon: '👶',
    text: 'Con tôi đói lắm, có món gì nhanh không?',
    answers: [
      { icon: '🥪', label: 'Bánh mì ngay!', effect: 'good', reply: 'Tuyệt, cảm ơn chủ quán!' },
      { icon: '🍜', label: 'Phở ngon lắm', effect: 'ok', reply: 'Ừ, chờ chút cũng được.' },
      { icon: '🤷', label: 'Chờ đi', effect: 'bad', reply: 'Hừm, sao phũ thế...' },
    ],
  },
  {
    id: 'rain',
    icon: '☔',
    text: 'Mưa to quá, tôi ngồi thêm chút được không?',
    answers: [
      { icon: '😊', label: 'Cứ ngồi!', effect: 'good', reply: 'Chủ quán tốt bụng quá!' },
      { icon: '☂️', label: 'Cho mượn ô', effect: 'good', reply: 'Ôi, chu đáo ghê!' },
      { icon: '⏰', label: 'Sắp đóng cửa', effect: 'bad', reply: 'Ờ... thôi được.' },
    ],
  },
  {
    id: 'birthday',
    icon: '🎂',
    text: 'Hôm nay sinh nhật tôi đó!',
    answers: [
      { icon: '🎉', label: 'Chúc mừng!', effect: 'good', reply: 'Cảm ơn nha, vui quá!' },
      { icon: '🙂', label: 'Vậy à', effect: 'ok', reply: 'Hihi.' },
      { icon: '😐', label: 'Thì sao?', effect: 'bad', reply: 'Buồn ghê...' },
    ],
  },
  {
    id: 'football',
    icon: '⚽',
    text: 'Tối qua xem bóng đá chưa, chủ quán?',
    answers: [
      { icon: '🥳', label: 'Thắng rồi!', effect: 'good', reply: 'Đúng rồi, trận hay ghê!' },
      { icon: '😴', label: 'Ngủ mất', effect: 'ok', reply: 'Tiếc ghê, hay lắm đó.' },
      { icon: '🙄', label: 'Không thích', effect: 'bad', reply: 'Ồ... vậy à.' },
    ],
  },
  {
    id: 'spicy',
    icon: '🌶️',
    text: 'Quán có ớt không? Tôi thích ăn cay.',
    answers: [
      { icon: '🌶️', label: 'Có liền!', effect: 'good', reply: 'Tuyệt vời!' },
      { icon: '🧄', label: 'Có tỏi ớt', effect: 'good', reply: 'Hết sẩy!' },
      { icon: '🚫', label: 'Hết rồi', effect: 'ok', reply: 'Thôi cũng được.' },
    ],
  },
  {
    id: 'tired',
    icon: '😫',
    text: 'Hôm nay làm việc mệt quá trời...',
    answers: [
      { icon: '💪', label: 'Cố lên!', effect: 'good', reply: 'Cảm ơn, nghe khoẻ hẳn!' },
      { icon: '🧋', label: 'Uống trà nhé', effect: 'good', reply: 'Ý hay đó!' },
      { icon: '🤷', label: 'Ai cũng mệt', effect: 'bad', reply: 'Ừ ha...' },
    ],
  },
  {
    id: 'recipe',
    icon: '👩‍🍳',
    text: 'Bí quyết nấu ngon của quán là gì vậy?',
    answers: [
      { icon: '❤️', label: 'Nấu bằng tâm', effect: 'good', reply: 'Hèn chi ngon thế!' },
      { icon: '🤫', label: 'Bí mật!', effect: 'ok', reply: 'Haha, giữ kỹ ghê.' },
      { icon: '🧂', label: 'Nhiều muối', effect: 'bad', reply: 'Ơ... mặn không đó?' },
    ],
  },
  {
    id: 'wifi',
    icon: '📶',
    text: 'Quán có wifi không chủ quán?',
    answers: [
      { icon: '📶', label: 'Có, miễn phí', effect: 'good', reply: 'Quá được luôn!' },
      { icon: '📵', label: 'Không có', effect: 'ok', reply: 'Thôi nói chuyện vậy.' },
    ],
  },
  {
    id: 'pet',
    icon: '🐶',
    text: 'Tôi dắt chó theo, có sao không?',
    answers: [
      { icon: '🥰', label: 'Dễ thương!', effect: 'good', reply: 'Nó thích quán lắm!' },
      { icon: '🪢', label: 'Buộc ngoài nhé', effect: 'ok', reply: 'Được, được.' },
      { icon: '🙅', label: 'Không được', effect: 'bad', reply: 'Buồn ghê...' },
    ],
  },
  {
    id: 'exam',
    icon: '📚',
    text: 'Mai tôi thi rồi, hồi hộp quá!',
    answers: [
      { icon: '🍀', label: 'Chúc may mắn!', effect: 'good', reply: 'Cảm ơn nhiều nha!' },
      { icon: '💯', label: 'Sẽ được 10', effect: 'good', reply: 'Mong là vậy, hihi!' },
      { icon: '😬', label: 'Khó lắm đó', effect: 'bad', reply: 'Đừng doạ tôi mà...' },
    ],
  },
  {
    id: 'traffic',
    icon: '🚗',
    text: 'Đường về nhà có kẹt xe không ta?',
    answers: [
      { icon: '🗺️', label: 'Đi đường tắt', effect: 'good', reply: 'Hay quá, cảm ơn!' },
      { icon: '🤔', label: 'Không biết', effect: 'ok', reply: 'Ừ, để xem.' },
    ],
  },
  {
    id: 'price',
    icon: '💸',
    text: 'Dạo này cái gì cũng tăng giá ha?',
    answers: [
      { icon: '🙏', label: 'Quán giữ giá', effect: 'good', reply: 'Quý quá, lần sau ghé tiếp!' },
      { icon: '😔', label: 'Đúng vậy', effect: 'ok', reply: 'Ai cũng khổ ha.' },
    ],
  },
  {
    id: 'music',
    icon: '🎵',
    text: 'Bật nhạc gì vui vui đi chủ quán!',
    answers: [
      { icon: '🎶', label: 'Nhạc vui!', effect: 'good', reply: 'Nghe là muốn hát theo!' },
      { icon: '🎻', label: 'Nhạc nhẹ', effect: 'ok', reply: 'Cũng thư giãn ghê.' },
      { icon: '🔇', label: 'Ồn lắm', effect: 'bad', reply: 'Im lặng quá ha...' },
    ],
  },
  {
    id: 'first_time',
    icon: '🙋',
    text: 'Lần đầu tôi ăn ở đây, món nào ngon nhất?',
    answers: [
      { icon: '🍜', label: 'Phở bò!', effect: 'good', reply: 'Vậy lần sau thử phở!' },
      { icon: '😋', label: 'Món nào cũng ngon', effect: 'good', reply: 'Tự tin ghê, thích nha!' },
      { icon: '🤷', label: 'Tuỳ bạn', effect: 'ok', reply: 'Ờ, để tôi xem.' },
    ],
  },
  {
    id: 'lost_key',
    icon: '🔑',
    text: 'Ai thấy chùm chìa khoá của tôi đâu không?',
    answers: [
      { icon: '🔍', label: 'Để tìm giúp', effect: 'good', reply: 'A, nó trong túi áo! Cảm ơn!' },
      { icon: '🤷', label: 'Không thấy', effect: 'ok', reply: 'Chắc để ở nhà rồi.' },
    ],
  },
];

const QUESTION_MAP = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

export function questionOf(id: string | undefined): ChatQuestion | undefined {
  return id ? QUESTION_MAP[id] : undefined;
}

export function answerEffect(questionId: string, index: number): ChatAnswer | undefined {
  return QUESTION_MAP[questionId]?.answers[index];
}

/** Thời gian một bong bóng trò chuyện / câu hỏi còn hiện (ms). */
export const CHAT_MS = 5_000;
export const QUESTION_MS = 20_000;

/**
 * Mỗi nhịp game: khách đang ngồi thỉnh thoảng nói một câu (≈ 25 giây / người), khách khác đáp lời;
 * khoảng 1/4 khách hỏi chủ quán một câu (chỉ một câu hỏi đang chờ cùng lúc).
 */
export function tickChat(s: GameState, dt: number, rng: Rng) {
  const run = s.run;
  if (!run) return;
  const t = run.elapsed;
  let asking = false;
  for (const c of run.customers) {
    if (c.chat && t >= c.chat.until) c.chat = undefined;
    if (c.question && t >= c.question.until) c.question = undefined;
    if (c.question) asking = true;
  }
  const seated = run.customers.filter((c) => c.tableIndex !== undefined && t - c.arrivedAt > 3000);
  for (const c of seated) {
    if (c.chat || c.question || rng() >= dt / 25_000) continue;
    if (!c.asked && !asking && rng() < 0.3) {
      c.asked = true;
      c.question = { id: pick(rng, QUESTIONS).id, until: t + QUESTION_MS };
      asking = true;
      continue;
    }
    const line = pick(rng, SMALL_TALK);
    c.chat = { ...line, until: t + CHAT_MS };
    // Khách khác đáp lời.
    const others = seated.filter((o) => o !== c && !o.chat && !o.question);
    if (others.length && rng() < 0.4) {
      const o = pick(rng, others);
      o.chat = { ...pick(rng, REPLIES), until: t + CHAT_MS };
    }
  }
}
