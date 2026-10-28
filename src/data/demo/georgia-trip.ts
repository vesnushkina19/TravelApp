/**
 * ТЕСТОВАЯ поездка «Грузия, 3–12 мая» для прототипов «Совместная поездка»
 * и «Расходы компании». Суммы и курс условные.
 */

import type { Participant, Stop, TripDay } from '@/domain/travel';
import type { Expense } from '@/domain/financial';

export type { Participant, Role, StopKind, Stop, TripDay } from '@/domain/travel';
export { StopKindIcons } from '@/domain/travel';
export type { Expense, ExpenseCategory } from '@/domain/financial';
export { ExpenseCategories } from '@/domain/financial';
export { formatDay } from '@/utils/trip-dates';

/** Условный курс для прототипа. НЕ актуальный. */
export const DEMO_RATE_RUB_PER_GEL = 32.5;

export const DemoParticipants: Participant[] = [
  { id: 'kate', name: 'Катя', role: 'organizer', isMe: true },
  { id: 'anya', name: 'Аня', role: 'member' },
  { id: 'misha', name: 'Миша', role: 'member' },
];

export const DemoTrip = {
  title: 'Грузия с друзьями',
  countryName: 'Грузия',
  flag: '🇬🇪',
  startDate: '2027-05-03',
  endDate: '2027-05-12',
  budgetRub: 360000,
  localCurrency: 'GEL' as const,
};

function tripDates(start: string, end: string) {
  const dates: string[] = [];
  const d = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (d <= last) {
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export const DemoTripDates = tripDates(DemoTrip.startDate, DemoTrip.endDate);

const stopsByDay: Stop[][] = [
  [
    { id: 's1', time: '12:00', title: 'Прилёт в Тбилиси', kind: 'transport', duration: '≈ 1 ч', note: 'Такси до центра' },
    { id: 's2', time: '14:00', title: 'Заселение в Старом городе', kind: 'stay', duration: '≈ 1 ч' },
    { id: 's3', time: '17:00', title: 'Абанотубани и серные бани', kind: 'walk', duration: '≈ 2 ч' },
  ],
  [
    { id: 's4', time: '10:00', title: 'Крепость Нарикала', kind: 'sight', duration: '≈ 1,5 ч', note: 'Канатная дорога от парка Рике' },
    { id: 's5', time: '13:00', title: 'Сухой мост и блошиный рынок', kind: 'walk', duration: '≈ 2 ч' },
    { id: 's6', time: '19:00', title: 'Ужин: хинкали и хачапури', kind: 'food', duration: '≈ 2 ч' },
  ],
  [
    { id: 's7', time: '10:00', title: 'Мцхета и монастырь Джвари', kind: 'sight', duration: '≈ 4 ч', note: '30 минут на машине' },
  ],
  [
    { id: 's8', time: '09:00', title: 'Переезд в Казбеги по Военно-Грузинской дороге', kind: 'transport', duration: '≈ 3 ч' },
    { id: 's9', time: '14:00', title: 'Гергетская Троица', kind: 'nature', duration: '≈ 3 ч' },
  ],
];

export const DemoTripDays: TripDay[] = DemoTripDates.map((date, i) => ({
  date,
  stops: stopsByDay[i] ?? [],
}));

const all = DemoParticipants.map((p) => p.id);

export const DemoExpenses: Expense[] = [
  { id: 'e1', title: 'Квартира в Тбилиси, 4 ночи', category: 'stay', amount: 960, currency: 'GEL', rateRub: DEMO_RATE_RUB_PER_GEL, paidBy: 'kate', splitBetween: all, date: '2027-05-03' },
  { id: 'e2', title: 'Такси из аэропорта', category: 'transport', amount: 45, currency: 'GEL', rateRub: DEMO_RATE_RUB_PER_GEL, paidBy: 'misha', splitBetween: all, date: '2027-05-03' },
  { id: 'e3', title: 'Ужин: хинкали и хачапури', category: 'food', amount: 138.5, currency: 'GEL', rateRub: DEMO_RATE_RUB_PER_GEL, paidBy: 'anya', splitBetween: all, date: '2027-05-04' },
  { id: 'e4', title: 'Серные бани', category: 'fun', amount: 150, currency: 'GEL', rateRub: DEMO_RATE_RUB_PER_GEL, paidBy: 'kate', splitBetween: ['kate', 'anya'], date: '2027-05-03' },
  { id: 'e5', title: 'Трансфер в Мцхету', category: 'transport', amount: 120, currency: 'GEL', rateRub: DEMO_RATE_RUB_PER_GEL, paidBy: 'misha', splitBetween: all, date: '2027-05-05' },
  { id: 'e6', title: 'Сувениры и чурчхела', category: 'shopping', amount: 64, currency: 'GEL', rateRub: DEMO_RATE_RUB_PER_GEL, paidBy: 'anya', splitBetween: ['anya'], date: '2027-05-05' },
];
