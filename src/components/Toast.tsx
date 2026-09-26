import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGame } from '../game/GameContext';

export default function Toast() {
  const { toast } = useGame();
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Text style={styles.text}>{toast.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(62,39,35,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '90%',
  },
  text: { color: '#fff', fontWeight: '600' },
});
