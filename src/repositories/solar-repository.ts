import type { SolarState } from '@/domain/solar-trip';
import { immutableSolarState } from '@/domain/validate-solar-state';
import type { StorageAdapter } from '@/store/app-storage';

export const SOLAR_STORAGE_KEY = 'travel-app/solar/v1';
/** Future SQLite implementation can replace this port without screen changes. */
export interface SolarRepository {
  load(): Promise<SolarState | null>;
  save(state: SolarState): Promise<void>;
}

export class SolarDataError extends Error {
  constructor(readonly kind: 'json' | 'structure', message: string) { super(message); }
}

export function createAsyncSolarRepository(adapter: StorageAdapter): SolarRepository {
  return {
    async load() {
      const raw = await adapter.getItem(SOLAR_STORAGE_KEY);
      if (raw === null) return null;
      let value: unknown;
      try { value = JSON.parse(raw); }
      catch { throw new SolarDataError('json', 'Данные Solar повреждены: не удалось прочитать JSON. Исходная запись не изменена.'); }
      try { return immutableSolarState(value); }
      catch (error) { throw new SolarDataError('structure', error instanceof Error ? error.message : 'Некорректная структура данных Solar'); }
    },
    async save(state) {
      const checked = immutableSolarState(state);
      await adapter.setItem(SOLAR_STORAGE_KEY, JSON.stringify(checked));
    },
  };
}
