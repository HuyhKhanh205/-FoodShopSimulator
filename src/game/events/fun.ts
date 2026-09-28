import { BIG_DECISIONS } from './big-decisions';
import { FUNNY_GUESTS } from './funny-guests';
import { FUNNY_MARKET } from './funny-market';
import { FUNNY_NATURE } from './funny-nature';
import { FUNNY_SOCIAL } from './funny-social';
import { FUNNY_STAFF } from './funny-staff';
import { FUNNY_STREET } from './funny-street';
import { MINI_EVENTS } from './mini-events';
import { SERIOUS } from './serious';
import type { EventDef } from './types';

/** Mọi tình huống mới (A–H + sự kiện mini game) — trộn chung một kho với tình huống cũ. */
export const FUN_EVENTS: EventDef[] = [
  ...FUNNY_GUESTS,
  ...FUNNY_STAFF,
  ...FUNNY_NATURE,
  ...FUNNY_STREET,
  ...FUNNY_MARKET,
  ...FUNNY_SOCIAL,
  ...BIG_DECISIONS,
  ...SERIOUS,
  ...MINI_EVENTS,
];
