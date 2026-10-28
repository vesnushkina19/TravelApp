/** Compatibility input for the tested financial engine; amounts are major-unit numbers. */
export type ExpenseCategory = 'food' | 'transport' | 'stay' | 'fun' | 'shopping' | 'other';

export const ExpenseCategories: Record<ExpenseCategory, { label: string; icon: string }> = {
  food: { label: 'Еда', icon: '🍽️' },
  transport: { label: 'Транспорт', icon: '🚕' },
  stay: { label: 'Проживание', icon: '🏨' },
  fun: { label: 'Развлечения', icon: '🎟️' },
  shopping: { label: 'Покупки', icon: '🛍️' },
  other: { label: 'Другое', icon: '📦' },
};

export type Expense = {
  id: string;
  title: string;
  category: ExpenseCategory;
  /** Исходная сумма в местной валюте. */
  amount: number;
  currency: 'GEL';
  /** Курс ₽ за 1 GEL на момент операции — сохраняется вместе с расходом. */
  rateRub: number;
  paidBy: string;
  splitBetween: string[];
  /** Ручное разделение: id участника → доля в GEL. Нет — поровну. */
  manualShares?: Record<string, number>;
  /** YYYY-MM-DD */
  date: string;
};
