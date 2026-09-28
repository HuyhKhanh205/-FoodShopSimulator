import { INGREDIENTS, LEVEL_XP, RECIPES, RECIPE_IDS } from './data';
import { HELP } from './help';
import type { HelpTopic } from './help';
import { STAGES, SUMMARY_FIRST_SAY } from './dayflow';
import { TUTORIAL, noteText } from './tutorial';
import type { ChefNote, StaffRole, TrendSource } from './types';

/**
 * Lời Chú Tư đọc: câu hiển thị → câu để đọc (emoji nguyên liệu / món đổi thành chữ, emoji khác bỏ đi).
 * Dùng làm khoá tra giọng thu sẵn (`src/assets/voice.generated.ts`) và làm câu cho giọng máy khi không có sẵn.
 */
const EMOJI_WORD = new Map<string, string>();
for (const i of Object.values(INGREDIENTS)) if (!EMOJI_WORD.has(i.emoji)) EMOJI_WORD.set(i.emoji, i.name.toLowerCase());
for (const id of RECIPE_IDS) if (!EMOJI_WORD.has(RECIPES[id].emoji)) EMOJI_WORD.set(RECIPES[id].emoji, RECIPES[id].name.toLowerCase());

export function speechText(text: string): string {
  // Emoji ghép (👨‍🍳...) bỏ hẳn, kẻo đọc nhầm phần 🍳 bên trong.
  // Hình đầu câu (biểu tượng của bước hướng dẫn / tin mới) không đọc.
  let t = text.replace(/^\s*(\p{Extended_Pictographic}|\p{Emoji_Presentation})[\uFE0F\u200D\p{Extended_Pictographic}]*\s*/u, '').replace(/\d\uFE0F?\u20E3/gu, ' ').replace(/có 🔪/g, 'có dao').replace(/\p{Extended_Pictographic}\uFE0F?(\u200D\p{Extended_Pictographic}\uFE0F?)+/gu, ' ');
  // Emoji có tên (nguyên liệu, món): đọc thành chữ, trừ khi ngay trước / sau đã ghi tên đó ("🥪 Bánh mì trứng", "Hành 🧅").
  const MARK = '\u0001';
  for (const [emoji, word] of EMOJI_WORD) {
    const parts = word.split(' ');
    const first = parts[0];
    const last = parts[parts.length - 1];
    t = t.split(emoji).reduce((acc, part, i) => {
      if (i === 0) return part;
      const next = part.trimStart().toLowerCase();
      const prev = acc.trimEnd().toLowerCase();
      const named = next.startsWith(word) || next.startsWith(first + ' ') || next.startsWith(last + ' ') || prev.endsWith(first);
      return acc + (named ? ' ' : `${MARK}${word}${MARK}`) + part;
    });
  }
  return t
    .replace(/\u0001\s*\+?\s*\u0001/g, ', ') // danh sách emoji → "bánh mì, trứng, ..."
    .replace(/\u0001/g, ' ')
    .replace(/\s*=\s*/g, ' gồm ')
    .replace(/Bấm \+ /g, 'Bấm dấu cộng ')
    .replace(/bấm − /g, 'bấm dấu trừ ')
    .replace(/\+\s*(\d)/g, 'thêm $1')
    .replace(/\s*\+\s*/g, ', ')
    .replace(/\bTREND\b/g, 'trend')
    .replace(/[^\p{L}\p{N}\s.,!?%:;()—–-]/gu, ' ')
    .replace(/\s+([.,!?%])/g, '$1')
    .replace(/([.,!?])(?=[.,!?])/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.]+/, '')
    .trim();
}

/** Câu bảng hướng dẫn ❗ đọc khi bấm 🔊 Đọc. */
export function helpSpeech(topic: HelpTopic, more: boolean): string {
  const h = HELP[topic];
  const steps = more && h.more ? [...h.steps, ...h.more] : h.steps;
  return `${h.title}. ${steps.map((s) => s.text).join(' ')}`;
}

/** Mọi câu cố định Chú Tư có thể đọc — để sinh giọng thu sẵn (`scripts/gen-voice.py`). */
export function voiceLines(): string[] {
  const lines: string[] = [];
  for (const st of TUTORIAL) lines.push(st.say);
  for (const topic of Object.keys(HELP) as HelpTopic[]) {
    const h = HELP[topic];
    for (const s of [...h.steps, ...(h.more ?? [])]) lines.push(`${s.icon} ${s.text}`);
    lines.push(helpSpeech(topic, false));
    if (h.more) lines.push(helpSpeech(topic, true));
  }
  const notes: ChefNote[] = [{ kind: 'lab' }, { kind: 'notebook' }, { kind: 'autoClaim' }, { kind: 'unlock', key: 'day2' }, { kind: 'unlock', key: 'day3' }];
  for (let lv = 2; lv <= LEVEL_XP.length; lv += 1) notes.push({ kind: 'levelUp', level: lv });
  for (const role of ['prep', 'cook', 'waiter'] as StaffRole[]) notes.push({ kind: 'role', role });
  for (const id of RECIPE_IDS) {
    notes.push({ kind: 'newDish', recipeId: id });
    for (const source of ['viral', 'reviewer', 'launch'] as TrendSource[]) notes.push({ kind: 'trend', recipeId: id, source });
  }
  for (const n of notes) lines.push(noteText(n));
  for (const st of STAGES) lines.push(st.say);
  lines.push(SUMMARY_FIRST_SAY);
  return [...new Set(lines.map(speechText))].filter(Boolean);
}
