import type { Gender, HairStyle, HatKind, PlayerProfile, Rng } from './types';

export const SKIN_TONES = ['#F6D5B5', '#F2C9A0', '#E0AC7E', '#C68A5E', '#A86E47', '#7A4B2E'];
export const HAIR_COLORS = ['#1B1B1B', '#2B1B12', '#5D4037', '#8D6E63', '#C49A6C', '#B0BEC5', '#C62828', '#6A1B9A'];
export const CLOTH_COLORS = [
  '#FFF8F0', '#FFFFFF', '#212121', '#E65100', '#C62828', '#AD1457', '#6A1B9A',
  '#1565C0', '#00838F', '#2E7D32', '#9E9D24', '#F9A825', '#E6C98A', '#5D4037', '#546E7A',
];

export const HAIR_STYLES: { key: HairStyle; label: string }[] = [
  { key: 'short', label: 'Tóc ngắn' },
  { key: 'spiky', label: 'Tóc dựng' },
  { key: 'long', label: 'Tóc dài' },
  { key: 'bun', label: 'Búi tóc' },
  { key: 'bald', label: 'Đầu trọc' },
];

export const HATS: { key: HatKind; label: string }[] = [
  { key: 'chef', label: '👨‍🍳 Mũ đầu bếp' },
  { key: 'cap', label: '🧢 Mũ lưỡi trai' },
  { key: 'conical', label: '🎋 Nón lá' },
  { key: 'bandana', label: '🧣 Khăn trùm' },
  { key: 'none', label: '🚫 Không đội' },
];

export const GENDERS: { key: Gender; label: string }[] = [
  { key: 'male', label: '👨 Nam' },
  { key: 'female', label: '👩 Nữ' },
];

export const DEFAULT_PROFILE: PlayerProfile = {
  name: 'Chủ quán',
  shopName: 'Quán Ăn Của Tôi',
  gender: 'male',
  hairStyle: 'short',
  hairColor: '#2B1B12',
  skin: '#F2C9A0',
  shirt: '#FFF8F0',
  apron: '#E65100',
  pants: '#5D4037',
  hat: 'chef',
  hatColor: '#FFFFFF',
  glasses: false,
};

const pick = <T,>(rng: Rng, arr: readonly T[]) => arr[Math.floor(rng() * arr.length)];

/** Nhân vật ngẫu nhiên (giữ nguyên tên người và tên quán). */
export function randomProfile(rng: Rng, keep: PlayerProfile): PlayerProfile {
  const gender = pick(rng, GENDERS).key;
  return {
    ...keep,
    gender,
    hairStyle: pick(rng, gender === 'female' ? (['long', 'bun', 'short'] as HairStyle[]) : (['short', 'spiky', 'bald', 'long'] as HairStyle[])),
    hairColor: pick(rng, HAIR_COLORS),
    skin: pick(rng, SKIN_TONES),
    shirt: pick(rng, CLOTH_COLORS),
    apron: pick(rng, CLOTH_COLORS),
    pants: pick(rng, CLOTH_COLORS),
    hat: pick(rng, HATS).key,
    hatColor: pick(rng, CLOTH_COLORS),
    glasses: rng() < 0.3,
  };
}
