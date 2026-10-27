/**
 * ТЕСТОВЫЕ ДАННЫЕ для прототипа «Куда поехать?».
 * Цены, сезонность и визовые статусы условные — не использовать как реальные сведения.
 */

import type { VisaCategory } from '@/data/countries';

export type Preference = 'sea' | 'cities' | 'nature' | 'active';

export const PreferenceLabels: Record<Preference, string> = {
  sea: 'Море',
  cities: 'Города',
  nature: 'Природа',
  active: 'Активный отдых',
};

export type DemoDestination = {
  id: string;
  name: string;
  flag: string;
  visa: VisaCategory;
  /** Оценка сезона 1–5 по месяцам, январь — индекс 0. */
  seasonByMonth: number[];
  /** Условные расходы на человека в день, ₽. */
  dailyRub: number;
  /** Условный перелёт туда-обратно на человека, ₽. */
  flightRub: number;
  tags: Preference[];
  reason: string;
};

export const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

export const DemoDestinations: DemoDestination[] = [
  {
    id: 'GE',
    name: 'Грузия',
    flag: '🇬🇪',
    visa: 'visa-free',
    seasonByMonth: [2, 2, 3, 4, 5, 5, 4, 4, 5, 5, 3, 2],
    dailyRub: 6000,
    flightRub: 25000,
    tags: ['cities', 'nature', 'active'],
    reason: 'Горы, вино и старый Тбилиси — короткий перелёт',
  },
  {
    id: 'TR',
    name: 'Турция',
    flag: '🇹🇷',
    visa: 'visa-free',
    seasonByMonth: [2, 2, 3, 4, 5, 5, 5, 5, 5, 4, 3, 2],
    dailyRub: 7000,
    flightRub: 30000,
    tags: ['sea', 'cities'],
    reason: 'Тёплое море и Стамбул в одной поездке',
  },
  {
    id: 'TH',
    name: 'Таиланд',
    flag: '🇹🇭',
    visa: 'visa-free',
    seasonByMonth: [5, 5, 4, 3, 2, 2, 2, 2, 2, 3, 4, 5],
    dailyRub: 5500,
    flightRub: 65000,
    tags: ['sea', 'nature', 'active'],
    reason: 'Сухой сезон, острова и уличная еда',
  },
  {
    id: 'VN',
    name: 'Вьетнам',
    flag: '🇻🇳',
    visa: 'visa-free',
    seasonByMonth: [4, 5, 5, 4, 3, 3, 3, 3, 3, 3, 4, 4],
    dailyRub: 4500,
    flightRub: 60000,
    tags: ['sea', 'nature'],
    reason: 'Недорого на месте, море и рисовые террасы',
  },
  {
    id: 'AE',
    name: 'Объединённые Арабские Эмираты',
    flag: '🇦🇪',
    visa: 'visa-free',
    seasonByMonth: [5, 5, 4, 3, 2, 1, 1, 1, 2, 4, 5, 5],
    dailyRub: 12000,
    flightRub: 35000,
    tags: ['sea', 'cities'],
    reason: 'Комфортная жара зимой и пляжи рядом с городом',
  },
  {
    id: 'EG',
    name: 'Египет',
    flag: '🇪🇬',
    visa: 'visa-on-arrival',
    seasonByMonth: [4, 4, 5, 5, 4, 3, 2, 2, 3, 5, 5, 4],
    dailyRub: 5000,
    flightRub: 35000,
    tags: ['sea', 'active'],
    reason: 'Красное море и дайвинг круглый год',
  },
  {
    id: 'ID',
    name: 'Индонезия',
    flag: '🇮🇩',
    visa: 'visa-on-arrival',
    seasonByMonth: [2, 2, 3, 4, 5, 5, 5, 5, 5, 4, 3, 2],
    dailyRub: 6500,
    flightRub: 80000,
    tags: ['sea', 'nature', 'active'],
    reason: 'Бали в сухой сезон: сёрф, вулканы, храмы',
  },
  {
    id: 'IT',
    name: 'Италия',
    flag: '🇮🇹',
    visa: 'visa-required',
    seasonByMonth: [2, 2, 3, 4, 5, 4, 3, 3, 5, 4, 2, 2],
    dailyRub: 12000,
    flightRub: 45000,
    tags: ['cities', 'sea'],
    reason: 'Города-музеи и море, но нужна шенгенская виза',
  },
  {
    id: 'JP',
    name: 'Япония',
    flag: '🇯🇵',
    visa: 'visa-required',
    seasonByMonth: [2, 2, 5, 5, 4, 3, 2, 2, 3, 4, 5, 3],
    dailyRub: 11000,
    flightRub: 80000,
    tags: ['cities', 'nature'],
    reason: 'Сакура весной и клёны осенью',
  },
];

export const SeasonLabels: Record<number, string> = {
  5: 'Идеальный сезон',
  4: 'Хороший сезон',
  3: 'Можно ехать',
  2: 'Не сезон',
  1: 'Не рекомендуем',
};
