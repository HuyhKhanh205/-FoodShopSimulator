import type { CustomerKind, Ingredient, IngredientId, Recipe, RecipeId, StaffRole, StaffTrait, Upgrades } from './types';

/** Một ngày bán hàng: 7 phút thật. */
export const DAY_MS = 420_000;
/**
 * Nhịp khách so với ngày 3 phút cũ: ngày dài gấp 3,3 nhưng số khách cả ngày chỉ khoảng 65% lúc trước
 * (ít bị hết chỗ hơn nên số khách phục vụ được tương đương) — khách tới thưa, dễ thở hơn.
 */
export const CUSTOMER_PACE = (180_000 / DAY_MS) * 0.65 * 1.2; // ×1.2: đông khách hơn 20%
export const OPEN_HOUR = 7;
export const CLOSE_HOUR = 21;

export const START_MONEY = 2_000_000;
export const START_DEBT = 10_000_000;
/** Hạn trả nợ: 30 ngày kinh doanh + 3 ngày làm quen. */
export const DEBT_DUE_DAY = 33;
export const BANKRUPT_AT = -1_000_000;
export const RENT_PER_DAY = 200_000;
export const UTILITY_PER_STOVE = 20_000;
export const UTILITY_AIRCON = 60_000;

export const PLAYER_PREP_MS = 2_500;
export const PREP_BATCH = 4;
export const CLEAN_COOLDOWN_MS = 4_000;
export const BURN_FACTOR = 1.8;
/** Chín rồi còn bao lâu mới cháy: ít nhất 8 giây để kịp lấy ra. */
export const burnGrace = (cookTime: number) => Math.max(8_000, cookTime * (BURN_FACTOR - 1));
/** Tiến độ lúc món cháy. */
export const burnAt = (cookTime: number) => cookTime + burnGrace(cookTime);

export const INGREDIENTS: Record<IngredientId, Ingredient> = {
  banh_mi: { id: 'banh_mi', name: 'Bánh mì', emoji: '🥖', basePrice: 2_500, shelfLife: 2, needsPrep: false, perishable: true, group: 'bread' },
  trung: { id: 'trung', name: 'Trứng', emoji: '🥚', basePrice: 3_000, shelfLife: 10, needsPrep: false, perishable: true, group: 'meat' },
  pate: { id: 'pate', name: 'Pate', emoji: '🥫', basePrice: 2_500, shelfLife: 5, needsPrep: false, perishable: true, group: 'meat' },
  thit_bo: { id: 'thit_bo', name: 'Thịt bò', emoji: '🥩', basePrice: 12_000, shelfLife: 2, needsPrep: true, perishable: true, group: 'meat' },
  banh_pho: { id: 'banh_pho', name: 'Bánh phở', emoji: '🍜', basePrice: 3_000, shelfLife: 2, needsPrep: false, perishable: true, group: 'bread' },
  ga: { id: 'ga', name: 'Thịt gà', emoji: '🍗', basePrice: 9_000, shelfLife: 2, needsPrep: true, perishable: true, group: 'meat' },
  gao: { id: 'gao', name: 'Gạo', emoji: '🍚', basePrice: 2_000, shelfLife: 60, needsPrep: false, perishable: false, group: 'dry' },
  hanh: { id: 'hanh', name: 'Hành lá', emoji: '🧅', basePrice: 1_000, shelfLife: 3, needsPrep: true, perishable: true, group: 'veg' },
  rau: { id: 'rau', name: 'Rau sống', emoji: '🥬', basePrice: 2_000, shelfLife: 2, needsPrep: true, perishable: true, group: 'veg' },
  tra: { id: 'tra', name: 'Trà', emoji: '🍵', basePrice: 800, shelfLife: 60, needsPrep: false, perishable: false, group: 'dry' },
  da: { id: 'da', name: 'Đá viên', emoji: '🧊', basePrice: 500, shelfLife: 1, needsPrep: false, perishable: false, group: 'dry' },
  thit_heo: { id: 'thit_heo', name: 'Thịt heo', emoji: '🥓', basePrice: 8_000, shelfLife: 2, needsPrep: true, perishable: true, group: 'meat' },
  bun: { id: 'bun', name: 'Bún', emoji: '🍝', basePrice: 2_500, shelfLife: 2, needsPrep: false, perishable: true, group: 'bread' },
  banh_trang: { id: 'banh_trang', name: 'Bánh tráng', emoji: '🫓', basePrice: 1_500, shelfLife: 60, needsPrep: false, perishable: false, group: 'dry' },
  tom: { id: 'tom', name: 'Tôm', emoji: '🦐', basePrice: 7_000, shelfLife: 2, needsPrep: true, perishable: true, group: 'meat' },
  ca_phe: { id: 'ca_phe', name: 'Cà phê', emoji: '🫘', basePrice: 3_000, shelfLife: 60, needsPrep: false, perishable: false, group: 'dry' },
  sua: { id: 'sua', name: 'Sữa đặc', emoji: '🥛', basePrice: 2_500, shelfLife: 20, needsPrep: false, perishable: false, group: 'dry' },
};

export const INGREDIENT_IDS = Object.keys(INGREDIENTS) as IngredientId[];

export const RECIPES: Record<RecipeId, Recipe> = {
  banh_mi_trung: {
    id: 'banh_mi_trung', name: 'Bánh mì trứng', emoji: '🥪', price: 25_000,
    ingredients: { banh_mi: 1, trung: 1, pate: 1, hanh: 1 },
    station: 'stove', cookTime: 4_000, drink: false, burns: true, garnish: 'hanh',
  },
  tra_da: {
    id: 'tra_da', name: 'Trà đá', emoji: '🧋', price: 5_000,
    ingredients: { tra: 1, da: 1 },
    station: 'counter', cookTime: 1_500, drink: true, burns: false,
  },
  banh_mi_pate: {
    id: 'banh_mi_pate', name: 'Bánh mì pate', emoji: '🥖', price: 15_000,
    ingredients: { banh_mi: 1, pate: 1 },
    station: 'counter', cookTime: 2_000, drink: false, burns: false,
  },
  com_ga: {
    id: 'com_ga', name: 'Cơm gà', emoji: '🍛', price: 40_000,
    ingredients: { gao: 1, ga: 1, hanh: 1 },
    station: 'stove', cookTime: 6_000, drink: false, burns: true, garnish: 'hanh',
  },
  com_chien_trung: {
    id: 'com_chien_trung', name: 'Cơm chiên trứng', emoji: '🍳', price: 30_000,
    ingredients: { gao: 1, trung: 1, hanh: 1 },
    station: 'stove', cookTime: 5_000, drink: false, burns: true, garnish: 'hanh',
  },
  pho_bo: {
    id: 'pho_bo', name: 'Phở bò', emoji: '🍜', price: 45_000,
    ingredients: { banh_pho: 1, thit_bo: 1, hanh: 1, rau: 1 },
    station: 'stove', cookTime: 7_000, drink: false, burns: true, garnish: 'hanh',
  },
  banh_mi_bo: {
    id: 'banh_mi_bo', name: 'Bánh mì bò', emoji: '🥙', price: 35_000,
    ingredients: { banh_mi: 1, thit_bo: 1, rau: 1 },
    station: 'stove', cookTime: 5_000, drink: false, burns: true,
  },
  ca_phe_sua: {
    id: 'ca_phe_sua', name: 'Cà phê sữa đá', emoji: '☕', price: 25_000,
    ingredients: { ca_phe: 1, sua: 1, da: 1 },
    station: 'counter', cookTime: 2_500, drink: true, burns: false,
  },
  tra_sua: {
    id: 'tra_sua', name: 'Trà sữa', emoji: '🥤', price: 20_000,
    ingredients: { tra: 1, sua: 1, da: 1 },
    station: 'counter', cookTime: 2_500, drink: true, burns: false,
  },
  bun_cha: {
    id: 'bun_cha', name: 'Bún chả', emoji: '🥢', price: 45_000,
    ingredients: { bun: 1, thit_heo: 1, rau: 1, hanh: 1 },
    station: 'stove', cookTime: 8_000, drink: false, burns: true, garnish: 'hanh',
  },
  com_tam: {
    id: 'com_tam', name: 'Cơm tấm', emoji: '🍱', price: 40_000,
    ingredients: { gao: 1, thit_heo: 1, trung: 1 },
    station: 'stove', cookTime: 7_000, drink: false, burns: true,
  },
  banh_mi_thit: {
    id: 'banh_mi_thit', name: 'Bánh mì thịt', emoji: '🌭', price: 30_000,
    ingredients: { banh_mi: 1, thit_heo: 1, pate: 1, rau: 1 },
    station: 'stove', cookTime: 5_000, drink: false, burns: true,
  },
  goi_cuon: {
    id: 'goi_cuon', name: 'Gỏi cuốn', emoji: '🌯', price: 35_000,
    ingredients: { banh_trang: 1, tom: 1, bun: 1, rau: 1 },
    station: 'counter', cookTime: 4_000, drink: false, burns: false,
  },
  com_chien_tom: {
    id: 'com_chien_tom', name: 'Cơm chiên tôm', emoji: '🍤', price: 45_000,
    ingredients: { gao: 1, tom: 1, trung: 1, hanh: 1 },
    station: 'stove', cookTime: 6_000, drink: false, burns: true, garnish: 'hanh',
  },
};

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];
export const START_RECIPES: RecipeId[] = ['banh_mi_trung', 'tra_da'];

/**
 * Món đặc trưng khởi đầu (chọn khi Chơi mới). Món nào cũng nấu trên bếp và có 🧅 cần thái,
 * nên hướng dẫn ngày đầu giữ nguyên các bước. `extra` = nguyên liệu mở sẵn (dù chưa tới cấp).
 */
export const STARTERS: { id: RecipeId; extra: IngredientId[]; buy: IngredientId; tag: string; blurb: string }[] = [
  { id: 'banh_mi_trung', extra: [], buy: 'trung', tag: 'Dễ nhất', blurb: 'Rẻ, nấu nhanh, khách nào cũng thích' },
  { id: 'com_chien_trung', extra: ['gao'], buy: 'gao', tag: 'Vừa sức', blurb: 'Giá bán cao hơn bánh mì một chút' },
  { id: 'com_ga', extra: ['gao', 'ga'], buy: 'ga', tag: 'Lãi cao', blurb: 'Bán đắt nhưng tốn vốn, nấu lâu hơn' },
];
export const starterOf = (id: RecipeId | undefined) => STARTERS.find((x) => x.id === id) ?? STARTERS[0];

/** Ngưỡng điểm kinh nghiệm của từng cấp (cấp 1 bắt đầu từ 0). */
export const LEVEL_XP = [0, 60, 160, 320, 540, 820];
export const MAX_LEVEL = LEVEL_XP.length;

/** Nguyên liệu mở khoá theo cấp. */
export const INGREDIENT_TIER: Record<IngredientId, number> = {
  banh_mi: 1,
  trung: 1,
  pate: 1,
  hanh: 1,
  tra: 1,
  da: 1,
  gao: 2,
  ga: 2,
  banh_pho: 3,
  thit_bo: 3,
  rau: 3,
  ca_phe: 4,
  sua: 4,
  bun: 5,
  thit_heo: 5,
  banh_trang: 6,
  tom: 6,
};

/** Cấp cần để làm được món (cấp cao nhất trong các nguyên liệu). */
export function recipeLevel(id: RecipeId): number {
  return Math.max(...(Object.keys(RECIPES[id].ingredients) as IngredientId[]).map((i) => INGREDIENT_TIER[i]));
}

export interface UpgradeDef {
  key: keyof Upgrades;
  name: string;
  emoji: string;
  describe: (level: number) => string;
  /** Giá trị từng cấp; costs[i] là giá để lên từ levels[i] tới levels[i + 1]. */
  levels: number[];
  costs: number[];
}

export const UPGRADES: UpgradeDef[] = [
  { key: 'stoves', name: 'Thêm bếp', emoji: '🔥', levels: [2, 3, 4], costs: [1_500_000, 3_000_000], describe: (l) => `${l} bếp nấu (mỗi bếp +${UTILITY_PER_STOVE / 1000}k tiền gas/ngày)` },
  { key: 'counters', name: 'Quầy pha chế', emoji: '🥤', levels: [1, 2], costs: [800_000], describe: (l) => `${l} chỗ pha nước / cuốn gỏi` },
  { key: 'seats', name: 'Bàn ghế', emoji: '🪑', levels: [4, 5, 6, 8, 10], costs: [500_000, 800_000, 1_500_000, 3_000_000], describe: (l) => `${l} chỗ ngồi` },
  { key: 'fridge', name: 'Tủ lạnh', emoji: '🧊', levels: [0, 1, 2], costs: [1_200_000, 2_500_000], describe: (l) => (l ? `Đồ tươi để thêm ${l} ngày · kho +${l * 150} chỗ` : 'Chưa có tủ lạnh · kho 300 chỗ') },
  { key: 'aircon', name: 'Máy lạnh', emoji: '❄️', levels: [0, 1], costs: [2_500_000], describe: (l) => (l ? 'Khách kiên nhẫn hơn 20%' : 'Quán nóng nực') },
  { key: 'sign', name: 'Biển hiệu', emoji: '🪧', levels: [0, 1, 2], costs: [800_000, 2_000_000], describe: (l) => `Thêm ${l * 15}% khách` },
];

export const START_UPGRADES: Upgrades = { stoves: 2, counters: 1, seats: 4, fridge: 0, aircon: 0, sign: 0 };

export const CUSTOMER_EMOJI = ['👨', '👩', '🧑', '👴', '👵', '👦', '👧', '🧔', '👱', '👨‍💼', '👩‍💼', '👷', '🧑‍🎓'];

export const FIRST_NAMES = [
  'An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hạnh', 'Hòa', 'Hùng', 'Huy', 'Khánh', 'Lan', 'Linh',
  'Long', 'Mai', 'Minh', 'Nam', 'Nga', 'Ngọc', 'Phong', 'Phúc', 'Quân', 'Sơn', 'Tâm', 'Thảo', 'Trang', 'Tú', 'Tuấn', 'Vy',
];

export const REGULARS = [
  { name: 'Chú Bảy xe ôm', favorite: 'com_ga' as RecipeId },
  { name: 'Cô Tư bán vé số', favorite: 'banh_mi_trung' as RecipeId },
  { name: 'Anh Tùng văn phòng', favorite: 'pho_bo' as RecipeId },
  { name: 'Bà Sáu tổ trưởng', favorite: 'pho_bo' as RecipeId },
];

export const KIND_LABEL: Record<CustomerKind, string> = {
  normal: '',
  picky: 'Khó tính',
  reviewer: '',
  allergic: 'Dị ứng hành',
  regular: 'Khách quen',
  delivery: 'Shipper',
  dasher: '',
  group: 'Đoàn công ty',
};

export const ROLE_LABEL: Record<StaffRole, string> = {
  cook: 'Đầu bếp',
  prep: 'Phụ bếp',
  waiter: 'Phục vụ',
};

export const ROLE_EMOJI: Record<StaffRole, string> = {
  cook: '👨‍🍳',
  prep: '🔪',
  waiter: '🧑‍💼',
};

export const TRAITS: Record<StaffTrait, { name: string; desc: string; speed: number; error: number }> = {
  fast_sloppy: { name: 'Nhanh nhưng ẩu', desc: 'Làm nhanh, hay sai', speed: 1.3, error: 1.6 },
  slow_careful: { name: 'Chậm mà chắc', desc: 'Chậm nhưng ít sai', speed: 0.8, error: 0.5 },
  late: { name: 'Hay đi trễ', desc: 'Thường đến muộn 30 giây đầu ngày', speed: 1, error: 1 },
  charming: { name: 'Khéo miệng', desc: 'Khách vui, tip thêm 30%', speed: 1, error: 1 },
  lazy: { name: 'Lười', desc: 'Chậm, dễ chán việc', speed: 0.85, error: 1.1 },
  steady: { name: 'Bình thường', desc: 'Không có gì đặc biệt', speed: 1, error: 1 },
};

/** Tỉ lệ làm sai gốc của từng vị trí khi tay nghề = 0. */
export const BASE_ERROR: Record<StaffRole, number> = { cook: 0.3, prep: 0.22, waiter: 0.22 };

export const REVIEW_TEXTS: Record<number, string[]> = {
  1: ['Tệ hết chỗ nói!', 'Không bao giờ quay lại.', 'Chờ mòn mỏi, đồ ăn thì dở.', 'Phục vụ quá tệ.'],
  2: ['Hơi thất vọng.', 'Đồ ăn chưa ngon lắm.', 'Chờ hơi lâu.', 'Tạm được thôi.'],
  3: ['Bình thường.', 'Ăn được.', 'Giá ổn, vị ổn.', 'Cũng tạm.'],
  4: ['Ngon, sẽ quay lại!', 'Phục vụ nhanh.', 'Đáng tiền.', 'Quán dễ thương.'],
  5: ['Tuyệt vời! 10 điểm!', 'Ngon nhất khu này!', 'Nhanh, ngon, sạch sẽ.', 'Sẽ giới thiệu bạn bè!'],
};
