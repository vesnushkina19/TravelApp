import { StyleSheet, Text, View } from 'react-native';

import { Solar, SolarSpace } from '@/constants/solar';
import type { VisaCategory } from '@/data/countries';
import { formatMoney } from '@/utils/money';

import { AppCard } from './app-card';
import { DemoTag } from './demo-notice';
import { PhotoPlaceholder } from './photo-placeholder';
import { SolarText } from './solar-text';
import { VisaPill } from './visa-pill';

type Props = {
  name: string;
  flag: string;
  /** 1–5 */
  seasonScore: number;
  seasonLabel: string;
  budgetRub: number;
  budgetCaption: string;
  overBudget?: boolean;
  visa: VisaCategory;
  reason: string;
};

export function CountryCard({
  name,
  flag,
  seasonScore,
  seasonLabel,
  budgetRub,
  budgetCaption,
  overBudget,
  visa,
  reason,
}: Props) {
  return (
    <AppCard padded={false}>
      <PhotoPlaceholder emoji={flag} height={120} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <SolarText variant="heading" numberOfLines={2} style={styles.title}>
            {name}
          </SolarText>
          <Text style={styles.flag}>{flag}</Text>
        </View>

        <View style={styles.row} accessibilityLabel={`Сезон: ${seasonLabel}, ${seasonScore} из 5`}>
          <View style={styles.dots}>
            {[1, 2, 3, 4, 5].map((n) => (
              <View
                key={n}
                style={[styles.dot, { backgroundColor: n <= seasonScore ? Solar.orange : Solar.sky }]}
              />
            ))}
          </View>
          <SolarText variant="captionStrong">{seasonLabel}</SolarText>
        </View>

        <View style={styles.row}>
          <SolarText variant="bodyStrong">≈ {formatMoney(budgetRub, 'RUB')}</SolarText>
          <SolarText variant="caption" secondary>
            {budgetCaption}
          </SolarText>
          <DemoTag />
        </View>
        {overBudget && (
          <SolarText variant="caption" secondary>
            Выше указанного бюджета
          </SolarText>
        )}

        <View style={styles.row}>
          <VisaPill category={visa} />
          <DemoTag />
        </View>

        <SolarText variant="caption" secondary>
          {reason}
        </SolarText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: SolarSpace.m,
    gap: SolarSpace.s,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SolarSpace.s,
  },
  title: {
    flex: 1,
  },
  flag: {
    fontSize: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SolarSpace.s,
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
