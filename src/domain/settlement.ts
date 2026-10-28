import { moneyFromCents } from '@/utils/money';

/** A recorded transfer is independent of any computed settlement suggestion. */
export type SettlementRequest = Readonly<{
  id: string;
  requestId: string;
  fromId: string;
  toId: string;
  /** GEL minor units: 1 GEL = 100 tetri. */
  amountMinor: number;
  currency: 'GEL';
  /** Canonical ISO 8601 UTC timestamp, including milliseconds. */
  occurredAt: string;
}>;

export type Settlement = SettlementRequest & (
  { readonly status: 'completed'; readonly cancelledAt?: never }
  | { readonly status: 'cancelled'; readonly cancelledAt: string }
);

export function validateParticipantIds(ids: string[], label = 'Участники') {
  if (!Array.isArray(ids) || ids.length === 0) throw new Error(`${label}: список не может быть пустым`);
  if (ids.some((id) => typeof id !== 'string' || !id.trim())) throw new Error(`${label}: некорректный ID`);
  if (new Set(ids).size !== ids.length) throw new Error(`${label}: ID должны быть уникальными`);
}

export function validateOperationTime(value: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error('Укажите корректные дату и время операции в формате ISO UTC');
  }
}

function validateRequest(request: SettlementRequest, participantIds: string[]) {
  validateParticipantIds(participantIds);
  if (typeof request.id !== 'string' || !request.id.trim()
    || typeof request.requestId !== 'string' || !request.requestId.trim()) {
    throw new Error('У операции должны быть ID и идентификатор запроса');
  }
  if (!participantIds.includes(request.fromId) || !participantIds.includes(request.toId)) {
    throw new Error('Отправитель и получатель должны существовать в поездке');
  }
  if (request.fromId === request.toId) throw new Error('Нельзя перевести деньги самому себе');
  if (request.currency !== 'GEL') throw new Error('Переводы поддерживают только GEL');
  if (!Number.isSafeInteger(request.amountMinor) || request.amountMinor <= 0) {
    throw new Error('Сумма перевода должна быть положительным безопасным целым числом тетри');
  }
  // History and current balances still use the existing major-unit display boundary.
  moneyFromCents(request.amountMinor);
  validateOperationTime(request.occurredAt);
}

export function createSettlement(request: SettlementRequest, participantIds: string[]): Settlement {
  validateRequest(request, participantIds);
  return {
    id: request.id, requestId: request.requestId, fromId: request.fromId, toId: request.toId,
    amountMinor: request.amountMinor, currency: request.currency, occurredAt: request.occurredAt,
    status: 'completed',
  };
}

/** Retries may generate new transport metadata, but must preserve the payment intent. */
export function sameSettlementIntent(left: SettlementRequest, right: SettlementRequest) {
  return left.fromId === right.fromId && left.toId === right.toId
    && left.amountMinor === right.amountMinor && left.currency === right.currency;
}

/** Exact journal replays count once; conflicting identities or statuses are rejected. */
export function validateSettlementJournal(operations: Settlement[], participantIds: string[]): Settlement[] {
  validateParticipantIds(participantIds);
  const byId = new Map<string, Settlement>();
  const byRequest = new Map<string, Settlement>();
  for (const operation of operations) {
    validateRequest(operation, participantIds);
    if (operation.status === 'cancelled') {
      validateOperationTime(operation.cancelledAt);
      if (operation.cancelledAt < operation.occurredAt) throw new Error('Отмена не может быть раньше перевода');
    } else if (operation.status !== 'completed' || operation.cancelledAt !== undefined) {
      throw new Error('Некорректный статус перевода');
    }
    const previous = byId.get(operation.id) ?? byRequest.get(operation.requestId);
    if (previous) {
      if (previous.id !== operation.id || previous.requestId !== operation.requestId
        || !sameSettlementIntent(previous, operation) || previous.occurredAt !== operation.occurredAt
        || previous.status !== operation.status || previous.cancelledAt !== operation.cancelledAt) {
        throw new Error('ID операции или запроса уже используется другим событием');
      }
      continue;
    }
    byId.set(operation.id, operation);
    byRequest.set(operation.requestId, operation);
  }
  return [...byId.values()];
}
