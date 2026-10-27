/**
 * ДЕМО-ДАННЫЕ. Визовые правила здесь не проверены (verifiedAt: null) и нужны
 * только чтобы оживить экраны. Позже заменим на данные из REST Countries
 * (столица, валюта) и датасета Passport Index + сайтов МИД (визы).
 */

export type VisaCategory = 'visa-free' | 'visa-on-arrival' | 'visa-required';

export const VisaCategoryLabels: Record<VisaCategory, string> = {
  'visa-free': 'Безвиз',
  'visa-on-arrival': 'Виза по прилёту / e-visa',
  'visa-required': 'Сложная виза',
};

export type VisaInfo = {
  category: VisaCategory;
  /** Сколько дней можно находиться без визы / по визе по прилёту. */
  stayDays?: number;
  note?: string;
  sourceUrl?: `https://${string}`;
  /** Дата последней проверки в формате YYYY-MM-DD. null — не проверено. */
  verifiedAt: string | null;
};

export type Country = {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  flag: string;
  capital: string;
  currency: { code: string; name: string };
  region: string;
  /** Визовый режим для гражданина РФ. */
  visa: VisaInfo;
};

export const Countries: Country[] = [
  {
    code: 'TR',
    name: 'Турция',
    flag: '🇹🇷',
    capital: 'Анкара',
    currency: { code: 'TRY', name: 'Турецкая лира' },
    region: 'Азия / Европа',
    visa: { category: 'visa-free', verifiedAt: null },
  },
  {
    code: 'GE',
    name: 'Грузия',
    flag: '🇬🇪',
    capital: 'Тбилиси',
    currency: { code: 'GEL', name: 'Грузинский лари' },
    region: 'Азия',
    visa: { category: 'visa-free', verifiedAt: null },
  },
  {
    code: 'AE',
    name: 'ОАЭ',
    flag: '🇦🇪',
    capital: 'Абу-Даби',
    currency: { code: 'AED', name: 'Дирхам ОАЭ' },
    region: 'Азия',
    visa: { category: 'visa-free', verifiedAt: null },
  },
  {
    code: 'TH',
    name: 'Таиланд',
    flag: '🇹🇭',
    capital: 'Бангкок',
    currency: { code: 'THB', name: 'Тайский бат' },
    region: 'Азия',
    visa: { category: 'visa-free', verifiedAt: null },
  },
  {
    code: 'VN',
    name: 'Вьетнам',
    flag: '🇻🇳',
    capital: 'Ханой',
    currency: { code: 'VND', name: 'Вьетнамский донг' },
    region: 'Азия',
    visa: { category: 'visa-free', verifiedAt: null },
  },
  {
    code: 'EG',
    name: 'Египет',
    flag: '🇪🇬',
    capital: 'Каир',
    currency: { code: 'EGP', name: 'Египетский фунт' },
    region: 'Африка',
    visa: { category: 'visa-on-arrival', verifiedAt: null },
  },
  {
    code: 'ID',
    name: 'Индонезия',
    flag: '🇮🇩',
    capital: 'Джакарта',
    currency: { code: 'IDR', name: 'Индонезийская рупия' },
    region: 'Азия',
    visa: { category: 'visa-on-arrival', verifiedAt: null },
  },
  {
    code: 'IN',
    name: 'Индия',
    flag: '🇮🇳',
    capital: 'Нью-Дели',
    currency: { code: 'INR', name: 'Индийская рупия' },
    region: 'Азия',
    visa: { category: 'visa-on-arrival', note: 'Электронная виза', verifiedAt: null },
  },
  {
    code: 'IT',
    name: 'Италия',
    flag: '🇮🇹',
    capital: 'Рим',
    currency: { code: 'EUR', name: 'Евро' },
    region: 'Европа',
    visa: { category: 'visa-required', note: 'Шенгенская виза', verifiedAt: null },
  },
  {
    code: 'FR',
    name: 'Франция',
    flag: '🇫🇷',
    capital: 'Париж',
    currency: { code: 'EUR', name: 'Евро' },
    region: 'Европа',
    visa: { category: 'visa-required', note: 'Шенгенская виза', verifiedAt: null },
  },
  {
    code: 'JP',
    name: 'Япония',
    flag: '🇯🇵',
    capital: 'Токио',
    currency: { code: 'JPY', name: 'Японская иена' },
    region: 'Азия',
    visa: { category: 'visa-required', verifiedAt: null },
  },
];

export function getCountry(code: string): Country | undefined {
  return Countries.find((c) => c.code === code);
}
