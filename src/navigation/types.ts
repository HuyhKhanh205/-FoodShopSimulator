export type RootStackParamList = {
  Home: undefined;
  Game: undefined;
  Staff: undefined;
  Upgrades: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
