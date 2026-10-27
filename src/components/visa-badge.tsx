import { StyleSheet, Text, View } from 'react-native';

import { Spacing, VisaColors } from '@/constants/theme';
import { VisaCategoryLabels, type VisaCategory } from '@/data/countries';

export function VisaBadge({ category }: { category: VisaCategory }) {
  return (
    <View style={[styles.badge, { backgroundColor: VisaColors[category] }]}>
      <Text style={styles.text}>{VisaCategoryLabels[category]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
  },
  text: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
  },
});
