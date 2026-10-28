import { applySolarAction, type SolarAction } from '@/domain/solar-actions';
import type { SolarState } from '@/domain/solar-trip';
import { immutableSolarState } from '@/domain/validate-solar-state';
import { SolarDataError, type SolarRepository } from '@/repositories/solar-repository';

import type { StorageError, StorageStatus } from './app-storage';

export type SolarSnapshot = Readonly<{
  data: SolarState | null;
  status: StorageStatus;
  error: StorageError | null;
  saving: boolean;
}>;

/** One serialized writer; the repository is injected and independent of React. */
export function createSolarStorage(repository: SolarRepository, seed: () => SolarState) {
  const initial: SolarSnapshot = Object.freeze({ data: null, status: 'loading', error: null, saving: false });
  let snapshot = initial;
  let readTask: Promise<void> | null = null;
  let writeTask: Promise<void> | null = null;
  let revision = 0;
  let saved = 0;
  const listeners = new Set<() => void>();
  const publish = (next: SolarSnapshot) => { snapshot = Object.freeze(next); listeners.forEach((listener) => listener()); };

  function save(): Promise<void> {
    if (writeTask) return writeTask;
    writeTask = Promise.resolve().then(async () => {
      while ((snapshot.status === 'ready' || snapshot.status === 'loading') && snapshot.data && saved < revision) {
        const target = revision;
        try { await repository.save(snapshot.data); saved = target; }
        catch {
          publish({ ...snapshot, status: 'error', saving: false, error: { kind: 'write',
            message: 'Не удалось сохранить поездку Solar. Изменения остались в памяти; повторите сохранение, не закрывая приложение.' } });
          return;
        }
      }
      if (snapshot.data && snapshot.status !== 'error') publish({ ...snapshot, status: 'ready', saving: false });
    }).finally(() => {
      writeTask = null;
      if (snapshot.status === 'ready' && saved < revision) void save();
    });
    return writeTask;
  }

  function load(): Promise<void> {
    if (readTask) return readTask;
    if (snapshot.status === 'ready' || snapshot.error?.kind === 'write') return Promise.resolve();
    readTask = Promise.resolve().then(async () => {
      try {
        const loaded = await repository.load();
        if (loaded === null) {
          const data = immutableSolarState(seed()); // Only after a confirmed missing key.
          revision++;
          publish({ data, status: 'loading', error: null, saving: true });
          await save(); // First initialization is durable before ready.
        } else {
          publish({ data: immutableSolarState(loaded), status: 'ready', error: null, saving: false });
        }
      } catch (error) {
        publish({ ...snapshot, status: 'error', saving: false, error: error instanceof SolarDataError
          ? { kind: error.kind, message: error.message }
          : { kind: 'read', message: 'Не удалось загрузить поездку Solar. Запись заблокирована; повторите загрузку.' } });
      }
    }).finally(() => { readTask = null; });
    publish({ ...snapshot, status: 'loading', error: null, saving: false });
    return readTask;
  }

  function dispatch(action: SolarAction) {
    if (snapshot.status !== 'ready' || !snapshot.data) throw new Error('Дождитесь готовности хранилища Solar');
    const updated = applySolarAction(snapshot.data, action);
    if (updated === snapshot.data) return; // Durable request IDs make retries no-ops, including after restart.
    const data = immutableSolarState(updated);
    revision++;
    publish({ data, status: 'ready', error: null, saving: true });
    void save();
  }

  async function flush() {
    while (writeTask) await writeTask;
    return snapshot.status === 'ready' && saved === revision;
  }

  async function retry() {
    if (readTask) await readTask;
    if (writeTask) await writeTask;
    if (snapshot.error?.kind === 'write') {
      publish({ ...snapshot, status: 'loading', error: null, saving: true });
      await save();
    } else if (snapshot.status !== 'ready') await load();
    return flush();
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load, dispatch, flush, retry,
  };
}
