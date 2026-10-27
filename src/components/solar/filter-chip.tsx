import { Pressable, StyleSheet } from 'react-native';

import { Solar, SolarRadius, SolarSize, SolarSpace } from '@/constants/solar';

import { SolarText } from './solar-text';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

/** Чип фильтра: выбранный — Sky с оранжевой обводкой, обычный — белый. */
export function FilterChip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.selected : styles.idle]}>
      <SolarText variant={selected ? 'captionStrong' : 'caption'} numberOfLines={1}>
        {label}
      </SolarText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: SolarSize.touch,
    paddingHorizontal: SolarSpace.m - 4,
    borderRadius: SolarRadius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: {
    backgroundColor: Solar.white,
    borderColor: Solar.navyLine,
  },
  selected: {
    backgroundColor: Solar.sky,
    borderColor: Solar.orange,
  },
});
