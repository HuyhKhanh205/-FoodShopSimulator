export type IngredientId =
  | 'banh_mi'
  | 'trung'
  | 'pate'
  | 'thit_bo'
  | 'banh_pho'
  | 'ga'
  | 'gao'
  | 'hanh'
  | 'rau'
  | 'tra'
  | 'da'
  | 'thit_heo'
  | 'bun'
  | 'banh_trang'
  | 'tom'
  | 'ca_phe'
  | 'sua';

export interface Ingredient {
  id: IngredientId;
  name: string;
  emoji: string;
  basePrice: number;
  /** Số ngày dùng được kể cả ngày mua (1 = chỉ dùng trong ngày). */
  shelfLife: number;
  /** Phải sơ chế (thái, ướp, nhặt) trước khi nấu. */
  needsPrep: boolean;
  /** Đồ tươi sống — tủ lạnh giúp để lâu hơn. */
  perishable: boolean;
  /** Nhóm để sự kiện tăng giá chọn trúng (vd: thịt). */
  group: 'meat' | 'veg' | 'dry' | 'bread';
}

export type BaseRecipeId =
  | 'banh_mi_trung'
  | 'pho_bo'
  | 'com_ga'
  | 'tra_da'
  | 'bun_cha'
  | 'goi_cuon'
  | 'ca_phe_sua'
  | 'banh_mi_pate'
  | 'com_chien_trung'
  | 'banh_mi_bo'
  | 'tra_sua'
  | 'com_tam'
  | 'banh_mi_thit'
  | 'com_chien_tom';
/** Mã món: món chuẩn (BaseRecipeId) hoặc món sinh từ tổ hợp nguyên liệu (`x_...`). */
export type RecipeId = string;
/** Loại món: chuẩn / lạ (hợp lý) / quái dị. */
export type DishKind = 'chuan' | 'la' | 'quai_di';

export type Station = 'stove' | 'counter';

export interface Recipe {
  id: RecipeId;
  name: string;
  emoji: string;
  price: number;
  ingredients: Partial<Record<IngredientId, number>>;
  station: Station;
  cookTime: number;
  /** Đồ uống: khách hay gọi kèm. */
  drink: boolean;
  /** Có thể bị cháy nếu để quá lâu trên bếp. */
  burns: boolean;
  /** Nguyên liệu rắc thêm, khách dị ứng dặn bỏ. */
  garnish?: IngredientId;
  /** Loại món (không có = chuẩn). */
  kind?: DishKind;
  /** Màu thức ăn (món sinh ra). */
  color?: string;
}

/** Lời đầu bếp dẫn đường đang chờ nói (lên cấp, món mới...). */
export type ChefNote =
  | { kind: 'levelUp'; level: number }
  | { kind: 'newDish'; recipeId: RecipeId }
  | { kind: 'lab' }
  | { kind: 'trend'; recipeId: RecipeId; source: TrendSource }
  | { kind: 'role'; role: StaffRole }
  | { kind: 'notebook' }
  | { kind: 'autoClaim' };

export type MissionKind = 'buy' | 'prep' | 'cook' | 'serve' | 'special' | 'newDish' | 'noLost' | 'profit' | 'stars';
export type MissionTier = 'easy' | 'medium' | 'hard';

/** Nhiệm vụ trong ngày (sổ tay chủ quán). Tiến độ tính từ báo cáo / bộ đếm, không lưu riêng. */
export interface Mission {
  id: string;
  kind: MissionKind;
  tier: MissionTier;
  target: number;
  ingredientId?: IngredientId;
  recipeId?: RecipeId;
  reward: { money: number; tickets: number; stars: number };
  claimed: boolean;
}

/** Bộ đếm trong ngày cho nhiệm vụ (reset mỗi sáng). */
export interface DayTally {
  prepped: number;
  cooked: number;
  newDishes: number;
  specialServed: number;
  fiveStars: number;
}

export type DiaryMood = '😄' | '🙂' | '😐' | '😢' | '😡';

/** Một trang nhật ký (chỉ lưu trên máy người chơi). */
export interface DiaryEntry {
  day: number;
  mood: DiaryMood;
  text: string;
  summary: string;
  stickers?: string[];
}

export type TrendSource = 'viral' | 'reviewer' | 'launch';

/** Món đang hot: tác dụng giảm dần trong 3 ngày. */
export interface Trend {
  recipeId: RecipeId;
  /** Thời điểm bắt đầu tính bằng "ngày" (day + elapsed / DAY_MS). */
  start: number;
  source: TrendSource;
}

export interface StockBatch {
  ingredientId: IngredientId;
  qty: number;
  /** Ngày cuối cùng còn dùng được. */
  expiresOnDay: number;
}

export type StaffRole = 'cook' | 'prep' | 'waiter';

export type StaffTrait = 'fast_sloppy' | 'slow_careful' | 'late' | 'charming' | 'lazy' | 'steady';

export type StaffTaskKind = 'prep' | 'serve' | 'clean' | 'cook_start' | 'fallen';

export interface StaffTask {
  kind: StaffTaskKind;
  endsAt: number;
  ingredientId?: IngredientId;
  qty?: number;
  dishId?: string;
  customerId?: string;
  recipeId?: RecipeId;
  noGarnish?: boolean;
  slotId?: string;
  /** Lỗi đã được "định sẵn" khi bắt đầu việc. */
  error?: StaffErrorKind;
}

export type StaffErrorKind = 'wrong_recipe' | 'burn' | 'forgot_note' | 'wrong_table' | 'waste' | 'spill' | 'trip';

/** Sự cố của phục vụ (để vẽ hoạt ảnh): vấp té, đổ thức ăn lên khách, mang nhầm bàn. */
export interface Incident {
  id: string;
  kind: 'trip' | 'spill' | 'wrong';
  staffId: string;
  customerId?: string;
  /** Bàn nơi xảy ra sự cố (không có = cửa). */
  tableIndex?: number;
  /** Mã món (để vẽ đĩa bay). */
  dish: string;
  at: number;
}

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  skill: number;
  speed: number;
  wage: number;
  mood: number;
  trait: StaffTrait;
  exp: number;
  daysWorked: number;
  absent: boolean;
  lateUntil: number;
  task: StaffTask | null;
  /** Sinh viên làm thêm: lương rẻ, dễ làm sai, vụng về. */
  student?: boolean;
}

export type CustomerKind =
  | 'normal'
  | 'picky'
  | 'reviewer'
  | 'allergic'
  | 'regular'
  | 'delivery'
  | 'dasher'
  | 'group';

export interface OrderItem {
  recipeId: RecipeId;
  noGarnish: boolean;
  served: boolean;
  quality: number;
}

export interface Customer {
  id: string;
  name: string;
  emoji: string;
  kind: CustomerKind;
  /** Số người trong bàn. */
  size: number;
  /** Bàn đang ngồi; không có = đứng chờ ở cửa (shipper, đoàn công ty). */
  tableIndex?: number;
  items: OrderItem[];
  patience: number;
  maxPatience: number;
  arrivedAt: number;
  /** Câu đang nói (bong bóng trò chuyện), hết hạn lúc `until` (ms trong ngày). */
  chat?: { text: string; icon: string; until: number };
  /** Câu đang hỏi chủ quán (id trong QUESTIONS), hết hạn lúc `until`. */
  question?: { id: string; until: number };
  /** Đã hỏi chủ quán rồi (mỗi khách tối đa 1 câu). */
  asked?: boolean;
  /** Hệ số boa thêm nhờ trò chuyện vui vẻ. */
  tipBonus?: number;
}

export type DishQuality = 'perfect' | 'raw' | 'burnt';

export interface Dish {
  id: string;
  recipeId: RecipeId;
  quality: DishQuality;
  noGarnish: boolean;
  by: string;
}

export interface CookJob {
  recipeId: RecipeId;
  noGarnish: boolean;
  progress: number;
  cookTime: number;
  /** 'player' hoặc id nhân viên. */
  by: string;
  /** Nhân viên sẽ để cháy món này. */
  burnError?: boolean;
  /** Món khách thực sự gọi (khi nhân viên nấu nhầm). */
  intendedRecipe?: RecipeId;
}

export interface CookSlot {
  id: string;
  station: Station;
  job: CookJob | null;
}

export interface PrepJob {
  ingredientId: IngredientId;
  qty: number;
  endsAt: number;
}

export interface LogEntry {
  id: number;
  t: number;
  text: string;
  tone: 'good' | 'bad' | 'info';
}

export interface Review {
  name: string;
  stars: number;
  text: string;
}

export interface DayReport {
  day: number;
  /** Khách phàn nàn món quái dị. */
  complaints?: number;
  /** Nhân viên vấp té / đổ thức ăn lên khách. */
  trips?: number;
  spills?: number;
  revenue: number;
  tips: number;
  ingredientCost: number;
  wages: number;
  rent: number;
  utilities: number;
  fines: number;
  otherCosts: number;
  served: number;
  lost: number;
  noSeat: number;
  wrongDishes: number;
  burnt: number;
  staffErrors: number;
  allergic: number;
  dashers: number;
  spoiledValue: number;
  repStart: number;
  repEnd: number;
  reviews: Review[];
  notes: string[];
}

export interface Upgrades {
  stoves: number;
  counters: number;
  seats: number;
  fridge: number;
  aircon: number;
  sign: number;
}

export interface DayModifiers {
  spawnMult: number;
  deliveryMult: number;
  priceMult: Partial<Record<IngredientId, number>>;
  unavailable: IngredientId[];
  sellPriceMult: number;
  labels: string[];
}

export interface ActiveEvent {
  defId: string;
  ctx: Record<string, string | number>;
}

/** Trạng thái trong giờ mở cửa — không lưu xuống máy. */
export interface DayRuntime {
  elapsed: number;
  /** Sự cố đang diễn ra (hoạt ảnh). */
  incidents?: Incident[];
  /** Thời gian kể từ khách gần nhất — tránh quán vắng quá lâu. */
  sinceLastCustomer: number;
  customers: Customer[];
  slots: CookSlot[];
  pass: Dish[];
  /** Id các món chủ quán đang cầm trên tay (vẫn nằm trong `pass`). */
  carrying: string[];
  prepped: Partial<Record<IngredientId, number>>;
  playerPrep: PrepJob | null;
  cleanReadyAt: number;
  powerOutUntil: number;
  gasOutUntil: number;
  eventsFired: string[];
  nextEventCheck: number;
  log: LogEntry[];
  /** Chủ quán đang đi chợ giữa giờ bán. */
  ownerAway: boolean;
  /** Đã báo "treo biển tạm đóng" trong lần đi chợ này. */
  closedNoticeShown: boolean;
}

export type Phase = 'market' | 'open' | 'summary';

export type GameOver = null | 'bankrupt' | 'debt';

export type Gender = 'male' | 'female';
export type HairStyle = 'short' | 'spiky' | 'long' | 'bun' | 'bald';
export type HatKind = 'none' | 'chef' | 'cap' | 'conical' | 'bandana';

/** Nhân vật chủ quán do người chơi tự tạo. */
/** Kiểu nhân vật: 4 mô hình KayKit có hoạt ảnh, hoặc nhân vật tự tạo (đổi màu tự do). */
export type ProfileModel = 'custom' | 'rogue' | 'knight' | 'mage' | 'barbarian';

export interface PlayerProfile {
  model: ProfileModel;
  name: string;
  shopName: string;
  gender: Gender;
  hairStyle: HairStyle;
  hairColor: string;
  skin: string;
  shirt: string;
  apron: string;
  pants: string;
  hat: HatKind;
  hatColor: string;
  glasses: boolean;
}

export interface GameState {
  version: 1;
  profile: PlayerProfile;
  phase: Phase;
  day: number;
  money: number;
  debt: number;
  debtDueDay: number;
  debtPaidOnDay: number | null;
  reputation: number;
  cleanliness: number;
  stock: StockBatch[];
  /** Đồ đã mua hôm nay (để bớt lại nếu mua dư). */
  boughtToday?: Partial<Record<IngredientId, { qty: number; cost: number; expiresOnDay: number }>>;
  prices: Record<IngredientId, number>;
  staff: Staff[];
  candidates: Staff[];
  upgrades: Upgrades;
  unlockedRecipes: RecipeId[];
  /** Điểm kinh nghiệm: phục vụ khách để lên cấp, mở khoá nguyên liệu mới. */
  xp: number;
  /** Lời đầu bếp chờ nói. */
  chefQueue: ChefNote[];
  /** Hướng dẫn từng bước ngày đầu. */
  tutorial: { step: number; done: boolean };
  /** Số lần thử món sai liên tiếp (để lộ gợi ý). */
  labFails: number;
  /** Gợi ý đã lộ: số nguyên liệu đã lộ của từng món bí ẩn. */
  labHints: Partial<Record<RecipeId, number>>;
  /** Món sinh từ tổ hợp đã tạo (lưu lại để nạp vào RECIPES). */
  dishes: Record<RecipeId, Recipe>;
  /** Món đã khám phá (sổ món). Menu = unlockedRecipes. */
  discovered: RecipeId[];
  /** Ngày món được thêm vào menu (khách gọi nhiều hơn ngày bán đầu tiên). */
  launched: Record<RecipeId, number>;
  /** Món đang trend. */
  trend: Trend | null;
  /** Người bán ở chợ: thân thiết, lượt trả giá (lưu cùng bản lưu, trên máy người chơi). */
  vendors: Record<'thit' | 'bot' | 'rau' | 'nuoc', { friendship: number; haggles: number; haggleRate: number }>;
  /** 🎟️ Vé thưởng (sau này mua nội thất). */
  tickets: number;
  /** ⭐ Sao hy vọng (từ nhiệm vụ khó; sau này dùng vòng quay). */
  hopeStars: number;
  /** Nhiệm vụ hôm nay + món đặc biệt. */
  missions: { day: number; special: RecipeId | null; list: Mission[] };
  /** Bộ đếm trong ngày cho nhiệm vụ. */
  today: DayTally;
  /** Nhật ký chủ quán (mới nhất ở cuối). */
  diary: DiaryEntry[];
  mods: DayModifiers;
  report: DayReport;
  history: DayReport[];
  activeEvent: ActiveEvent | null;
  gameOver: GameOver;
  idSeq: number;
  run: DayRuntime | null;
}

export type Rng = () => number;
