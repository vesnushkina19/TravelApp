import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Solar, SolarSpace } from '@/constants/solar';

import { SolarText } from './solar-text';

type Props = {
  /** Эмодзи-флаг или иконка в центре заглушки. */
  emoji: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Заглушка вместо фотографии направления. Когда появятся лицензированные фото,
 * заменим на expo-image с тем же размером.
 */
export function PhotoPlaceholder({ emoji, height = 140, style }: Props) {
  return (
    <View style={[styles.box, { height }, style]} accessibilityLabel="Место для фотографии">
      <View style={styles.sun} />
      <Text style={styles.emoji}>{emoji}</Text>
      <SolarText variant="caption" secondary style={styles.label}>
        фото
      </SolarText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: Solar.sky,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sun: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Solar.white,
    opacity: 0.5,
    top: -40,
    right: -30,
  },
  emoji: {
    fontSize: 48,
  },
  label: {
    position: 'absolute',
    bottom: SolarSpace.s,
    left: SolarSpace.m,
  },
});
