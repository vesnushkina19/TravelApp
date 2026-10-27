import { StyleSheet, View } from 'react-native';

import { SolarRadius, SolarVisa } from '@/constants/solar';
import { VisaCategoryLabels, type VisaCategory } from '@/data/countries';

import { SolarText } from './solar-text';

/** Визовый статус в стиле Solar: светлая подложка + тёмный текст (читается лучше белого на янтарном). */
export function VisaPill({ category }: { category: VisaCategory }) {
  const { bg, fg } = SolarVisa[category];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <SolarText variant="captionStrong" color={fg} numberOfLines={1}>
        {VisaCategoryLabels[category]}
      </SolarText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: SolarRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
});
