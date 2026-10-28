/** Existing v1 payload and key. No migration or default merging of damaged data. */
export const STORAGE_KEY = 'travel-app/state/v1';

export type Trip = Readonly<{
  id: string;
  countryCode: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  note?: string;
}>;

export type AppState = Readonly<{
  citizenship: string;
  visited: readonly string[];
  trips: readonly Trip[];
}>;

export type StorageStatus = 'loading' | 'ready' | 'error';
export type StorageError = Readonly<{
  kind: 'read' | 'json' | 'structure' | 'write';
  message: string;
}>;
export type StorageSnapshot = Readonly<{
  data: AppState;
  status: StorageStatus;
  error: StorageError | null;
  saving: boolean;
}>;
export type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

class StoredDataError extends Error {
  constructor(readonly kind: 'json' | 'structure', message: string) {
    super(message);
  }
}

function freezeState(data: AppState): AppState {
  return Object.freeze({
    citizenship: data.citizenship,
    visited: Object.freeze([...data.visited]),
    trips: Object.freeze(data.trips.map((trip) => Object.freeze({ ...trip }))),
  });
}

function emptyState(): AppState {
  return freezeState({ citizenship: 'RU', visited: [], trips: [] });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function knownKeys(record: Record<string, unknown>, keys: string[]) {
  // Unknown fields may belong to a future schema. Block editing rather than silently dropping them.
  return Object.keys(record).every((key) => keys.includes(key));
}

const COUNTRY_CODE = /^[A-Z]{2}$/;
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const isCountryCode = (value: unknown): value is string => typeof value === 'string' && COUNTRY_CODE.test(value);

export function validateAppState(value: unknown): AppState {
  const invalid = () => { throw new StoredDataError('structure',
    'Сохранённые данные имеют некорректную или неподдерживаемую структуру. Исходная запись не заменена.'); };
  if (!isRecord(value) || !knownKeys(value, ['citizenship', 'visited', 'trips'])
    || !isCountryCode(value.citizenship) || !Array.isArray(value.visited) || !Array.isArray(value.trips)) {
    return invalid();
  }
  if (!value.visited.every(isCountryCode) || new Set(value.visited).size !== value.visited.length) return invalid();
  const tripIds = new Set<string>();
  const trips: Trip[] = [];
  for (const trip of value.trips) {
    if (!isRecord(trip) || !knownKeys(trip, ['id', 'countryCode', 'startDate', 'endDate', 'note'])
      || typeof trip.id !== 'string' || !trip.id.trim() || tripIds.has(trip.id)
      || !isCountryCode(trip.countryCode)
      || typeof trip.startDate !== 'string' || !DATE_SHAPE.test(trip.startDate)
      || typeof trip.endDate !== 'string' || !DATE_SHAPE.test(trip.endDate)
      || (trip.note !== undefined && typeof trip.note !== 'string')) return invalid();
    tripIds.add(trip.id);
    trips.push({
      id: trip.id, countryCode: trip.countryCode, startDate: trip.startDate, endDate: trip.endDate,
      ...(trip.note !== undefined ? { note: trip.note } : {}),
    });
  }
  // Only the existing v1 shape is accepted; calendar/business rules are outside hydration.
  return freezeState({ citizenship: value.citizenship, visited: value.visited, trips });
}

export function parseStoredState(raw: string | null): AppState {
  if (raw === null) return emptyState();
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new StoredDataError('json', 'Не удалось прочитать сохранённые данные: повреждён JSON. Исходная запись не заменена.');
  }
  return validateAppState(value);
}

/**
 * AsyncStorage IO is deliberately outside React effects/state updaters.
 * Reads never write. Mutations are blocked until a successful read. Writes are
 * serialized and coalesced; failures retain the latest unsaved snapshot in memory.
 */
export function createAppStorage(adapter: StorageAdapter) {
  const initialSnapshot: StorageSnapshot = Object.freeze({ data: emptyState(), status: 'loading', error: null, saving: false });
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();
  let readTask: Promise<void> | null = null;
  let writeTask: Promise<void> | null = null;
  let revision = 0;
  let savedRevision = 0;

  function publish(next: StorageSnapshot) {
    snapshot = Object.freeze(next);
    listeners.forEach((listener) => listener());
  }

  function load(): Promise<void> {
    if (readTask) return readTask;
    if (snapshot.status === 'ready' || snapshot.error?.kind === 'write') return Promise.resolve();
    publish({ ...snapshot, status: 'loading', error: null, saving: false });
    readTask = Promise.resolve().then(async () => {
      try {
        const data = parseStoredState(await adapter.getItem(STORAGE_KEY));
        publish({ data, status: 'ready', error: null, saving: false });
      } catch (error) {
        publish({ ...snapshot, status: 'error', saving: false, error: error instanceof StoredDataError
          ? { kind: error.kind, message: error.message }
          : { kind: 'read', message: 'Не удалось загрузить данные с устройства. Запись заблокирована; попробуйте загрузить ещё раз.' } });
      }
    }).finally(() => { readTask = null; });
    return readTask;
  }

  function scheduleWrite(): Promise<void> {
    if (writeTask) return writeTask;
    // Schedule after assigning writeTask, so subscriptions cannot create parallel writers.
    writeTask = Promise.resolve().then(async () => {
      while (snapshot.status === 'ready' && savedRevision < revision) {
        const targetRevision = revision;
        const raw = JSON.stringify(snapshot.data);
        try {
          await adapter.setItem(STORAGE_KEY, raw);
          savedRevision = targetRevision;
        } catch {
          publish({ ...snapshot, status: 'error', saving: false, error: {
            kind: 'write', message: 'Не удалось сохранить изменения. Они остались в памяти; повторите сохранение, не закрывая приложение.',
          } });
          return; // Do not execute later queued writes or retry automatically.
        }
      }
      if (snapshot.status === 'ready') publish({ ...snapshot, saving: false });
    }).finally(() => {
      writeTask = null;
      if (snapshot.status === 'ready' && savedRevision < revision) void scheduleWrite();
    });
    return writeTask;
  }

  function change(update: (data: AppState) => AppState): boolean {
    if (snapshot.status !== 'ready') return false;
    let data: AppState;
    try {
      data = validateAppState(update(snapshot.data));
    } catch {
      return false;
    }
    revision++;
    publish({ data, status: 'ready', error: null, saving: true });
    void scheduleWrite();
    return true;
  }

  async function flush(): Promise<boolean> {
    while (writeTask) await writeTask;
    return snapshot.status === 'ready' && revision === savedRevision;
  }

  async function retry(): Promise<boolean> {
    if (readTask) await readTask;
    if (writeTask) await writeTask;
    if (snapshot.error?.kind === 'write') {
      // Never reload the old disk snapshot over accepted but unsaved user actions.
      publish({ ...snapshot, status: 'ready', error: null, saving: true });
      await scheduleWrite();
    } else if (snapshot.status !== 'ready') {
      await load();
    }
    return flush();
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialSnapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load,
    retry,
    flush,
    toggleVisited: (code: string) => change((data) => ({ ...data,
      visited: data.visited.includes(code) ? data.visited.filter((item) => item !== code) : [...data.visited, code],
    })),
    addTrip: (trip: Omit<Trip, 'id'>) => change((data) => {
      const base = String(Date.now());
      let id = base;
      let suffix = 1;
      while (data.trips.some((item) => item.id === id)) id = `${base}-${suffix++}`;
      return { ...data, trips: [...data.trips, { ...trip, id }] };
    }),
    removeTrip: (id: string) => change((data) => ({ ...data, trips: data.trips.filter((trip) => trip.id !== id) })),
    resetAll: () => change(() => emptyState()),
  };
}
