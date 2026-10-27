export type CurrencyCode = 'GEL' | 'RUB';

const symbols: Record<CurrencyCode, string> = { GEL: '₾', RUB: '₽' };

/** 1234.5 GEL → «1 234,50 ₾», 40125.3 RUB → «40 125 ₽». */
export function formatMoney(amount: number, currency: CurrencyCode) {
  const digits = currency === 'RUB' ? 0 : 2;
  const value = amount.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${value} ${symbols[currency]}`;
}

/** Парсит ввод пользователя: «1 234,5» → 1234.5. NaN если не число. */
export function parseAmount(input: string) {
  const normalized = input.replace(/\s/g, '').replace(',', '.');
  return normalized === '' ? NaN : Number(normalized);
}

/** Округление до копеек/тетри, чтобы не копить ошибки float. */
export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** Локальный id для записей прототипа (без сервера). */
export function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
