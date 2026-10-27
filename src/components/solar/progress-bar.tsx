import { StyleSheet, View } from 'react-native';

import { Solar, SolarRadius } from '@/constants/solar';

type Props = {
  /** 0..1, значения больше 1 обрезаются. */
  value: number;
  trackColor?: string;
};

export function ProgressBar({ value, trackColor = Solar.sky }: Props) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      style={[styles.track, { backgroundColor: trackColor }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}>
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: SolarRadius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Solar.orange,
    borderRadius: SolarRadius.pill,
  },
});
