import { Animated, GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import { MAP_COLS, MAP_ROWS, PASS_ROW } from '../../game/layout';
import type { MapLayout, MapStation, Tile } from '../../game/layout';
import { staffTarget } from '../../game/staffTarget';
import type { GameState } from '../../game/types';
import { AvatarSprite, StaffSprite, StationView, TableView, WaitingAtDoor } from './MapPieces';

/** Bản đồ 2D nhìn từ trên xuống — dùng khi thiết bị không hỗ trợ WebGL. */
export default function Map2D({
  game,
  layout,
  width,
  height,
  anim,
  hereId,
  walkingTo,
  wanted,
  onTapTile,
  onStation,
}: {
  game: GameState;
  layout: MapLayout;
  width: number;
  height: number;
  anim: Animated.ValueXY;
  hereId: string | null;
  walkingTo: string | null;
  wanted: Set<string>;
  onTapTile: (t: Tile) => void;
  onStation: (st: MapStation) => void;
}) {
  const run = game.run!;
  const tile = Math.max(22, Math.floor(Math.min((width - 16) / MAP_COLS, (height - 16) / MAP_ROWS)));
  const carried = run.carrying.map((id) => run.pass.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => Boolean(d));
  const doorCustomers = run.customers.filter((c) => c.tableIndex === undefined);

  const onFloorPress = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    onTapTile({ x: Math.floor(locationX / tile), y: Math.floor(locationY / tile) });
  };

  return (
    <View style={{ width: tile * MAP_COLS, height: tile * MAP_ROWS, alignSelf: 'center', marginTop: 8 }}>
      <View style={[StyleSheet.absoluteFill, styles.floor]} onStartShouldSetResponder={() => true} onResponderRelease={onFloorPress}>
        <View pointerEvents="none" style={[styles.zone, { top: 0, height: tile, backgroundColor: '#6D4C41' }]} />
        <View pointerEvents="none" style={[styles.zone, { top: tile, height: tile * (PASS_ROW - 1), backgroundColor: '#CFD8DC' }]} />
        <View pointerEvents="none" style={[styles.zone, { top: tile * PASS_ROW, height: tile, backgroundColor: '#ECEFF1' }]} />
        <View
          pointerEvents="none"
          style={[styles.zone, { top: tile * (PASS_ROW + 1), height: tile * (MAP_ROWS - PASS_ROW - 1), backgroundColor: '#F3DDB8' }]}
        />
        <Text pointerEvents="none" style={[styles.zoneLabel, { top: tile * 0.25, left: tile * 0.2 }]}>
          BẾP
        </Text>
      </View>

      {layout.stations.map((st) =>
        st.kind === 'table' ? (
          <TableView
            key={st.id}
            station={st}
            tile={tile}
            customer={run.customers.find((c) => c.tableIndex === st.tableIndex)}
            highlight={hereId === st.id || walkingTo === st.id}
            wanted={wanted.has(st.id)}
            onPress={() => onStation(st)}
          />
        ) : (
          <StationView
            key={st.id}
            station={st}
            game={game}
            tile={tile}
            highlight={hereId === st.id || walkingTo === st.id || (st.kind === 'door' && wanted.has('door'))}
            onPress={() => onStation(st)}
          />
        )
      )}

      <WaitingAtDoor customers={doorCustomers} tile={tile} onPress={() => onStation(layout.stations.find((s) => s.id === 'door')!)} />

      {game.staff.map((st) => {
        const to = staffTarget(st, game, layout);
        return to ? <StaffSprite key={st.id} staff={st} to={to} tile={tile} /> : null;
      })}
      <AvatarSprite pos={anim} tile={tile} carrying={carried} />
    </View>
  );
}

const styles = StyleSheet.create({
  floor: { borderRadius: 8, overflow: 'hidden', borderWidth: 3, borderColor: '#5D4037' },
  zone: { position: 'absolute', left: 0, right: 0 },
  zoneLabel: { position: 'absolute', fontSize: 10, fontWeight: '900', color: '#fff', opacity: 0.8 },
});
