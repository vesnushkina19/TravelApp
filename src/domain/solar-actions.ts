import { cancelSettlement, registerSettlement } from '@/utils/settlement-ledger';

import type { Expense as FinancialExpense } from './financial';
import type { SettlementRequest } from './settlement';
import type { ExchangeRateSnapshot, SolarState, Trip, TripParticipant, TripStop } from './solar-trip';
import { getTripView, toStoredExpense } from './trip-finance';

export type SolarAction =
  | { type: 'create-trip'; trip: Trip }
  | { type: 'select-trip'; tripId: string }
  | { type: 'add-participant'; participant: TripParticipant }
  | { type: 'remove-participant'; participantId: string }
  | { type: 'add-stop'; dayId: string; stop: TripStop }
  | { type: 'add-expense'; expense: FinancialExpense; rateId: string }
  | { type: 'set-rate'; rate: ExchangeRateSnapshot }
  | { type: 'register-settlement'; request: SettlementRequest }
  | { type: 'cancel-settlement'; id: string; cancelledAt: string };

/** No in-place edits; durable validation is performed by the store before acceptance. */
export function applySolarAction(state: SolarState, action: SolarAction): SolarState {
  if (action.type === 'create-trip') {
    if (state.trips.some((trip) => trip.id === action.trip.id)) throw new Error('ID поездки уже существует');
    return { ...state, trips: [...state.trips, action.trip], activeTripId: action.trip.id };
  }
  if (action.type === 'select-trip') {
    if (!state.trips.some((trip) => trip.id === action.tripId)) throw new Error('Поездка не найдена');
    return { ...state, activeTripId: action.tripId };
  }
  const trip = state.trips.find((item) => item.id === state.activeTripId);
  if (!trip) throw new Error('Поездка не найдена');
  let updated: Trip;
  switch (action.type) {
    case 'add-participant': updated = { ...trip, participants: [...trip.participants, action.participant] }; break;
    case 'remove-participant': {
      const id = action.participantId;
      if (!trip.participants.some((person) => person.id === id)) throw new Error('Участник не найден');
      if (trip.expenses.some((expense) => expense.paidById === id || expense.shares.some((share) => share.participantId === id))
        || trip.settlements.some((payment) => payment.fromId === id || payment.toId === id)) {
        throw new Error('Нельзя удалить участника с финансовой историей');
      }
      updated = { ...trip, participants: trip.participants.filter((person) => person.id !== id) };
      break;
    }
    case 'add-stop': {
      if (!trip.days.some((day) => day.id === action.dayId)) throw new Error('День маршрута не найден');
      updated = { ...trip, days: trip.days.map((day) => day.id === action.dayId ? { ...day, stops: [...day.stops, action.stop] } : day) };
      break;
    }
    case 'add-expense': updated = { ...trip, expenses: [...trip.expenses, toStoredExpense(action.expense, trip, action.rateId)] }; break;
    case 'set-rate': updated = { ...trip, exchangeRates: [...trip.exchangeRates, action.rate], currentRateId: action.rate.id }; break;
    case 'register-settlement': {
      const view = getTripView(trip);
      const ledger = registerSettlement(view.ledger, action.request, view.participantIds);
      if (ledger === view.ledger) return state;
      updated = { ...trip, settlements: ledger.settlements };
      break;
    }
    case 'cancel-settlement': {
      const view = getTripView(trip);
      const ledger = cancelSettlement(view.ledger, action.id, action.cancelledAt, view.participantIds);
      if (ledger === view.ledger) return state;
      updated = { ...trip, settlements: ledger.settlements };
      break;
    }
  }
  return { ...state, trips: state.trips.map((item) => item.id === trip.id ? updated : item) };
}
