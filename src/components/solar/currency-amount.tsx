import { StyleSheet, View } from 'react-native';

import { formatMoney, type CurrencyCode } from '@/utils/money';

import { SolarText } from './solar-text';

type Props = {
  amount: number;
  currency: CurrencyCode;
  /** Сумма в валюте отображения (рублях) — показывается второй строкой. */
  converted?: { amount: number; currency: CurrencyCode };
  size?: 'large' | 'medium' | 'small';
  color?: string;
  align?: 'left' | 'right';
};

const fontSizes = { large: 32, medium: 17, small: 14 };

/** Сумма, которая не ломает вёрстку при больших числах: ужимается в одну строку. */
export function CurrencyAmount({ amount, currency, converted, size = 'medium', color, align = 'left' }: Props) {
  const textAlign = align;
  return (
    <View style={align === 'right' ? styles.right : undefined}>
      <SolarText
        variant="bodyStrong"
        color={color}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={{ fontSize: fontSizes[size], lineHeight: fontSizes[size] * 1.25, textAlign }}>
        {formatMoney(amount, currency)}
      </SolarText>
      {converted && (
        <SolarText
          variant="caption"
          secondary={!color}
          color={color}
          numberOfLines={1}
          style={[{ textAlign }, color ? styles.dim : undefined]}>
          ≈ {formatMoney(converted.amount, converted.currency)}
        </SolarText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  right: {
    alignItems: 'flex-end',
  },
  dim: {
    opacity: 0.8,
  },
});
