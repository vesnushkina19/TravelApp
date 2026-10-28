import { moneyFromCents, parseRate } from '@/utils/money';
import { expenseSharesCents } from '@/utils/split';

import { ExpenseCategories } from './financial';
import { validateOperationTime, validateSettlementJournal } from './settlement';
import type { Expense, SolarState, Trip } from './solar-trip';
import { getTripView, toFinancialExpense } from './trip-finance';
import { StopKindIcons } from './travel';

function invalid(path: string): never { throw new Error(`Некорректные данные Solar: ${path}`); }
function record(value: unknown, keys: string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(path);
  if (Object.keys(value).some((key) => !keys.includes(key))) return invalid(`${path}: неизвестное поле`);
  return value as Record<string, unknown>;
}
function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) return invalid(path);
  return value;
}
function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) return invalid(path);
  return value;
}
function date(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
    || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) return invalid(path);
  return value;
}
function minor(value: unknown, positive: boolean, path: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (positive ? 1 : 0)) return invalid(path);
  moneyFromCents(value);
}

export function validateSolarState(value: unknown): SolarState {
  const state = record(value, ['schemaVersion', 'activeTripId', 'trips'], 'состояние');
  // Future versions must be handled by an explicit migration, never by demo fallback.
  if (state.schemaVersion !== 1) throw new Error('Версия данных Solar не поддерживается. Требуется явная миграция.');
  const activeId = text(state.activeTripId, 'активная поездка');
  const trips = list(state.trips, 'поездки');
  if (!trips.length) invalid('нет поездок');
  const ids = new Set<string>();
  const requestIds = new Set<string>();
  const id = (value: unknown) => {
    const result = text(value, 'ID');
    if (ids.has(result)) invalid('повторяющийся ID');
    ids.add(result);
    return result;
  };
  for (const item of trips) {
    const t = record(item, ['id', 'title', 'countryCode', 'countryName', 'flag', 'startDate', 'endDate', 'budgetMinorRub',
      'currency', 'isDemo', 'participants', 'days', 'expenses', 'settlements', 'exchangeRates', 'currentRateId'], 'поездка');
    id(t.id);
    for (const field of ['title', 'countryName', 'flag']) text(t[field], field);
    if (typeof t.countryCode !== 'string' || !/^[A-Z]{2}$/.test(t.countryCode)) invalid('код страны');
    const start = date(t.startDate, 'начало поездки');
    const end = date(t.endDate, 'конец поездки');
    if (start > end) invalid('порядок дат поездки');
    minor(t.budgetMinorRub, true, 'бюджет');
    if (t.currency !== 'GEL' || typeof t.isDemo !== 'boolean') invalid('валюта или признак демо');
    const participants = list(t.participants, 'участники');
    if (!participants.length) invalid('нет участников');
    const participantIds = participants.map((item) => {
      const p = record(item, ['id', 'name', 'role', 'isMe'], 'участник');
      const participantId = id(p.id);
      text(p.name, 'имя');
      if (!['organizer', 'member'].includes(String(p.role)) || typeof p.role !== 'string'
        || (p.isMe !== undefined && typeof p.isMe !== 'boolean')) invalid('роль участника');
      return participantId;
    });
    const rates = list(t.exchangeRates, 'курсы');
    const rateIds = new Set<string>();
    for (const item of rates) {
      const r = record(item, ['id', 'currency', 'quoteCurrency', 'rateRub', 'source', 'effectiveDate', 'obtainedAt'], 'курс');
      rateIds.add(id(r.id));
      if (r.currency !== 'GEL' || r.quoteCurrency !== 'RUB' || typeof r.rateRub !== 'number'
        || (r.source !== 'manual' && r.source !== 'demo')) invalid('курс');
      parseRate(r.rateRub);
      date(r.effectiveDate, 'дата курса');
      validateOperationTime(text(r.obtainedAt, 'время получения курса'));
    }
    if (!rateIds.has(text(t.currentRateId, 'ID текущего курса'))) invalid('текущий курс отсутствует');
    const days = list(t.days, 'дни');
    if (!days.length) invalid('нет дней маршрута');
    let previousDate = '';
    for (const item of days) {
      const d = record(item, ['id', 'date', 'stops'], 'день');
      id(d.id);
      const dayDate = date(d.date, 'дата дня');
      if (dayDate < start || dayDate > end || dayDate <= previousDate) invalid('порядок дней');
      previousDate = dayDate;
      for (const item of list(d.stops, 'остановки')) {
        const s = record(item, ['id', 'time', 'title', 'kind', 'duration', 'note'], 'остановка');
        id(s.id);
        for (const field of ['time', 'title', 'duration']) text(s[field], field);
        if (typeof s.kind !== 'string' || !Object.hasOwn(StopKindIcons, s.kind)
          || (s.note !== undefined && typeof s.note !== 'string')) invalid('тип остановки или заметка');
      }
    }
    for (const item of list(t.expenses, 'расходы')) {
      const e = record(item, ['id', 'title', 'category', 'amountMinor', 'currency', 'paidById', 'splitMode', 'shares', 'exchangeRateId', 'date'], 'расход');
      id(e.id);
      text(e.title, 'название расхода');
      minor(e.amountMinor, true, 'сумма расхода');
      if (e.currency !== 'GEL' || typeof e.category !== 'string' || !Object.hasOwn(ExpenseCategories, e.category)
        || (e.splitMode !== 'equal' && e.splitMode !== 'manual')) invalid('категория, валюта или распределение');
      if (!participantIds.includes(text(e.paidById, 'плательщик'))) invalid('плательщик отсутствует');
      if (!rateIds.has(text(e.exchangeRateId, 'курс расхода'))) invalid('курс расхода отсутствует');
      const expenseDate = date(e.date, 'дата расхода');
      if (expenseDate < start || expenseDate > end) invalid('дата расхода вне поездки');
      const shares = list(e.shares, 'доли');
      if (!shares.length) invalid('нет долей');
      const selected = new Set<string>();
      let sum = 0n;
      for (const item of shares) {
        const share = record(item, ['id', 'participantId', 'amountMinor'], 'доля');
        id(share.id);
        const participantId = text(share.participantId, 'участник доли');
        if (!participantIds.includes(participantId) || selected.has(participantId)) invalid('участник доли');
        selected.add(participantId);
        minor(share.amountMinor, false, 'сумма доли');
        sum += BigInt(share.amountMinor as number);
      }
      if (sum !== BigInt(e.amountMinor as number)) invalid('сумма долей');
      const expected = expenseSharesCents(toFinancialExpense(e as Expense, t as Trip), participantIds);
      for (const item of shares) {
        const share = item as { participantId: string; amountMinor: number };
        if (expected[share.participantId] !== share.amountMinor) invalid('распределение остатка');
      }
    }
    for (const item of list(t.settlements, 'переводы')) {
      const p = record(item, ['id', 'requestId', 'fromId', 'toId', 'amountMinor', 'currency', 'occurredAt', 'status', 'cancelledAt'], 'перевод');
      id(p.id);
      const requestId = text(p.requestId, 'ID запроса');
      if (requestIds.has(requestId)) invalid('повторяющийся requestId');
      requestIds.add(requestId);
    }
    validateSettlementJournal((t as Trip).settlements, participantIds);
    getTripView(t as Trip); // Checked aggregate totals, conversions, balances and settlement suggestions.
  }
  if (!trips.some((trip) => (trip as Trip).id === activeId)) invalid('активная поездка отсутствует');
  return state as SolarState;
}

const trustedSnapshots = new WeakSet<object>();
/** Clone untrusted input while sharing previously frozen nodes and their stable selectors. */
export function immutableSolarState(input: unknown): SolarState {
  const clone = (value: unknown): unknown => {
    if (value && typeof value === 'object') {
      if (trustedSnapshots.has(value)) return value;
      if (Array.isArray(value)) return value.map(clone);
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    }
    return value;
  };
  const state = validateSolarState(clone(input));
  const freeze = (value: unknown) => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
      trustedSnapshots.add(value);
    }
  };
  freeze(state);
  return state;
}
