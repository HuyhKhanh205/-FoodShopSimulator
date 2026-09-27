import type { Customer, HairStyle, PlayerProfile, RecipeId, StaffRole } from '../../game/types';
import type { CharacterModel } from '../../three/models';

/** Ngoại hình nhân vật low-poly. */
export interface Look {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  apron?: string;
  hat?: 'chef' | 'helmet' | 'cap' | 'conical' | 'bandana';
  hatColor?: string;
  hairStyle?: HairStyle;
  glasses?: boolean;
  female?: boolean;
}

const SKINS = ['#F2C9A0', '#E0AC7E', '#C68A5E', '#F6D5B5', '#A86E47'];
const HAIRS = ['#2B1B12', '#3E2723', '#5D4037', '#1B1B1B', '#8D6E63', '#B0BEC5'];
const SHIRTS = ['#E57373', '#64B5F6', '#81C784', '#FFB74D', '#BA68C8', '#4DB6AC', '#F06292', '#A1887F', '#90A4AE', '#FFD54F'];
const PANTS = ['#37474F', '#3E4A6B', '#5D4037', '#263238', '#546E7A'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function customerLook(c: Customer, seat = 0): Look {
  const h = hash(c.id + ':' + seat);
  const female = ((h >> 13) & 1) === 1;
  const base: Look = {
    skin: SKINS[h % SKINS.length],
    hair: HAIRS[(h >> 3) % HAIRS.length],
    shirt: SHIRTS[(h >> 6) % SHIRTS.length],
    pants: PANTS[(h >> 10) % PANTS.length],
    female,
    hairStyle: female ? (((h >> 14) & 1) === 1 ? 'long' : 'bun') : (['short', 'spiky', 'short', 'bald'] as const)[(h >> 14) % 4],
    glasses: (h >> 17) % 6 === 0,
  };
  if (c.kind === 'delivery') return { ...base, shirt: '#43A047', hat: 'helmet', hatColor: '#2E7D32' };
  if (c.kind === 'group') return { ...base, shirt: '#ECEFF1', pants: '#263238', apron: '#37474F' };
  if (c.kind === 'regular') return { ...base, hat: 'cap', hatColor: '#FFB300' };
  return base;
}

const MODELS: CharacterModel[] = ['rogue', 'knight', 'mage', 'barbarian'];

/** Mô hình KayKit cho khách (cố định theo khách + ghế). */
export function customerModel(c: Customer, seat = 0): CharacterModel {
  return MODELS[hash(c.id + '#' + seat) % MODELS.length];
}

/** Mô hình KayKit cho nhân viên theo vị trí. */
export const STAFF_MODEL: Record<StaffRole, CharacterModel> = { cook: 'barbarian', prep: 'rogue', waiter: 'mage' };

/** Ngoại hình chủ quán theo nhân vật người chơi tự tạo. */
export function profileLook(p: PlayerProfile): Look {
  return {
    skin: p.skin,
    hair: p.hairColor,
    shirt: p.shirt,
    pants: p.pants,
    apron: p.apron,
    hat: p.hat === 'none' ? undefined : p.hat,
    hatColor: p.hatColor,
    hairStyle: p.hairStyle,
    glasses: p.glasses,
    female: p.gender === 'female',
  };
}

export function staffLook(role: StaffRole, id: string): Look {
  const h = hash(id);
  const skin = SKINS[h % SKINS.length];
  const hair = HAIRS[(h >> 3) % HAIRS.length];
  if (role === 'cook') return { skin, hair, shirt: '#FAFAFA', pants: '#424242', apron: '#ECEFF1', hat: 'chef', hatColor: '#FFFFFF' };
  if (role === 'prep') return { skin, hair, shirt: '#A5D6A7', pants: '#37474F', apron: '#2E7D32', hat: 'cap', hatColor: '#2E7D32' };
  return { skin, hair, shirt: '#FFFFFF', pants: '#212121', apron: '#212121' };
}

/** Màu thức ăn trên đĩa/nồi theo món. */
export const FOOD_COLOR: Record<RecipeId, string> = {
  banh_mi_trung: '#D9A25F',
  pho_bo: '#F3DFB6',
  com_ga: '#FFF6DA',
  tra_da: '#B87333',
  bun_cha: '#B8643D',
  goi_cuon: '#E8F5E9',
  ca_phe_sua: '#5D4037',
};
