import { Platform } from 'react-native';
import { VOICE } from '../../assets/voice.generated';
import { speechText } from '../../game/voice';

/**
 * Giọng đọc của Chú Tư.
 * - Câu cố định (hướng dẫn, tin mới...): phát **giọng nam thu sẵn** (`VOICE`, sinh bởi scripts/gen-voice.py) qua Web Audio
 *   — không cần URL nên chạy được trong khung Artifact; `audioSession = 'playback'` để iPhone vẫn phát khi gạt im lặng.
 * - Câu khác (tên món tự sáng tạo...): giọng máy của trình duyệt, đọc trầm xuống cho gần giọng nam.
 */

/** Câu nhắc khi máy không phát ra tiếng (thường do iPhone đang bật chế độ im lặng). */
export const MUTED_HINT = '🔇 Không nghe thấy? Tắt chế độ im lặng (nút gạt bên hông iPhone) và tăng âm lượng.';

const RATE = 1.2;

type AC = AudioContext;
function audioCtor(): (new () => AC) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: new () => AC; webkitAudioContext?: new () => AC };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}
function hasSynth() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Máy đọc to được không (chỉ bản web). */
export function canSpeak() {
  return Platform.OS === 'web' && (Boolean(audioCtor()) || hasSynth());
}

// ---------- Giọng thu sẵn (Web Audio) ----------
let ctx: AC | null = null;
let current: AudioBufferSourceNode | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();

/** Tạo / đánh thức AudioContext — phải gọi ngay trong lần chạm để iOS cho phát tiếng. */
function audio(): AC | null {
  const Ctor = audioCtor();
  if (!Ctor) return null;
  try {
    if (!ctx) {
      try {
        // Safari 16.4+: phát như trình phát nhạc, không bị nút gạt im lặng tắt tiếng.
        const nav = navigator as unknown as { audioSession?: { type: string } };
        if (nav.audioSession) nav.audioSession.type = 'playback';
      } catch {
        // bỏ qua
      }
      ctx = new Ctor();
      // iOS: phát một mẫu im lặng ngay trong lần chạm để "mở khoá" âm thanh.
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, 22050);
      s.connect(ctx.destination);
      s.start(0);
    }
    if (ctx.state !== 'running') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function decode(ac: AC, key: string, b64: string): Promise<AudioBuffer> {
  let p = buffers.get(key);
  if (!p) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    // Dạng callback cho Safari cũ.
    p = new Promise<AudioBuffer>((resolve, reject) => {
      const r = ac.decodeAudioData(bytes.buffer, resolve, reject);
      if (r && typeof (r as Promise<AudioBuffer>).then === 'function') (r as Promise<AudioBuffer>).then(resolve, reject);
    });
    p.catch(() => buffers.delete(key));
    buffers.set(key, p);
  }
  return p;
}

// ---------- Giọng máy (dự phòng) ----------
let voice: { v: SpeechSynthesisVoice | null; male: boolean } | null = null;
const MALE = /nam|male|minh|an\b|khang|quang|tuấn|tuan/i;
function pickVoice() {
  const vi = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('vi'));
  const male = vi.find((v) => MALE.test(v.name));
  voice = { v: male ?? vi[0] ?? null, male: Boolean(male) };
}

/**
 * Giọng máy, viết cẩn thận cho Safari iPhone: chỉ `cancel()` khi đang đọc (gọi `speak` ngay sau `cancel`
 * thì iOS bỏ luôn câu mới), còn lại đọc ngay trong lần chạm.
 */
function synthSpeak(text: string, onFail?: () => void) {
  if (!hasSynth()) {
    onFail?.();
    return;
  }
  try {
    const synth = window.speechSynthesis;
    pickVoice();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN';
    u.rate = RATE;
    if (voice?.v && synth.getVoices().includes(voice.v)) u.voice = voice.v;
    // Không có giọng nam (vd iPhone chỉ có giọng nữ "Linh"): đọc trầm xuống.
    u.pitch = voice?.male ? 1 : 0.6;
    let started = false;
    let failed = false;
    const fail = () => {
      if (started || failed) return;
      failed = true;
      onFail?.();
    };
    u.onstart = () => {
      started = true;
    };
    u.onerror = (e) => {
      const err = (e as SpeechSynthesisErrorEvent).error;
      if (err !== 'interrupted' && err !== 'canceled') fail();
    };
    setTimeout(fail, 2500);
    const go = () => {
      synth.resume();
      synth.speak(u);
    };
    if (synth.speaking || synth.pending) {
      synth.cancel();
      setTimeout(go, 120);
    } else go();
  } catch {
    onFail?.();
  }
}

/** Dừng câu đang đọc. */
export function stopSpeaking() {
  try {
    current?.stop();
  } catch {
    // đã dừng
  }
  current = null;
  try {
    if (hasSynth() && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) window.speechSynthesis.cancel();
  } catch {
    // bỏ qua
  }
}

/**
 * Đọc to một câu (câu hiển thị, còn emoji cũng được). `onFail`: sau 2,5 giây vẫn chưa phát được tiếng.
 */
export function speak(text: string, onFail?: () => void) {
  if (Platform.OS !== 'web') return;
  const line = speechText(text);
  if (!line) return;
  const clip = VOICE[line];
  const ac = clip ? audio() : null;
  stopSpeaking();
  if (!clip || !ac) {
    synthSpeak(line, onFail);
    return;
  }
  let playing = false;
  const timer = setTimeout(() => {
    if (!playing || ac.state !== 'running') onFail?.();
  }, 2500);
  decode(ac, line, clip)
    .then((buf) => {
      const s = ac.createBufferSource();
      s.buffer = buf;
      s.connect(ac.destination);
      s.onended = () => {
        if (current === s) current = null;
      };
      s.start(0);
      current = s;
      playing = true;
    })
    .catch(() => {
      clearTimeout(timer);
      synthSpeak(line, onFail);
    });
}
