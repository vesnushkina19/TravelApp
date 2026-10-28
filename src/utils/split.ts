import type { Expense } from '@/data/demo/georgia-trip';
import { validateParticipantIds as uniqueIds, validateSettlementJournal, type Settlement } from '@/domain/settlement';

import { convertGelToRub, moneyFromCents, moneyToCents, parseRate, sumMoney } from './money';

type Financials = Pick<Expense, 'amount' | 'currency' | 'rateRub' | 'paidBy' | 'splitBetween' | 'manualShares'>;
type FinancialInput = Omit<Financials, 'amount' | 'rateRub' | 'manualShares'> & {
  amount: string | number;
  rateRub: string | number;
  manualShares?: Record<string, string | number>;
};

function normalize(input: FinancialInput, participantIds: string[]) {
  uniqueIds(participantIds, 'Участники');
  uniqueIds(input.splitBetween, 'Распределение');
  const known = new Set(participantIds);
  if (!known.has(input.paidBy)) throw new Error('Плательщик отсутствует в списке участников');
  if (input.splitBetween.some((id) => !known.has(id))) throw new Error('Выбран неизвестный участник');
  if (input.currency !== 'GEL') throw new Error('Расчёт поддерживает только GEL');

  const total = moneyToCents(input.amount);
  const amount = moneyFromCents(total);
  const rateRub = parseRate(input.rateRub);
  convertGelToRub(amount, rateRub);

  let shares: Record<string, number>;
  if (input.manualShares !== undefined) {
    const manual = input.manualShares;
    if (!manual || Object.keys(manual).length !== input.splitBetween.length
      || Object.keys(manual).some((id) => !input.splitBetween.includes(id))
      || input.splitBetween.some((id) => !Object.hasOwn(manual, id))) {
      throw new Error('Укажите доли только для всех выбранных участников');
    }
    shares = Object.fromEntries(input.splitBetween.map((id) => [
      id, moneyToCents(manual[id], { allowZero: true, label: `Доля участника ${id}` }),
    ]));
    if (Object.values(shares).reduce((sum, value) => sum + BigInt(value), 0n) !== BigInt(total)) {
      throw new Error('Сумма долей должна точно совпадать с суммой расхода');
    }
  } else {
    const n = BigInt(input.splitBetween.length);
    const base = Number(BigInt(total) / n);
    const remainder = Number(BigInt(total) % n);
    shares = Object.fromEntries(input.splitBetween.map((id, i) => [id, base + (i < remainder ? 1 : 0)]));
  }

  const financials: Financials = {
    amount, currency: 'GEL', rateRub, paidBy: input.paidBy, splitBetween: [...input.splitBetween],
    manualShares: input.manualShares === undefined ? undefined
      : Object.fromEntries(Object.entries(shares).map(([id, value]) => [id, moneyFromCents(value)])),
  };
  return { financials, shares, total };
}

/** Preserve the existing Expense shape; all validation happens before saving. */
export function createExpenseFinancials(input: FinancialInput, participantIds: string[]): Financials {
  return normalize(input, participantIds).financials;
}

/** Shares in integer tetri; the remainder goes to the first selected participants. */
export function expenseSharesCents(expense: Financials, participantIds: string[]): Record<string, number> {
  return normalize(expense, participantIds).shares;
}

/** > 0: receivable; < 0: payable. Arithmetic stays in integer tetri until output. */
export function computeBalances(expenses: Expense[], participantIds: string[], settlements: Settlement[] = []) {
  uniqueIds(participantIds, 'Участники');
  const cents = new Map(participantIds.map((id) => [id, 0n]));
  for (const expense of expenses) {
    const { total, shares } = normalize(expense, participantIds);
    cents.set(expense.paidBy, cents.get(expense.paidBy)! + BigInt(total));
    for (const [id, share] of Object.entries(shares)) cents.set(id, cents.get(id)! - BigInt(share));
  }
  for (const settlement of validateSettlementJournal(settlements, participantIds)) {
    if (settlement.status !== 'completed') continue;
    // Paying reduces the sender's payable and the recipient's receivable.
    const amount = BigInt(settlement.amountMinor);
    cents.set(settlement.fromId, cents.get(settlement.fromId)! + amount);
    cents.set(settlement.toId, cents.get(settlement.toId)! - amount);
  }
  return Object.fromEntries([...cents].map(([id, value]) => [id, moneyFromCents(value)]));
}

/** Also used before appending an expense or changing the current display rate. */
export function computeExpenseTotals(
  expenses: Expense[], participantIds: string[], displayRate: number, settlements: Settlement[] = [],
) {
  uniqueIds(participantIds, 'Участники');
  const financials = expenses.map((expense) => normalize(expense, participantIds).financials);
  const totalGel = sumMoney(financials.map((expense) => expense.amount));
  const totalRub = sumMoney(financials.map((expense) => convertGelToRub(expense.amount, expense.rateRub)));
  // Preserve the expense-total guard and check the actual outstanding transfers too.
  convertGelToRub(totalGel, displayRate);
  for (const settlement of computeSettlements(computeBalances(expenses, participantIds, settlements))) {
    convertGelToRub(settlement.amount, displayRate);
  }
  return { totalGel, totalRub };
}

export type SettlementSuggestion = { from: string; to: string; amount: number };

/** Greedy transfers for validated, conserved balances; no payment tracking here. */
export function computeSettlements(balances: Record<string, number>): SettlementSuggestion[] {
  const entries = Object.entries(balances).map(([id, value]) => [id, moneyToCents(value, {
    allowZero: true, allowNegative: true, label: 'Баланс',
  })] as const);
  if (entries.reduce((sum, [, value]) => sum + BigInt(value), 0n) !== 0n) {
    throw new Error('Сумма балансов должна равняться нулю');
  }
  const debtors = entries.filter(([, value]) => value < 0).map(([id, value]) => ({ id, left: -value }));
  const creditors = entries.filter(([, value]) => value > 0).map(([id, value]) => ({ id, left: value }));
  const result: SettlementSuggestion[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    result.push({ from: debtors[i].id, to: creditors[j].id, amount: moneyFromCents(amount) });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (debtors[i].left === 0) i++;
    if (creditors[j].left === 0) j++;
  }
  return result;
}
