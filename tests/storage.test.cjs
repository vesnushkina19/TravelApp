/* global __dirname */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Same installed compiler and built-in runner as the financial suite; no emitted files.
function loader(overrides = {}) {
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(__dirname, '..', relative);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const output = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const run = vm.runInThisContext(`(function(require, module, exports) {${output}\n})`, { filename: file });
    run((name) => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.startsWith('@/') || name.startsWith('.')) {
        const target = name.startsWith('@/') ? path.resolve(__dirname, '../src', name.slice(2))
          : path.resolve(path.dirname(file), name);
        return load(`${target}.ts`);
      }
      return require(name);
    }, mod, mod.exports);
    return mod.exports;
  }
  return load;
}

const storage = loader()('src/store/app-storage.ts');
const trip = { id: 'old-trip', countryCode: 'GE', startDate: '2027-05-03', endDate: '2027-05-12', note: 'Tickets bought' };
const data = { citizenship: 'RU', visited: ['TR', 'GE'], trips: [trip] };
const freshTrip = { countryCode: 'TR', startDate: '2027-06-01', endDate: '2027-06-05' };
const tick = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function memoryStorage(raw = JSON.stringify(data)) {
  const mock = { raw, reads: [], writes: [], readError: false, writeError: false };
  mock.adapter = {
    async getItem(key) {
      mock.reads.push(key);
      if (mock.readError) throw new Error('device read failed');
      return mock.raw;
    },
    async setItem(key, value) {
      mock.writes.push({ key, value });
      if (mock.writeError) throw new Error('device write failed');
      mock.raw = value;
    },
  };
  return mock;
}

function assertBlocked(controller) {
  const before = controller.getSnapshot();
  assert.equal(controller.toggleVisited('JP'), false);
  assert.equal(controller.addTrip(freshTrip), false);
  assert.equal(controller.removeTrip('old-trip'), false);
  assert.equal(controller.resetAll(), false);
  assert.equal(controller.getSnapshot(), before);
}

test('successful v1 hydration preserves trips, notes, citizenship and visited countries without writing', async () => {
  const mock = memoryStorage(JSON.stringify(data, null, 2));
  const originalRaw = mock.raw;
  const controller = storage.createAppStorage(mock.adapter);
  assert.equal(controller.getSnapshot().status, 'loading');
  await controller.load();
  assert.equal(controller.getSnapshot().status, 'ready');
  assert.deepEqual(controller.getSnapshot().data, data);
  assert.equal(controller.getSnapshot().saving, false);
  assert.equal(controller.getSnapshot().error, null);
  assert.equal(mock.writes.length, 0);
  assert.equal(mock.raw, originalRaw);
  assert.deepEqual(mock.reads, ['travel-app/state/v1']);
});

test('an absent key means first launch; empty defaults are not automatically persisted', async () => {
  const mock = memoryStorage(null);
  const controller = storage.createAppStorage(mock.adapter);
  await controller.load();
  assert.deepEqual(controller.getSnapshot().data, { citizenship: 'RU', visited: [], trips: [] });
  assert.equal(controller.getSnapshot().status, 'ready');
  assert.equal(mock.raw, null);
  assert.equal(mock.writes.length, 0);
  assert.equal(controller.toggleVisited('GE'), true);
  assert.equal(await controller.flush(), true);
  assert.deepEqual(JSON.parse(mock.raw), { citizenship: 'RU', visited: ['GE'], trips: [] });
});

for (const raw of ['', '{broken', '{"trips":', 'undefined']) {
  test(`damaged JSON is preserved exactly and never overwritten: ${JSON.stringify(raw)}`, async () => {
    const mock = memoryStorage(raw);
    const controller = storage.createAppStorage(mock.adapter);
    await controller.load();
    assert.equal(controller.getSnapshot().status, 'error');
    assert.equal(controller.getSnapshot().error.kind, 'json');
    assertBlocked(controller);
    assert.equal(await controller.flush(), false);
    assert.equal(mock.raw, raw);
    assert.equal(mock.writes.length, 0);
    assert.equal(await controller.retry(), false);
    assert.equal(mock.raw, raw);
    assert.equal(mock.writes.length, 0);
  });
}

const invalidRecords = [
  ['null', null], ['array', []], ['string', 'text'], ['number', 5], ['missing fields', {}],
  ['missing trips', { citizenship: 'RU', visited: [] }],
  ['null trips', { ...data, trips: null }], ['non-array trips', { ...data, trips: {} }],
  ['null visited', { ...data, visited: null }], ['wrong visited type', { ...data, visited: 'GE' }],
  ['invalid country value', { ...data, visited: ['GE', 42] }],
  ['duplicate visited', { ...data, visited: ['GE', 'GE'] }],
  ['wrong citizenship', { ...data, citizenship: 42 }],
  ['future schema field', { ...data, favorites: ['GE'] }],
  ['null trip', { ...data, trips: [null] }],
  ['missing trip field', { ...data, trips: [{ id: 'x' }] }],
  ['wrong note type', { ...data, trips: [{ ...trip, note: 42 }] }],
  ['wrong date type', { ...data, trips: [{ ...trip, startDate: 42 }] }],
  ['wrong date shape', { ...data, trips: [{ ...trip, endDate: 'tomorrow' }] }],
  ['duplicate trip ID', { ...data, trips: [trip, trip] }],
  ['empty trip ID', { ...data, trips: [{ ...trip, id: '' }] }],
  ['unknown trip field', { ...data, trips: [{ ...trip, participants: [] }] }],
];

for (const [name, value] of invalidRecords) {
  test(`invalid structure blocks writes and preserves raw data: ${name}`, async () => {
    const mock = memoryStorage(JSON.stringify(value));
    const original = mock.raw;
    const controller = storage.createAppStorage(mock.adapter);
    await controller.load();
    assert.equal(controller.getSnapshot().status, 'error');
    assert.equal(controller.getSnapshot().error.kind, 'structure');
    assertBlocked(controller);
    assert.equal(mock.writes.length, 0);
    assert.equal(mock.raw, original);
  });
}

test('valid ISO country codes outside the small demo catalog are retained', async () => {
  const record = { citizenship: 'US', visited: ['US', 'GB'], trips: [{ ...trip, countryCode: 'US' }] };
  const controller = storage.createAppStorage(memoryStorage(JSON.stringify(record)).adapter);
  await controller.load();
  assert.deepEqual(controller.getSnapshot().data, record);
});

test('getItem rejection is caught, remains read-only, and a retry only reads', async () => {
  const mock = memoryStorage();
  mock.readError = true;
  const controller = storage.createAppStorage(mock.adapter);
  await controller.load();
  assert.equal(controller.getSnapshot().status, 'error');
  assert.equal(controller.getSnapshot().error.kind, 'read');
  assertBlocked(controller);
  mock.readError = false;
  assert.equal(await controller.retry(), true);
  assert.deepEqual(controller.getSnapshot().data, data);
  assert.equal(mock.reads.length, 2);
  assert.equal(mock.writes.length, 0);
});

test('synchronous adapter exceptions are caught for both reads and writes', async () => {
  const controller = storage.createAppStorage({
    getItem() { throw new Error('synchronous read error'); },
    setItem() { throw new Error('should never write'); },
  });
  await controller.load();
  assert.equal(controller.getSnapshot().error.kind, 'read');
  const writer = storage.createAppStorage({
    getItem: async () => JSON.stringify(data),
    setItem() { throw new Error('synchronous write error'); },
  });
  await writer.load();
  writer.toggleVisited('JP');
  assert.equal(await writer.flush(), false);
  assert.equal(writer.getSnapshot().error.kind, 'write');
});

test('slow hydration blocks every early mutation, then preserves old data on the first accepted action', async () => {
  const read = deferred();
  const mock = memoryStorage();
  mock.adapter.getItem = (key) => { mock.reads.push(key); return read.promise; };
  const controller = storage.createAppStorage(mock.adapter);
  const loading = controller.load();
  await tick();
  assert.equal(controller.getSnapshot().status, 'loading');
  assertBlocked(controller);
  assert.equal(mock.writes.length, 0);
  read.resolve(JSON.stringify(data));
  await loading;
  assert.deepEqual(controller.getSnapshot().data, data);
  assert.equal(controller.toggleVisited('JP'), true);
  await controller.flush();
  assert.deepEqual(JSON.parse(mock.raw).trips, data.trips);
  assert.deepEqual(JSON.parse(mock.raw).visited, ['TR', 'GE', 'JP']);
});

test('repeated initialization, including Strict Mode, shares one pending read and never reloads ready state', async () => {
  const read = deferred();
  let reads = 0;
  const controller = storage.createAppStorage({ getItem: () => { reads++; return read.promise; }, setItem: async () => {} });
  const first = controller.load();
  assert.equal(controller.load(), first);
  await tick();
  assert.equal(reads, 1);
  read.resolve(JSON.stringify(data));
  await first;
  await controller.load();
  assert.equal(reads, 1);
});

test('concurrent retry clicks after a read error share the recovery read', async () => {
  const mock = memoryStorage();
  mock.readError = true;
  const controller = storage.createAppStorage(mock.adapter);
  await controller.load();
  mock.readError = false;
  assert.deepEqual(await Promise.all([controller.retry(), controller.retry()]), [true, true]);
  assert.equal(mock.reads.length, 2);
  assert.equal(mock.writes.length, 0);
});

test('recovery from invalid data requires a valid read and never silently repairs the stored bytes', async () => {
  const mock = memoryStorage('{broken');
  const controller = storage.createAppStorage(mock.adapter);
  await controller.load();
  mock.raw = JSON.stringify(data);
  assert.equal(await controller.retry(), true);
  assert.deepEqual(controller.getSnapshot().data, data);
  assert.equal(mock.writes.length, 0);
});

test('write failures retain accepted actions in memory and block further mutations', async () => {
  const mock = memoryStorage();
  const original = mock.raw;
  const controller = storage.createAppStorage(mock.adapter);
  await controller.load();
  mock.writeError = true;
  assert.equal(controller.addTrip(freshTrip), true);
  assert.equal(controller.getSnapshot().saving, true);
  assert.equal(await controller.flush(), false);
  assert.equal(controller.getSnapshot().status, 'error');
  assert.equal(controller.getSnapshot().error.kind, 'write');
  assert.equal(controller.getSnapshot().data.trips.length, 2);
  assert.equal(controller.getSnapshot().saving, false);
  assertBlocked(controller);
  assert.equal(mock.raw, original);
  await tick();
  assert.equal(mock.writes.length, 1);
});

test('retry after setItem failure saves the pending snapshot without reading stale disk data', async () => {
  const mock = memoryStorage();
  const controller = storage.createAppStorage(mock.adapter);
  await controller.load();
  mock.writeError = true;
  controller.addTrip(freshTrip);
  controller.toggleVisited('JP');
  await controller.flush();
  const pending = controller.getSnapshot().data;
  mock.writeError = false;
  assert.equal(await controller.retry(), true);
  assert.equal(mock.reads.length, 1);
  assert.equal(controller.getSnapshot().data, pending);
  assert.equal(controller.getSnapshot().status, 'ready');
  assert.deepEqual(JSON.parse(mock.raw).trips[0], trip);
  assert.equal(JSON.parse(mock.raw).trips.length, 2);
  assert.deepEqual(JSON.parse(mock.raw).visited, ['TR', 'GE', 'JP']);
});

test('failed retry keeps the unsaved snapshot and does not start automatic write retries', async () => {
  const mock = memoryStorage();
  const controller = storage.createAppStorage(mock.adapter);
  await controller.load();
  mock.writeError = true;
  controller.toggleVisited('JP');
  await controller.flush();
  const pending = controller.getSnapshot().data;
  assert.equal(await controller.retry(), false);
  await tick();
  assert.equal(mock.writes.length, 2);
  assert.equal(mock.reads.length, 1);
  assert.equal(controller.getSnapshot().data, pending);
  assertBlocked(controller);
});

test('writes are serialized and the latest queued data wins without losing earlier actions', async () => {
  const mock = memoryStorage();
  const first = deferred();
  let calls = 0;
  mock.adapter.setItem = async (key, value) => {
    mock.writes.push({ key, value });
    if (++calls === 1) await first.promise;
    mock.raw = value;
  };
  const controller = storage.createAppStorage(mock.adapter);
  await controller.load();
  controller.toggleVisited('JP');
  await tick();
  controller.addTrip(freshTrip);
  controller.toggleVisited('IT');
  await tick();
  assert.equal(mock.writes.length, 1);
  first.resolve();
  assert.equal(await controller.flush(), true);
  assert.equal(mock.writes.length, 2);
  assert.deepEqual(JSON.parse(mock.raw).visited, ['TR', 'GE', 'JP', 'IT']);
  assert.deepEqual(JSON.parse(mock.raw).trips[0], trip);
  assert.equal(JSON.parse(mock.raw).trips.length, 2);
});

test('a failing in-flight write stops the queue and retry preserves all subsequently accepted actions', async () => {
  const mock = memoryStorage();
  const first = deferred();
  mock.adapter.setItem = async (key, value) => { mock.writes.push({ key, value }); await first.promise; mock.raw = value; };
  const controller = storage.createAppStorage(mock.adapter);
  await controller.load();
  controller.toggleVisited('JP');
  await tick();
  controller.addTrip(freshTrip);
  first.reject(new Error('write failed'));
  assert.equal(await controller.flush(), false);
  assert.equal(mock.writes.length, 1);
  mock.adapter.setItem = async (key, value) => { mock.writes.push({ key, value }); mock.raw = value; };
  assert.equal(await controller.retry(), true);
  assert.equal(mock.writes.length, 2);
  assert.equal(JSON.parse(mock.raw).trips.length, 2);
  assert.deepEqual(JSON.parse(mock.raw).visited, ['TR', 'GE', 'JP']);
});

test('an uncertain write acknowledgement can be safely retried without duplicating a trip', async () => {
  const mock = memoryStorage();
  mock.adapter.setItem = async (key, value) => { mock.writes.push({ key, value }); mock.raw = value; throw new Error('ack lost'); };
  const controller = storage.createAppStorage(mock.adapter);
  await controller.load();
  controller.addTrip(freshTrip);
  await controller.flush();
  mock.adapter.setItem = async (key, value) => { mock.writes.push({ key, value }); mock.raw = value; };
  assert.equal(await controller.retry(), true);
  assert.equal(JSON.parse(mock.raw).trips.length, 2);
});

test('reopening after a successful save retains all pre-existing and newly added data in the v1 format', async () => {
  const mock = memoryStorage();
  const first = storage.createAppStorage(mock.adapter);
  await first.load();
  first.addTrip(freshTrip);
  first.toggleVisited('JP');
  await first.flush();
  const reopened = storage.createAppStorage(mock.adapter);
  await reopened.load();
  assert.deepEqual(reopened.getSnapshot().data, first.getSnapshot().data);
  assert.deepEqual(reopened.getSnapshot().data.trips[0], trip);
  assert.deepEqual(reopened.getSnapshot().data.visited, ['TR', 'GE', 'JP']);
  assert.deepEqual(Object.keys(JSON.parse(mock.raw)).sort(), ['citizenship', 'trips', 'visited']);
  assert.ok(mock.writes.every((write) => write.key === 'travel-app/state/v1'));
});

test('a new process can read the previous valid snapshot after a failed save', async () => {
  const mock = memoryStorage();
  const first = storage.createAppStorage(mock.adapter);
  await first.load();
  mock.writeError = true;
  first.toggleVisited('JP');
  await first.flush();
  const reopened = storage.createAppStorage(mock.adapter);
  await reopened.load();
  assert.deepEqual(reopened.getSnapshot().data, data);
  assert.equal(reopened.getSnapshot().status, 'ready');
});

test('remounting consumers of the same coordinator never reloads over an in-flight save', async () => {
  const mock = memoryStorage();
  const write = deferred();
  mock.adapter.setItem = async (key, value) => { await write.promise; mock.raw = value; };
  const controller = storage.createAppStorage(mock.adapter);
  await controller.load();
  controller.toggleVisited('JP');
  await tick();
  await controller.load();
  assert.deepEqual(controller.getSnapshot().data.visited, ['TR', 'GE', 'JP']);
  assert.equal(mock.reads.length, 1);
  write.resolve();
  await controller.flush();
});

test('invalid new data is rejected without mutating or writing a valid snapshot', async () => {
  const mock = memoryStorage();
  const controller = storage.createAppStorage(mock.adapter);
  await controller.load();
  const before = controller.getSnapshot();
  assert.equal(controller.toggleVisited('bad-country'), false);
  assert.equal(controller.addTrip({ ...freshTrip, note: 42 }), false);
  assert.equal(controller.getSnapshot(), before);
  assert.equal(mock.writes.length, 0);
});

test('trip IDs remain unique when two trips are added within one clock tick', async (t) => {
  t.mock.method(Date, 'now', () => 1793185200000);
  const mock = memoryStorage();
  const controller = storage.createAppStorage(mock.adapter);
  await controller.load();
  for (let i = 0; i < 50; i++) assert.equal(controller.addTrip(freshTrip), true);
  await controller.flush();
  const trips = JSON.parse(mock.raw).trips;
  assert.equal(trips.length, 51);
  assert.equal(new Set(trips.map((item) => item.id)).size, 51);
});

test('removing a trip and toggling a visited country preserve unrelated records', async () => {
  const mock = memoryStorage(JSON.stringify({ ...data, trips: [trip, { ...trip, id: 'keep-trip' }] }));
  const controller = storage.createAppStorage(mock.adapter);
  await controller.load();
  assert.equal(controller.removeTrip('old-trip'), true);
  assert.equal(controller.toggleVisited('TR'), true);
  await controller.flush();
  assert.deepEqual(JSON.parse(mock.raw).trips, [{ ...trip, id: 'keep-trip' }]);
  assert.deepEqual(JSON.parse(mock.raw).visited, ['GE']);
});

test('reset requires a successfully hydrated store and an explicit action', async () => {
  const mock = memoryStorage();
  const controller = storage.createAppStorage(mock.adapter);
  assert.equal(controller.resetAll(), false);
  await controller.load();
  assert.equal(mock.writes.length, 0);
  assert.equal(controller.resetAll(), true);
  await controller.flush();
  assert.deepEqual(JSON.parse(mock.raw), { citizenship: 'RU', visited: [], trips: [] });
});

test('snapshots are stable, immutable and notify only active subscriptions', async () => {
  const controller = storage.createAppStorage(memoryStorage().adapter);
  assert.equal(controller.getSnapshot(), controller.getSnapshot());
  const server = controller.getServerSnapshot();
  let notifications = 0;
  const unsubscribe = controller.subscribe(() => { notifications++; });
  await controller.load();
  assert.ok(notifications > 0);
  const snapshot = controller.getSnapshot();
  assert.throws(() => snapshot.data.visited.push('JP'));
  assert.throws(() => snapshot.data.trips.push(trip));
  assert.ok(Object.isFrozen(snapshot.data.trips[0]));
  unsubscribe();
  const count = notifications;
  controller.toggleVisited('JP');
  await controller.flush();
  assert.equal(notifications, count);
  assert.equal(controller.getServerSnapshot(), server);
  assert.equal(server.status, 'loading');
});

function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (Array.isArray(tree)) return tree.map((child) => find(child, predicate)).find(Boolean);
  return predicate(tree) ? tree : find(tree.props?.children, predicate);
}

function providerHarness(mock) {
  const effects = [];
  let mounted = false;
  let context;
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useContext: () => context,
    useEffect: (effect) => { if (!mounted) { effects.push(effect); mounted = true; } },
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  };
  const module = loader({
    react,
    '@react-native-async-storage/async-storage': mock.adapter,
    '@/components/storage-boundary': { StorageBoundary: 'StorageBoundary' },
  })('src/store/app-store.tsx');
  const child = { type: 'IndependentSolarScreen', props: {} };
  const render = () => {
    const tree = module.AppStoreProvider({ children: child });
    context = tree.props.value;
    return { store: context, boundary: tree.props.children };
  };
  return { render, effects, child };
}

test('provider blocks early mutations and never starts an automatic save on hydration', async () => {
  const read = deferred();
  const mock = memoryStorage();
  mock.adapter.getItem = (key) => { mock.reads.push(key); return read.promise; };
  const h = providerHarness(mock);
  let screen = h.render();
  assert.equal(mock.reads.length, 0); // Neither module construction nor rendering performs IO.
  assert.equal(screen.store.status, 'loading');
  assert.equal(screen.store.loaded, false);
  assert.equal(screen.store.addTrip(freshTrip), false);
  assert.equal(screen.boundary.props.children, h.child);
  h.effects[0]();
  h.effects[0](); // React Strict Mode effect replay.
  await tick();
  assert.equal(mock.reads.length, 1);
  read.resolve(JSON.stringify(data));
  await tick();
  screen = h.render();
  assert.equal(screen.store.status, 'ready');
  assert.equal(screen.store.loaded, true);
  assert.deepEqual(screen.store.trips, data.trips);
  assert.deepEqual(screen.store.visited, data.visited);
  assert.equal(screen.boundary.props.children, h.child);
  assert.equal(mock.writes.length, 0);
  screen.store.toggleVisited('JP');
  await tick();
  assert.deepEqual(JSON.parse(mock.raw).trips, data.trips);
  assert.deepEqual(JSON.parse(mock.raw).visited, ['TR', 'GE', 'JP']);
});

test('provider read error and retry do not expose an automatic reset or overwrite corrupt bytes', async () => {
  const mock = memoryStorage('{broken');
  const h = providerHarness(mock);
  h.render();
  h.effects[0]();
  await tick();
  let screen = h.render();
  assert.equal(screen.store.status, 'error');
  assert.equal(screen.store.storageError.kind, 'json');
  assert.equal(screen.store.resetAll(), false);
  assert.equal(screen.boundary.props.children, h.child);
  screen.boundary.props.onRetry();
  await tick();
  screen = h.render();
  assert.equal(screen.store.status, 'error');
  assert.equal(mock.raw, '{broken');
  assert.equal(mock.writes.length, 0);
});

test('provider write recovery keeps mounted screens and retries the unsaved state without reading', async () => {
  const mock = memoryStorage();
  const h = providerHarness(mock);
  h.render();
  h.effects[0]();
  await tick();
  mock.writeError = true;
  h.render().store.toggleVisited('JP');
  await tick();
  let screen = h.render();
  assert.equal(screen.store.status, 'error');
  assert.equal(screen.store.storageError.kind, 'write');
  assert.deepEqual(screen.store.visited, ['TR', 'GE', 'JP']);
  assert.equal(screen.boundary.props.children, h.child);
  mock.writeError = false;
  screen.boundary.props.onRetry();
  await tick();
  screen = h.render();
  assert.equal(screen.store.status, 'ready');
  assert.equal(screen.boundary.props.children, h.child);
  assert.equal(mock.reads.length, 1);
  assert.deepEqual(JSON.parse(mock.raw).visited, ['TR', 'GE', 'JP']);
});

test('loading and error UI blocks interaction while keeping the same screen children mounted', () => {
  const Boundary = loader({
    'react-native': { View: 'View', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: (s) => s } },
    './themed-text': { ThemedText: 'ThemedText' },
  })('src/components/storage-boundary.tsx').StorageBoundary;
  const child = { type: 'IndependentSolarScreen', props: {} };
  let retried = 0;
  const render = (status, error = null) => Boundary({ status, error, onRetry: () => { retried++; }, children: child });
  const loading = render('loading');
  assert.equal(loading.props.children[0].props.children, child);
  assert.equal(loading.props.children[0].props.pointerEvents, 'none');
  assert.ok(find(loading, (e) => e.type === 'ActivityIndicator'));
  const error = render('error', { kind: 'read', message: 'Read error' });
  assert.equal(error.props.children[0].props.children, child);
  assert.equal(error.props.children[0].props.accessibilityElementsHidden, true);
  assert.equal(find(error, (e) => e.props?.accessibilityRole === 'alert').props.children, 'Read error');
  const button = find(error, (e) => e.type === 'Pressable');
  assert.equal(button.props.children.props.children, 'Повторить загрузку');
  button.props.onPress();
  assert.equal(retried, 1);
  const writeError = render('error', { kind: 'write', message: 'Write error' });
  assert.equal(find(writeError, (e) => e.type === 'Pressable').props.children.props.children, 'Повторить сохранение');
  const ready = render('ready');
  assert.equal(ready.props.children[0].props.children, child);
  assert.equal(ready.props.children[0].props.pointerEvents, 'auto');
  assert.equal(find(ready, (e) => e.type === 'Pressable'), undefined);
  assert.equal(find(ready, (e) => e.type === 'ActivityIndicator'), undefined);
});

test('a programmatic early save cannot close the trip form; after loading it preserves existing trips', async () => {
  const mock = memoryStorage();
  const controller = storage.createAppStorage(mock.adapter);
  const values = [];
  let index = 0;
  let navigatedBack = 0;
  const react = { useState(initial) {
    const key = index++;
    if (!(key in values)) values[key] = initial;
    return [values[key], (value) => { values[key] = value; }];
  } };
  const NewTrip = loader({
    react,
    'expo-router': { router: { back: () => { navigatedBack++; } }, useLocalSearchParams: () => ({ country: 'GE' }) },
    'react-native': { Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', StyleSheet: { create: (s) => s } },
    '@/components/themed-text': { ThemedText: 'ThemedText' },
    '@/components/themed-view': { ThemedView: 'ThemedView' },
    '@/constants/theme': { Spacing: { two: 8, three: 16, four: 24, six: 64 } },
    '@/hooks/use-theme': { useTheme: () => ({ background: '#fff', text: '#000' }) },
    '@/store/app-store': { useAppStore: () => ({ addTrip: controller.addTrip }) },
  })('src/app/trip/new.tsx').default;
  const render = () => { index = 0; return NewTrip(); };
  find(render(), (e) => e.props?.placeholder === 'Начало: 2026-12-01').props.onChangeText('2027-06-01');
  find(render(), (e) => e.props?.placeholder === 'Конец: 2026-12-14').props.onChangeText('2027-06-05');
  const save = () => find(render(), (e) => e.type === 'Pressable' && e.props.children.props.children === 'Сохранить').props.onPress();
  save();
  assert.equal(navigatedBack, 0);
  assert.equal(mock.writes.length, 0);
  assert.ok(find(render(), (e) => e.type === 'Text' && typeof e.props.children === 'string' && e.props.children.includes('готовности хранилища')));
  await controller.load();
  save();
  assert.equal(navigatedBack, 1);
  await controller.flush();
  assert.deepEqual(JSON.parse(mock.raw).trips[0], trip);
  assert.equal(JSON.parse(mock.raw).trips.length, 2);
});
