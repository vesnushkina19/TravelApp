import type { Expense } from '@/data/demo/georgia-trip';

const toCents = (value: number) => Math.round(value * 100);

/**
 * Доли участников в расходе, в сотых долях валюты (тетри/копейки).
 * Остаток от деления раздаётся по одной копейке первым участникам,
 * поэтому сумма долей всегда равна сумме расхода.
 */
export function expenseSharesCents(expense: Expense): Record<string, number> {
  if (expense.manualShares) {
    return Object.fromEntries(
      Object.entries(expense.manualShares).map(([id, v]) => [id, toCents(v)]),
    );
  }
  const total = toCents(expense.amount);
  const n = expense.splitBetween.length;
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Object.fromEntries(expense.splitBetween.map((id, i) => [id, base + (i < remainder ? 1 : 0)]));
}

/** Баланс: > 0 — участнику должны, < 0 — участник должен. */
export function computeBalances(expenses: Expense[], participantIds: string[]) {
  const cents: Record<string, number> = Object.fromEntries(participantIds.map((id) => [id, 0]));
  for (const e of expenses) {
    cents[e.paidBy] = (cents[e.paidBy] ?? 0) + toCents(e.amount);
    for (const [id, share] of Object.entries(expenseSharesCents(e))) {
      cents[id] = (cents[id] ?? 0) - share;
    }
  }
  return Object.fromEntries(Object.entries(cents).map(([id, c]) => [id, c / 100]));
}

export type Settlement = { from: string; to: string; amount: number };

/** Минимальный набор переводов «кто кому должен» (жадный алгоритм). */
export function computeSettlements(balances: Record<string, number>): Settlement[] {
  // Считаем в копейках, чтобы не было расхождений на 0,01
  const debtors = Object.entries(balances)
    .filter(([, v]) => toCents(v) < 0)
    .map(([id, v]) => ({ id, left: -toCents(v) }));
  const creditors = Object.entries(balances)
    .filter(([, v]) => toCents(v) > 0)
    .map(([id, v]) => ({ id, left: toCents(v) }));

  const result: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    result.push({ from: debtors[i].id, to: creditors[j].id, amount: amount / 100 });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (debtors[i].left === 0) i++;
    if (creditors[j].left === 0) j++;
  }
  return result;
}
