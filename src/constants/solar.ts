/**
 * Дизайн-система Solar. Палитра утверждена — не менять.
 * Пока используется только в прототипах (src/app/demo), остальные экраны
 * переведём на неё после дизайн-ревью.
 */

import type { VisaCategory } from '@/data/countries';

export const Solar = {
  orange: '#FF832B',
  ice: '#F3F9FC',
  navy: '#19364A',
  sky: '#D8EEF4',
  white: '#FFFFFF',
  /** Navy с прозрачностью — второстепенный текст (контраст ≥ 4.5:1 на белом и Ice). */
  navySecondary: 'rgba(25, 54, 74, 0.72)',
  /** Navy с сильной прозрачностью — разделители и обводки. */
  navyLine: 'rgba(25, 54, 74, 0.12)',
} as const;

/** Независимые семантические цвета визовых статусов. */
export const SolarVisa: Record<VisaCategory, { bg: string; fg: string }> = {
  'visa-free': { bg: '#E3F5EA', fg: '#1D7A43' },
  'visa-on-arrival': { bg: '#FFF1D1', fg: '#8A5A00' },
  'visa-required': { bg: '#FDE6E6', fg: '#B42318' },
};

export const SolarSpace = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
} as const;

export const SolarRadius = {
  card: 20,
  button: 14,
  pill: 999,
} as const;

export const SolarSize = {
  buttonHeight: 52,
  touch: 44,
} as const;

export const SolarFont = {
  regular: 'Onest_400Regular',
  medium: 'Onest_500Medium',
  semibold: 'Onest_600SemiBold',
  bold: 'Onest_700Bold',
} as const;
