import type { Expense } from '@/domain/financial';
import {
  createSettlement, sameSettlementIntent, validateOperationTime, validateSettlementJournal,
  type Settlement, type SettlementRequest,
} from '@/domain/settlement';

import { financialResult, moneyToCents } from './money';
import { computeBalances, computeExpenseTotals, computeSettlements } from './split';

export type FinancialLedger = { expenses: Expense[]; settlements: Settlement[] };
export type FinancialLedgerState = FinancialLedger & { error: string | null };

export function registerSettlement(
  ledger: FinancialLedger, request: SettlementRequest, participantIds: string[],
): FinancialLedger {
  const operations = validateSettlementJournal(ledger.settlements, participantIds);
  const candidate = createSettlement(request, participantIds);
  const previous = operations.find((operation) => operation.requestId === request.requestId);
  // Check retries BEFORE outstanding debt: a successful first attempt may have cleared it.
  if (previous) {
    if (!sameSettlementIntent(previous, candidate)) throw new Error('Этот запрос уже использован для другого перевода');
    return ledger; // A retry of a cancelled operation must not reactivate it either.
  }
  if (operations.some((operation) => operation.id === candidate.id)) throw new Error('ID перевода уже существует');

  const balances = computeBalances(ledger.expenses, participantIds, operations);
  const sender = moneyToCents(balances[candidate.fromId], { allowZero: true, allowNegative: true });
  const recipient = moneyToCents(balances[candidate.toId], { allowZero: true, allowNegative: true });
  if (sender >= 0 || recipient <= 0) throw new Error('Выберите участника с долгом и участника с суммой к получению');
  if (candidate.amountMinor > Math.min(-sender, recipient)) {
    throw new Error('Сумма перевода превышает текущий долг или сумму к получению');
  }
  const next = { ...ledger, settlements: [...operations, candidate] };
  computeSettlements(computeBalances(next.expenses, participantIds, next.settlements));
  return next;
}

export function cancelSettlement(
  ledger: FinancialLedger, id: string, cancelledAt: string, participantIds: string[],
): FinancialLedger {
  const operations = validateSettlementJournal(ledger.settlements, participantIds);
  const original = operations.find((operation) => operation.id === id);
  if (!original) throw new Error('Перевод не найден');
  if (original.status === 'cancelled') return ledger;
  validateOperationTime(cancelledAt);
  const cancelled: Settlement = { ...original, status: 'cancelled', cancelledAt };
  const next = { ...ledger, settlements: operations.map((operation) => operation.id === id ? cancelled : operation) };
  computeSettlements(computeBalances(next.expenses, participantIds, next.settlements));
  return next;
}

export type LedgerAction = (
  { type: 'register-settlement'; request: SettlementRequest }
  | { type: 'cancel-settlement'; id: string; cancelledAt: string }
  | { type: 'add-expense'; expense: Expense }
) & { displayRate: number };

/** Pure atomic transitions: queued clicks always validate against the latest ledger. */
export function reduceFinancialLedger(
  state: FinancialLedgerState, action: LedgerAction, participantIds: string[],
): FinancialLedgerState {
  const result = financialResult(() => {
    let next: FinancialLedger;
    switch (action.type) {
      case 'register-settlement': next = registerSettlement(state, action.request, participantIds); break;
      case 'cancel-settlement': next = cancelSettlement(state, action.id, action.cancelledAt, participantIds); break;
      case 'add-expense': next = { ...state, expenses: [...state.expenses, action.expense] }; break;
    }
    computeExpenseTotals(next.expenses, participantIds, action.displayRate, next.settlements);
    return next;
  });
  if (result.error !== null) return { ...state, error: result.error };
  return result.value === state && state.error === null ? state : { ...result.value, error: null };
}
