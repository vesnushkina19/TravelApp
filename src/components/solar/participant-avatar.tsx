import { StyleSheet, View } from 'react-native';

import { Solar } from '@/constants/solar';

import { SolarText } from './solar-text';

const tones = [
  { bg: Solar.orange, fg: Solar.navy },
  { bg: Solar.navy, fg: Solar.white },
  { bg: Solar.sky, fg: Solar.navy },
];

type Props = {
  name: string;
  /** Индекс участника — определяет цвет, чтобы у каждого был свой. */
  index: number;
  size?: number;
  /** Белая обводка — для наложения аватаров друг на друга. */
  outlined?: boolean;
};

export function ParticipantAvatar({ name, index, size = 44, outlined }: Props) {
  const tone = tones[index % tones.length];
  return (
    <View
      accessibilityLabel={name}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.bg },
        outlined && styles.outlined,
      ]}>
      <SolarText variant="bodyStrong" color={tone.fg} style={{ fontSize: size * 0.4 }}>
        {name.trim().charAt(0).toUpperCase()}
      </SolarText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlined: {
    borderWidth: 2,
    borderColor: Solar.white,
  },
});
