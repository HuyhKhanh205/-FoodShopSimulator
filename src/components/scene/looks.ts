import { RECIPES } from '../../game/data';
import type { Customer, HairStyle, PlayerProfile, RecipeId, StaffRole } from '../../game/types';
import type { CharacterModel } from '../../three/models';

/** Ngoại hình nhân vật low-poly. */
export interface Look {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  apron?: string;
  /** Màu phụ (khăn, viền áo) cho nhân vật KayKit khi không có tạp dề. */
  accent?: string;
  hat?: 'chef' | 'helmet' | 'cap' | 'conical' | 'bandana';
  hatColor?: string;
  hairStyle?: HairStyle;
  glasses?: boolean;
  female?: boolean;
}

const SKINS = ['#F2C9A0', '#E0AC7E', '#C68A5E', '#F6D5B5', '#A86E47', '#FFDCC2'];
const HAIRS = ['#2B1B12', '#3E2723', '#5D4037', '#1B1B1B', '#8D6E63', '#B0BEC5', '#A0522D', '#D4A017', '#6D2E1F'];
/** Màu áo tươi cho khách — nhiều màu để quán nhộn nhịp. */
const SHIRTS = [
  '#E53935', '#FB8C00', '#FDD835', '#43A047', '#00ACC1', '#1E88E5', '#3949AB', '#8E24AA',
  '#D81B60', '#F06292', '#26A69A', '#7CB342', '#FF7043', '#5C6BC0', '#FFFFFF', '#FFCA28',
];
const ACCENTS = ['#FFFFFF', '#212121', '#FFEB3B', '#E53935', '#1E88E5', '#43A047', '#FF9800', '#EC407A'];
const PANTS = ['#37474F', '#3E4A6B', '#5D4037', '#263238', '#546E7A', '#1565C0', '#C8B08A', '#6D4C41', '#2E7D32', '#424242'];
const HAT_COLORS = ['#E53935', '#1E88E5', '#FDD835', '#43A047', '#FFFFFF', '#FF7043', '#8E24AA', '#212121'];

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
    accent: ACCENTS[(h >> 19) % ACCENTS.length],
  };
  // Khoảng 1/3 khách đội mũ lưỡi trai / nón lá / khăn.
  const hatRoll = (h >> 22) % 9;
  if (hatRoll < 3) {
    base.hat = (['cap', 'conical', 'bandana'] as const)[hatRoll];
    base.hatColor = hatRoll === 1 ? '#E6C98A' : HAT_COLORS[(h >> 25) % HAT_COLORS.length];
  }
  if (c.kind === 'delivery') return { ...base, shirt: '#43A047', accent: '#FFFFFF', hat: 'helmet', hatColor: '#2E7D32' };
  if (c.kind === 'group') return { ...base, shirt: '#ECEFF1', pants: '#263238', accent: '#1E88E5', hat: undefined };
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
  // Đồng phục theo vị trí: đầu bếp áo trắng khăn đỏ, phụ bếp áo xanh lá, phục vụ áo đỏ tạp dề đen.
  if (role === 'cook') return { skin, hair, shirt: '#FAFAFA', pants: '#263238', apron: '#E53935', hat: 'chef', hatColor: '#FFFFFF' };
  if (role === 'prep') return { skin, hair, shirt: '#43A047', pants: '#37474F', apron: '#FFEB3B', hat: 'cap', hatColor: '#2E7D32' };
  return { skin, hair, shirt: '#E53935', pants: '#212121', apron: '#212121' };
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
  banh_mi_pate: '#C98F4E',
  com_chien_trung: '#F2C94C',
  banh_mi_bo: '#9C5B3C',
  tra_sua: '#D7B899',
  com_tam: '#E8B27A',
  banh_mi_thit: '#C77B5A',
  com_chien_tom: '#F4A261',
};

/** Màu thức ăn của món (món sinh từ tổ hợp dùng màu tự tính). */
export function foodColor(id: RecipeId): string {
  return FOOD_COLOR[id] ?? RECIPES[id]?.color ?? '#BCAAA4';
}
