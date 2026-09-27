export type RootStackParamList = {
  Home: undefined;
  Game: undefined;
  Staff: undefined;
  Upgrades: undefined;
  /** first = vừa bấm Chơi mới: lưu xong thì vào game. */
  Character: { first?: boolean } | undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
