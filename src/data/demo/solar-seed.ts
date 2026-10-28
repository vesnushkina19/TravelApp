import type { SolarState, Trip } from '@/domain/solar-trip';
import { toStoredExpense } from '@/domain/trip-finance';
import { moneyToCents } from '@/utils/money';

import { DEMO_RATE_RUB_PER_GEL, DemoExpenses, DemoParticipants, DemoTrip, DemoTripDays } from './georgia-trip';

/** Called only after the new repository confirms the absence of its key. */
export function createDemoSolarState(): SolarState {
  const id = 'solar-georgia';
  const rateId = `${id}:rate:demo`;
  const trip: Trip = {
    id, title: DemoTrip.title, countryCode: 'GE', countryName: DemoTrip.countryName, flag: DemoTrip.flag,
    startDate: DemoTrip.startDate, endDate: DemoTrip.endDate, budgetMinorRub: moneyToCents(DemoTrip.budgetRub),
    currency: 'GEL', isDemo: true, participants: DemoParticipants.map((person) => ({ ...person })),
    days: DemoTripDays.map((day) => ({ id: `${id}:day:${day.date}`, date: day.date, stops: day.stops.map((stop) => ({ ...stop })) })),
    exchangeRates: [{ id: rateId, currency: 'GEL', quoteCurrency: 'RUB', rateRub: DEMO_RATE_RUB_PER_GEL,
      source: 'demo', effectiveDate: DemoTrip.startDate, obtainedAt: '2026-10-27T12:00:00.000Z' }],
    currentRateId: rateId, expenses: [], settlements: [],
  };
  trip.expenses = DemoExpenses.map((expense) => toStoredExpense(expense, trip, rateId));
  return { schemaVersion: 1, activeTripId: id, trips: [trip] };
}
