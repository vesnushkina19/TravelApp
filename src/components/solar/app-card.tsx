import { StyleSheet, View, type ViewProps } from 'react-native';

import { Solar, SolarRadius, SolarSpace } from '@/constants/solar';

type Props = ViewProps & {
  tone?: 'white' | 'sky' | 'navy';
  padded?: boolean;
};

const tones = { white: Solar.white, sky: Solar.sky, navy: Solar.navy };

export function AppCard({ tone = 'white', padded = true, style, ...rest }: Props) {
  return (
    <View
      style={[styles.card, { backgroundColor: tones[tone] }, padded && styles.padded, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: SolarRadius.card,
    overflow: 'hidden',
  },
  padded: {
    padding: SolarSpace.m,
    gap: SolarSpace.s,
  },
});
