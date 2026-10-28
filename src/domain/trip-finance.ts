import { moneyFromCents, moneyToCents } from '@/utils/money';
import { computeBalances, computeExpenseTotals, computeSettlements, createExpenseFinancials, expenseSharesCents } from '@/utils/split';
import { formatDay } from '@/utils/trip-dates';

import type { Expense as FinancialExpense } from './financial';
import type { Expense, Trip } from './solar-trip';

/** Compatibility boundary: keep the verified B1–B4 algorithms unchanged. */
export function toFinancialExpense(expense: Expense, trip: Trip): FinancialExpense {
  const rate = trip.exchangeRates.find((item) => item.id === expense.exchangeRateId);
  if (!rate) throw new Error('Не найден сохранённый курс расхода');
  return {
    id: expense.id, title: expense.title, category: expense.category, amount: moneyFromCents(expense.amountMinor),
    currency: expense.currency, rateRub: rate.rateRub, paidBy: expense.paidById, date: expense.date,
    splitBetween: expense.shares.map((share) => share.participantId),
    manualShares: expense.splitMode === 'manual'
      ? Object.fromEntries(expense.shares.map((share) => [share.participantId, moneyFromCents(share.amountMinor)])) : undefined,
  };
}

export function toStoredExpense(input: FinancialExpense, trip: Trip, exchangeRateId: string): Expense {
  const participantIds = trip.participants.map((person) => person.id);
  const financials = createExpenseFinancials(input, participantIds);
  const rate = trip.exchangeRates.find((item) => item.id === exchangeRateId);
  if (!rate || rate.rateRub !== financials.rateRub) throw new Error('Курс расхода не соответствует выбранному снимку');
  const shares = expenseSharesCents(financials, participantIds);
  return {
    id: input.id, title: input.title, category: input.category, amountMinor: moneyToCents(financials.amount),
    currency: 'GEL', paidById: financials.paidBy, date: input.date,
    splitMode: financials.manualShares === undefined ? 'equal' : 'manual', exchangeRateId,
    shares: financials.splitBetween.map((id) => ({ id: `${input.id}:share:${id}`, participantId: id, amountMinor: shares[id] })),
  };
}

const views = new WeakMap<Trip, ReturnType<typeof buildTripView>>();
function buildTripView(trip: Trip) {
  const currentRate = trip.exchangeRates.find((rate) => rate.id === trip.currentRateId);
  if (!currentRate) throw new Error('Не найден текущий курс поездки');
  const participantIds = trip.participants.map((person) => person.id);
  const ledger = { expenses: trip.expenses.map((expense) => toFinancialExpense(expense, trip)), settlements: trip.settlements, error: null };
  const totals = computeExpenseTotals(ledger.expenses, participantIds, currentRate.rateRub, ledger.settlements);
  const balances = computeBalances(ledger.expenses, participantIds, ledger.settlements);
  return {
    trip, ledger, participants: trip.participants, participantIds, days: trip.days,
    rate: { kind: currentRate.source, value: currentRate.rateRub, setAt: formatDay(currentRate.effectiveDate) },
    rateId: currentRate.id, budgetRub: moneyFromCents(trip.budgetMinorRub), ...totals, balances,
    recommendations: computeSettlements(balances),
    remainingRub: moneyFromCents(trip.budgetMinorRub - moneyToCents(totals.totalRub, { allowZero: true })),
  };
}

/** Shared, stable selector used by both screens, never a second source of state. */
export function getTripView(trip: Trip) {
  if (!Object.isFrozen(trip)) return buildTripView(trip);
  let view = views.get(trip);
  if (!view) { view = buildTripView(trip); views.set(trip, view); }
  return view;
}
