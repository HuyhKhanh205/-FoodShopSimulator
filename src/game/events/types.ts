import type { GameState, Rng } from '../types';

export type Ctx = Record<string, string | number>;

/** 13 kiểu mini game (src/components/minigame/MiniGame.tsx). */
export type MiniType = 'tap' | 'catch' | 'sequence' | 'timing' | 'pick' | 'whack' | 'balance' | 'memory' | 'slice' | 'stack' | 'spot' | 'quiz' | 'rhythm';

/** Thông số cho mini game (emoji, số lần cần đạt, câu hỏi…). */
export interface MiniParams {
  emoji?: string;
  need?: number;
  seconds?: number;
  prompt?: string;
  /** pick: các lựa chọn (hình) và chỉ số đúng. */
  options?: string[];
  answer?: number;
  /** catch: mục tiêu rơi từ trên xuống thay vì nhảy lung tung. */
  fall?: boolean;
}

export interface MiniSpec {
  type: MiniType;
  params?: MiniParams;
}

export interface EventChoice {
  label: string;
  /** `score` (0..1) có khi lựa chọn là một mini game. */
  apply: (s: GameState, ctx: Ctx, rng: Rng, score?: number) => void;
  enabled?: (s: GameState, ctx: Ctx) => boolean;
  /** Chọn cái này thì chơi mini game trước, điểm quyết định kết quả. */
  mini?: MiniSpec;
}

export interface EventDef {
  id: string;
  /** morning: đầu ngày ở chợ; day: ngẫu nhiên khi mở cửa; trigger: do hành động gây ra. */
  phase: 'morning' | 'day' | 'trigger';
  emoji: string;
  title: string;
  weight: number;
  /** Chỉ xuất hiện khi điều kiện đúng (vd có nhân viên, chưa có mèo). */
  when?: (s: GameState) => boolean;
  /** Chuẩn bị ngữ cảnh + áp dụng ảnh hưởng ban đầu; trả null nếu không phù hợp. */
  setup?: (s: GameState, rng: Rng) => Ctx | null;
  body: (ctx: Ctx, s: GameState) => string;
  choices: EventChoice[];
}
