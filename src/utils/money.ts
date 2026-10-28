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

type DecimalInput = string | number;

const MAX_UNITS = BigInt(Number.MAX_SAFE_INTEGER);
export const RATE_DECIMALS = 8;
const RATE_SCALE = 100_000_000n;

/** Numeric values may stringify with an exponent; user-entered exponents are never accepted. */
function decimalText(value: DecimalInput, label: string) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${label}: требуется конечное число`);
    const [coefficient, exponent] = String(value).split('e');
    if (exponent === undefined) return coefficient;
    const sign = coefficient.startsWith('-') ? '-' : '';
    const [whole, fraction = ''] = coefficient.replace('-', '').split('.');
    const digits = whole + fraction;
    const point = whole.length + Number(exponent);
    return sign + (point <= 0
      ? `0.${'0'.repeat(-point)}${digits}`
      : digits.padEnd(point, '0').slice(0, point) + (point < digits.length ? `.${digits.slice(point)}` : ''));
  }
  if (typeof value !== 'string') throw new Error(`${label}: введите число`);
  const text = value.trim().replace(/[\u00a0\u202f]/g, ' ');
  if (!/^-?(?:\d+|\d{1,3}(?: \d{3})+)(?:[.,]\d+)?$/.test(text)) {
    throw new Error(`${label}: введите десятичное число без экспоненты`);
  }
  return text.replace(/ /g, '').replace(',', '.');
}

function scaledInteger(value: DecimalInput, precision: number, label: string): bigint {
  const text = decimalText(value, label);
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  if (fraction.length > precision) {
    throw new Error(`${label}: допускается не более ${precision} знаков после запятой`);
  }
  // Bound before constructing a BigInt from potentially very long pasted input.
  const digits = (whole + fraction.padEnd(precision, '0')).replace(/^0+/, '') || '0';
  if (digits.length > 16) throw new Error(`${label}: превышен безопасный диапазон`);
  const units = BigInt(digits) * (text.startsWith('-') ? -1n : 1n);
  if (units > MAX_UNITS || units < -MAX_UNITS) throw new Error(`${label}: превышен безопасный диапазон`);
  return units;
}

function fromScaled(units: bigint, precision: number, label: string): number {
  if (units > MAX_UNITS || units < -MAX_UNITS) throw new Error(`${label}: превышен безопасный диапазон`);
  const value = Number(units) / 10 ** precision;
  // Existing Expense records store major-unit numbers. Reject loss at that boundary.
  if (scaledInteger(value, precision, label) !== units) {
    throw new Error(`${label}: значение нельзя сохранить без потери точности`);
  }
  return value;
}

/** Exact GEL/RUB minor units. Excess precision is rejected, never rounded. */
export function moneyToCents(
  value: DecimalInput,
  { allowZero = false, allowNegative = false, label = 'Сумма' } = {},
): number {
  const cents = scaledInteger(value, 2, label);
  if ((!allowNegative && cents < 0n) || (!allowZero && cents === 0n)) {
    throw new Error(`${label}: ${allowZero ? 'должна быть неотрицательной' : 'должна быть больше нуля'}`);
  }
  fromScaled(cents, 2, label);
  return Number(cents);
}

export function moneyFromCents(cents: number | bigint): number {
  if (typeof cents === 'number' && !Number.isSafeInteger(cents)) {
    throw new Error('Сумма: требуется безопасное целое число минимальных единиц');
  }
  return fromScaled(BigInt(cents), 2, 'Сумма');
}

export function sumMoney(values: number[]): number {
  return moneyFromCents(values.reduce(
    (sum, value) => sum + BigInt(moneyToCents(value, { allowZero: true })), 0n,
  ));
}

/**
 * RUB per GEL, up to 8 decimal places, no rounding. Minimum: 0.00000001.
 * Maximum scaled integer: MAX_SAFE_INTEGER (about 90 million RUB/GEL).
 * The existing numeric storage must round-trip exactly; conversion has its own
 * safe-money bound. This is a prototype representation limit, not a currency rule.
 */
export function parseRate(value: DecimalInput): number {
  const units = scaledInteger(value, RATE_DECIMALS, 'Курс');
  if (units <= 0n) throw new Error('Курс должен быть больше нуля');
  return fromScaled(units, RATE_DECIMALS, 'Курс');
}

/** Exact fixed-point multiplication; RUB is rounded once, half up, to kopecks. */
export function convertGelToRub(amount: number, rate: number): number {
  const tetri = BigInt(moneyToCents(amount, { allowZero: true }));
  const units = scaledInteger(parseRate(rate), RATE_DECIMALS, 'Курс');
  const numerator = tetri * units;
  return moneyFromCents((numerator + RATE_SCALE / 2n) / RATE_SCALE);
}

/** UI previews and save handlers use the same throwing validators. */
export function financialResult<T>(calculate: () => T):
  { value: T; error: null } | { value: null; error: string } {
  try {
    return { value: calculate(), error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : 'Проверьте финансовые данные' };
  }
}

/** Локальный id для записей прототипа (без сервера). */
export function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
