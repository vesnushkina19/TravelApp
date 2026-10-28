import type { ExpenseCategory } from './financial';
import type { Settlement } from './settlement';
import type { Participant, Stop } from './travel';

export type TripParticipant = Participant;
export type TripStop = Stop;
export type TripDay = { id: string; date: string; stops: TripStop[] };

export type ExchangeRateSnapshot = {
  id: string;
  currency: 'GEL';
  quoteCurrency: 'RUB';
  rateRub: number;
  source: 'demo' | 'manual';
  effectiveDate: string;
  obtainedAt: string;
};

export type ExpenseShare = { id: string; participantId: string; amountMinor: number };
export type Expense = {
  id: string;
  title: string;
  category: ExpenseCategory;
  amountMinor: number;
  currency: 'GEL';
  paidById: string;
  splitMode: 'equal' | 'manual';
  shares: ExpenseShare[];
  exchangeRateId: string;
  date: string;
};

/** One aggregate; array order is the explicit day, stop and share order. */
export type Trip = {
  id: string;
  title: string;
  countryCode: string;
  countryName: string;
  flag: string;
  startDate: string;
  endDate: string;
  budgetMinorRub: number;
  currency: 'GEL';
  isDemo: boolean;
  participants: TripParticipant[];
  days: TripDay[];
  expenses: Expense[];
  settlements: Settlement[];
  exchangeRates: ExchangeRateSnapshot[];
  currentRateId: string;
};

export type SolarState = { schemaVersion: 1; activeTripId: string; trips: Trip[] };
export type { Settlement } from './settlement';
