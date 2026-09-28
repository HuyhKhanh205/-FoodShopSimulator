export type RootStackParamList = {
  Home: undefined;
  Game: undefined;
  Staff: undefined;
  Upgrades: undefined;
  /** from = 'home': chỉ sửa ngoại hình (tách khỏi bản lưu); không có = sửa trong game (cả tên). */
  Character: { from?: 'home' } | undefined;
  /** Chơi mới: đặt tên quán, tên chủ, chọn món đặc trưng. */
  NewGame: undefined;
  Settings: undefined;
  /** Sổ hướng dẫn bằng hình. */
  Guide: undefined;
  /** Bếp thử món: kết hợp nguyên liệu để tìm món mới. */
  Lab: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
