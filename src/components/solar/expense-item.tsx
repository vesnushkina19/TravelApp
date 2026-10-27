import { StyleSheet, Text, View } from 'react-native';

import { Solar, SolarSpace } from '@/constants/solar';
import { ExpenseCategories, formatDay, type Expense } from '@/data/demo/georgia-trip';

import { CurrencyAmount } from './currency-amount';
import { SolarText } from './solar-text';

type Props = {
  expense: Expense;
  payerName: string;
};

export function ExpenseItem({ expense, payerName }: Props) {
  const category = ExpenseCategories[expense.category];
  const people = expense.splitBetween.length;
  return (
    <View style={styles.row}>
      <View style={styles.icon} accessibilityLabel={category.label}>
        <Text style={styles.emoji}>{category.icon}</Text>
      </View>
      <View style={styles.text}>
        <SolarText variant="bodyStrong" numberOfLines={2}>
          {expense.title}
        </SolarText>
        <SolarText variant="caption" secondary>
          {category.label} · {formatDay(expense.date)}
        </SolarText>
        <SolarText variant="caption" secondary>
          Платит {payerName} ·{' '}
          {people === 1 ? 'личный расход' : `на ${people}${expense.manualShares ? ', вручную' : ', поровну'}`}
        </SolarText>
      </View>
      <View style={styles.amount}>
        <CurrencyAmount
          amount={expense.amount}
          currency={expense.currency}
          converted={{ amount: expense.amount * expense.rateRub, currency: 'RUB' }}
          align="right"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SolarSpace.m - 4,
    paddingVertical: SolarSpace.s + 2,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Solar.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  amount: {
    maxWidth: '38%',
  },
});
