import { clamp } from './helpers';
import type { GameState, ReplyTone, Review } from './types';

/**
 * Trả lời đánh giá của khách: người chơi tự gõ câu trả lời, game "đọc" bằng từ khoá (có dấu / không dấu,
 * không cần mạng) để biết giọng trả lời rồi cho khách phản ứng + cộng / trừ danh tiếng.
 */

export const REPLY_MAX = 200;
/** Tổng danh tiếng cộng được từ trả lời trong một ngày. */
export const REPLY_REP_CAP = 0.1;

/** Bỏ dấu tiếng Việt, chữ thường (để so khớp "cam on" = "cảm ơn"). */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const has = (t: string, words: string[]) => words.some((w) => (w.includes(' ') || w.length > 3 ? t.includes(w) : new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(t)));

const THANKS = ['cam on', 'thank', 'thanks', 'tks', 'camon', 'biet on', 'quy khach', 'vui qua', 'rat vui', 'hanh phuc', 'yeu quy', 'tri an'];
const THANK_EMOJI = ['🙏', '❤️', '❤', '🥰', '😍', '💕', '💖', '😊', '🤗'];
const SORRY = ['xin loi', 'sorry', 'thong cam', 'that thanh', 'mong ban bo qua', 'thanh that', 'lay lam tiec', 'rat tiec', 'loi cua quan', 'loi cua minh', 'quan sai'];
const EXPLAIN = ['vi ', 'do ', 'tai vi', 'boi vi', 'dong khach', 'het do', 'het hang', 'bep ', 'nhan vien', 'lan sau', 'se ', 'co gang', 'sua ', 'cai thien', 'rut kinh nghiem', 'khac phuc', 'ghi nhan', 'hoc hoi', 'chu y', 'gop y', 'nhanh hon', 'ngon hon', 'sach hon', 'hom nay', 'ban qua'];
const INVITE = ['moi ', 'quay lai', 'ghe lai', 'ghe quan', 'tang ', 'phieu', 'giam gia', 'mien phi', 'free', 'khuyen mai', 'dai ', 'bu ', 'hen gap', 'lan toi', 'cho ban', 'mon them'];
/** Từ dễ nhầm khi bỏ dấu (xào / sáng tạo / điện / ngủ…): so khớp nguyên dấu, trọn từ. */
const RUDE_EXACT = ['kệ', 'mày', 'tao', 'ngu', 'điên', 'cút', 'xạo', 'chảnh', 'đm', 'vcl', 'vl', 'lol', 'loz', 'đéo', 'méo'];
/** Cụm không nhầm được: so khớp đã bỏ dấu. */
const RUDE = ['ke ban', 'ke may', 'tu di ma', 'khong thich thi', 'ko thich thi', 'k thich thi', 'dung an nua', 'dung toi nua', 'do ngu', 'oc cho', 'occho', 'im di', 'im mom', 'bien di', 'ai care', 'chem gio', 'noi lao', 'danh gia bay', 'danh gia ao', 'ke me', 'khach gi ma', 'kho tinh qua', 'lam nhu hay'];

/** Trọn từ (chữ tiếng Việt có dấu) trong câu chữ thường. */
const hasWord = (t: string, words: string[]) => words.some((w) => new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, 'u').test(t));

export interface ReplyAnalysis {
  tone: ReplyTone;
  /** Điểm tử tế 0..1 (cho độ dài / đủ ý). */
  score: number;
  thanks: boolean;
  sorry: boolean;
  explain: boolean;
  invite: boolean;
  rude: boolean;
}

/** Đọc câu trả lời: cảm ơn / xin lỗi / giải thích / mời quay lại / thô lỗ / quá ngắn. */
export function analyzeReply(text: string, stars: number): ReplyAnalysis {
  const raw = text.trim().slice(0, REPLY_MAX);
  const t = ` ${fold(raw).replace(/[.,;:?()"'…-]/g, ' ').replace(/\s+/g, ' ')} `;
  const letters = raw.replace(/[^A-Za-zÀ-ỹ]/g, '');
  const shouting = letters.length >= 8 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
  const bangs = (raw.match(/!/g) ?? []).length >= 4;
  const thanks = has(t, THANKS) || THANK_EMOJI.some((e) => raw.includes(e));
  const sorry = has(t, SORRY);
  const explain = has(t, EXPLAIN);
  const invite = has(t, INVITE);
  const rude = has(t, RUDE) || hasWord(raw.normalize('NFC').toLowerCase(), RUDE_EXACT) || shouting || (bangs && !thanks && !sorry);
  const words = t.trim().split(' ').filter(Boolean).length;
  const score = clamp(words / 18, 0, 1);
  let tone: ReplyTone;
  if (rude) tone = 'rude';
  else if (words < 3 && !(thanks && stars >= 4)) tone = 'short';
  else if (stars <= 3 && sorry && invite) tone = 'invite';
  else if (stars <= 3 && ((sorry || explain) && (sorry || invite) || (thanks && explain))) tone = 'sorry';
  else if (stars <= 3 && invite) tone = 'sorry';
  else if (thanks) tone = stars >= 4 ? 'thanks' : 'meh';
  else if (stars <= 3 && explain) tone = 'meh';
  else tone = stars >= 4 ? 'meh' : 'short';
  return { tone, score, thanks, sorry, explain, invite, rude };
}

/** Câu khách đáp lại (chọn theo giọng trả lời, cố định theo tên khách để lần nào xem cũng giống). */
const REACTIONS: Record<ReplyTone, string[]> = {
  thanks: ['Quán dễ thương quá, mai mình ghé tiếp! 😍', 'Được chủ quán trả lời luôn, vui ghê! 🥰', 'Nhất định giới thiệu bạn bè tới ăn! 👍'],
  invite: ['Quán có tâm ghê, mai mình quay lại thử nha! 😊', 'Ok quán, mình sẽ ghé lại lần nữa! 🙌', 'Cảm ơn quán nha, hẹn gặp lại! 😄'],
  sorry: ['Ok, lần sau mình thử lại xem sao.', 'Quán biết lỗi là được, cố lên nha! 🙂', 'Hiểu rồi, chắc hôm đó đông khách quá.'],
  meh: ['Ờ… ok quán.', 'Vậy hả… ừm.', 'Cũng được.'],
  short: ['Trả lời gì ngắn vậy quán 😶', '…?', 'Ủa, vậy thôi hả?'],
  rude: ['Hừ, trả lời gì kỳ vậy 😤', 'Quán gì mà chảnh vậy! Không bao giờ quay lại! 😡', 'Thái độ vậy ai mà dám ăn! 😠'],
};

/** Danh tiếng theo giọng trả lời. */
function repGain(a: ReplyAnalysis, stars: number): number {
  switch (a.tone) {
    case 'thanks':
      return 0.01 + 0.01 * a.score;
    case 'invite':
      return 0.05;
    case 'sorry':
      return 0.03;
    case 'rude':
      return -0.05;
    case 'meh':
      return stars >= 4 ? 0.008 : 0.005;
    case 'short':
      return 0.005;
  }
}

/** Câu hiệu quả hiện dưới câu trả lời ("★ +0,03 · 😊 mai khách quay lại"). */
export function effectText(r: Review): string {
  const rep = r.reply?.rep ?? 0;
  const star = `★ ${rep >= 0 ? '+' : '−'}${Math.abs(rep).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}`;
  return [star, r.reply?.back ? '😊 mai khách quay lại' : ''].filter(Boolean).join(' · ');
}

/** Số đánh giá hôm nay chưa trả lời. */
export const unanswered = (s: GameState) => s.report.reviews.filter((r) => !r.reply).length;
/** Số đánh giá hôm nay đã trả lời. */
export const answered = (s: GameState) => s.report.reviews.filter((r) => r.reply).length;

/**
 * Gửi câu trả lời cho đánh giá thứ `index` (mỗi đánh giá 1 lần, tối đa 200 chữ).
 * Trả về đánh giá đã có trả lời, hoặc null nếu không hợp lệ.
 */
export function replyReview(s: GameState, index: number, text: string, rng: () => number = Math.random): Review | null {
  const r = s.report.reviews[index];
  const body = text.trim().slice(0, REPLY_MAX);
  if (!r || r.reply || !body) return null;
  const a = analyzeReply(body, r.stars);
  // Tổng danh tiếng cộng từ trả lời trong ngày có giới hạn (trừ thì không giới hạn).
  const got = s.report.reviews.reduce((sum, x) => sum + Math.max(0, x.reply?.rep ?? 0), 0);
  let rep = repGain(a, r.stars);
  if (rep > 0) rep = Math.max(0, Math.min(rep, REPLY_REP_CAP - got));
  rep = Math.round(rep * 1000) / 1000;
  s.reputation = clamp(s.reputation + rep, 0, 5);
  s.report.repEnd = s.reputation;
  const back = a.tone === 'invite' || (a.tone === 'thanks' && rng() < 0.2);
  const list = REACTIONS[a.tone];
  const seed = [...r.name].reduce((h, c) => h + c.charCodeAt(0), 0);
  r.reply = { text: body, tone: a.tone, reaction: list[seed % list.length], rep, back };
  if (back) {
    s.buffs = s.buffs ?? [];
    const old = s.buffs.find((b) => b.id === 'reply-back' && b.from === s.day + 1);
    if (old) old.spawnMult = Math.min(1.15, (old.spawnMult ?? 1) + 0.03);
    else s.buffs.push({ id: 'reply-back', label: '💬 Khách được trả lời quay lại', from: s.day + 1, until: s.day + 1, spawnMult: 1.03 });
  }
  // Báo cáo trong lịch sử (cùng ngày) giữ đúng bản trả lời khi bản lưu tách đối tượng.
  const h = s.history[s.history.length - 1];
  if (h && h !== s.report && h.day === s.report.day) {
    h.reviews = s.report.reviews;
    h.repEnd = s.report.repEnd;
  }
  return r;
}

/** Gợi ý bấm để chèn (bé chưa biết viết gì vẫn làm được, sửa tự do). */
export function replyHints(stars: number): string[] {
  return stars >= 4
    ? ['Cảm ơn bạn nhiều nha! ', 'Quán rất vui vì bạn thích món! ', 'Hẹn gặp lại bạn nha! 🙏']
    : ['Xin lỗi bạn nha! ', 'Hôm đó quán đông khách quá. ', 'Lần sau quán sẽ cố gắng hơn. ', 'Mời bạn quay lại, quán tặng ly trà đá! '];
}

/** Câu Chú Tư lần đầu quán bị chê (có giọng đọc). */
export const REPLY_TIP = '💬 Có khách chê kìa! Kéo xuống ⭐ Đánh giá, bấm ✏️ Trả lời: xin lỗi, nói lý do, mời khách quay lại nha con!';

/** Hết ngày: lần đầu có đánh giá ≤ 3★ thì Chú Tư nhắc cách trả lời. */
export function queueReplyTip(s: GameState) {
  if (s.flags?.replyTip || !s.report.reviews.some((r) => r.stars <= 3)) return;
  s.flags = { ...(s.flags ?? {}), replyTip: s.day };
  s.chefQueue.push({ kind: 'news', text: REPLY_TIP });
}
