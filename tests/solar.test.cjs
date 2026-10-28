/* global __dirname */
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

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
    vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })((name) => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (overrides.solar && name.startsWith('@/components/solar/')) return overrides.solar;
      if (name.startsWith('@/') || name.startsWith('.')) {
        const target = name.startsWith('@/') ? path.resolve(__dirname, '../src', name.slice(2)) : path.resolve(path.dirname(file), name);
        return load(existsSync(`${target}.ts`) ? `${target}.ts` : `${target}.tsx`);
      }
      return require(name);
    }, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
const load = loader();
const { createSolarStorage } = load('src/store/solar-storage.ts');
const { createAsyncSolarRepository, SOLAR_STORAGE_KEY } = load('src/repositories/solar-repository.ts');
const { createDemoSolarState } = load('src/data/demo/solar-seed.ts');
const { getTripView } = load('src/domain/trip-finance.ts');
const { immutableSolarState } = load('src/domain/validate-solar-state.ts');
const { moneyToCents } = load('src/utils/money.ts');
const { computeSettlements } = load('src/utils/split.ts');
const OLD_KEY = 'travel-app/state/v1';
const time = '2027-05-03T10:00:00.000Z';
const cancelledAt = '2027-05-03T11:00:00.000Z';
const tick = () => new Promise((resolve) => setImmediate(resolve));
const clone = (value) => JSON.parse(JSON.stringify(value));
const view = (store) => {
  const state = store.getSnapshot().data;
  return getTripView(state.trips.find((trip) => trip.id === state.activeTripId));
};
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function backend(raw = null) {
  const mock = { values: new Map([[OLD_KEY, '{"existing":"must remain untouched"}']]), reads: [], writes: [], readError: false, writeError: false };
  if (raw !== null) mock.values.set(SOLAR_STORAGE_KEY, raw);
  mock.adapter = {
    async getItem(key) { mock.reads.push(key); if (mock.readError) throw new Error('read failed'); return mock.values.get(key) ?? null; },
    async setItem(key, value) { mock.writes.push({ key, value }); if (mock.writeError) throw new Error('write failed'); mock.values.set(key, value); },
  };
  return mock;
}
async function opened(mock = backend(), seed = createDemoSolarState) {
  const store = createSolarStorage(createAsyncSolarRepository(mock.adapter), seed);
  await store.load();
  return { store, mock };
}
function expense(store, amount = 30, id = 'new-expense') {
  const current = view(store);
  return { id, title: 'New expense', category: 'food', amount, currency: 'GEL', rateRub: current.rate.value,
    paidBy: current.participantIds[0], splitBetween: current.participantIds, date: current.trip.startDate };
}
function addExpense(store, amount, id) {
  store.dispatch({ type: 'add-expense', expense: expense(store, amount, id), rateId: view(store).rateId });
}
function payment(overrides = {}) {
  return { id: 'payment-1', requestId: 'request-1', fromId: 'anya', toId: 'kate', amountMinor: 4000,
    currency: 'GEL', occurredAt: time, ...overrides };
}
function assertBalances(store) {
  const current = view(store);
  const cents = Object.fromEntries(Object.entries(current.balances).map(([id, value]) => [id, BigInt(moneyToCents(value, { allowZero: true, allowNegative: true }))]));
  assert.equal(Object.values(cents).reduce((sum, value) => sum + value, 0n), 0n);
  for (const transfer of computeSettlements(current.balances)) {
    const amount = BigInt(moneyToCents(transfer.amount));
    cents[transfer.from] += amount;
    cents[transfer.to] -= amount;
  }
  assert.ok(Object.values(cents).every((value) => value === 0n));
  for (const e of current.trip.expenses) {
    assert.equal(e.shares.reduce((sum, share) => sum + BigInt(share.amountMinor), 0n), BigInt(e.amountMinor));
  }
}

test('first launch creates the Georgia aggregate once and saves only the new key before ready', async () => {
  const mock = backend();
  let seeds = 0;
  const { store } = await opened(mock, () => { seeds++; return createDemoSolarState(); });
  assert.equal(store.getSnapshot().status, 'ready');
  assert.equal(mock.writes.length, 1);
  assert.equal(seeds, 1);
  const state = JSON.parse(mock.values.get(SOLAR_STORAGE_KEY));
  assert.equal(state.schemaVersion, 1);
  assert.equal(state.trips[0].expenses[0].amountMinor, 96000);
  assert.equal(state.trips[0].expenses[0].shares[0].amountMinor, 32000);
  assert.equal(state.trips[0].isDemo, true);
  assert.deepEqual(view(store).balances, { kate: 613.83, anya: -357.67, misha: -256.16 });
  assert.equal(mock.values.get(OLD_KEY), '{"existing":"must remain untouched"}');
  assert.ok(mock.reads.every((key) => key === SOLAR_STORAGE_KEY));
  assert.ok(mock.writes.every(({ key }) => key === SOLAR_STORAGE_KEY));
  await store.load();
  await opened(mock, () => { throw new Error('must not reseed'); });
  assert.equal(mock.writes.length, 1);
});

test('a second trip can be created and reopened without replacing the original trip', async () => {
  const { store, mock } = await opened();
  const trip = {
    id: 'trip-2', title: 'Another trip', countryCode: 'TR', countryName: 'Турция', flag: '🇹🇷',
    startDate: '2027-05-03', endDate: '2027-05-03', budgetMinorRub: 100000, currency: 'GEL', isDemo: false,
    participants: [{ id: 'p2', name: 'Person', role: 'organizer' }], days: [{ id: 'day2', date: '2027-05-03', stops: [] }],
    expenses: [], settlements: [], exchangeRates: [{ id: 'rate2', currency: 'GEL', quoteCurrency: 'RUB', rateRub: 32.5,
      source: 'manual', effectiveDate: '2027-05-03', obtainedAt: time }], currentRateId: 'rate2',
  };
  store.dispatch({ type: 'create-trip', trip });
  trip.title = 'External mutation';
  assert.equal(view(store).trip.title, 'Another trip');
  await store.flush();
  const reopened = (await opened(mock)).store;
  assert.equal(reopened.getSnapshot().data.trips.length, 2);
  assert.equal(view(reopened).trip.id, 'trip-2');
  reopened.dispatch({ type: 'select-trip', tripId: 'solar-georgia' });
  assert.equal(view(reopened).trip.expenses.length, 6);
});

test('adding a participant preserves historical shares and gives the new participant a zero balance', async () => {
  const { store, mock } = await opened();
  const oldExpenses = clone(view(store).trip.expenses);
  store.dispatch({ type: 'add-participant', participant: { id: 'dasha', name: 'Даша', role: 'member' } });
  assert.equal(view(store).participants.length, 4);
  assert.equal(view(store).balances.dasha, 0);
  assert.deepEqual(view(store).trip.expenses, oldExpenses);
  await store.flush();
  assert.equal(view((await opened(mock)).store).participants[3].id, 'dasha');
});

test('participants with expense history cannot be removed', async () => {
  const { store } = await opened();
  const before = store.getSnapshot();
  assert.throws(() => store.dispatch({ type: 'remove-participant', participantId: 'kate' }), /историей/);
  assert.equal(store.getSnapshot(), before);
  store.dispatch({ type: 'add-participant', participant: { id: 'free', name: 'Free', role: 'member' } });
  store.dispatch({ type: 'remove-participant', participantId: 'free' });
  assert.equal(view(store).participants.length, 3);
});

test('a participant referenced only by a cancelled payment cannot lose their financial history', async () => {
  const state = createDemoSolarState();
  state.trips[0].participants.push({ id: 'history-only', name: 'History', role: 'member' });
  state.trips[0].settlements.push({ ...payment({ fromId: 'history-only' }), status: 'cancelled', cancelledAt });
  const { store, mock } = await opened(backend(JSON.stringify(state)));
  const before = store.getSnapshot();
  assert.throws(() => store.dispatch({ type: 'remove-participant', participantId: 'history-only' }), /историей/);
  assert.equal(store.getSnapshot(), before);
  assert.equal(mock.writes.length, 0);
});

test('adding a decimal expense updates totals, remaining budget and conserved balances', async () => {
  const { store, mock } = await opened();
  addExpense(store, 12.34);
  const current = view(store);
  assert.equal(current.totalGel, 1489.84);
  assert.equal(current.totalRub, 48419.8);
  assert.equal(current.remainingRub, 311580.2);
  assert.equal(current.trip.expenses.at(-1).amountMinor, 1234);
  assertBalances(store);
  await store.flush();
  assert.equal(view((await opened(mock)).store).totalRub, 48419.8);
});

test('manual distributions and one tetri equal splits survive persistence exactly', async () => {
  const { store, mock } = await opened();
  const input = expense(store, 0.03, 'manual-expense');
  input.manualShares = { kate: 0, anya: 0.01, misha: 0.02 };
  store.dispatch({ type: 'add-expense', expense: input, rateId: view(store).rateId });
  addExpense(store, 0.01, 'one-tetri');
  await store.flush();
  const reopened = (await opened(mock)).store;
  assert.deepEqual(view(reopened).trip.expenses.at(-1).shares.map((share) => share.amountMinor), [1, 0, 0]);
  assert.deepEqual(view(reopened).ledger.expenses.at(-2).manualShares, { kate: 0, anya: 0.01, misha: 0.02 });
  assertBalances(reopened);
});

test('rate snapshots are immutable and earlier expenses keep their original rate after restart', async () => {
  const { store, mock } = await opened();
  const original = clone(view(store).trip.expenses[0]);
  store.dispatch({ type: 'set-rate', rate: { id: 'manual-rate', currency: 'GEL', quoteCurrency: 'RUB', rateRub: 31.12345678,
    source: 'manual', effectiveDate: '2027-05-03', obtainedAt: time } });
  addExpense(store, 10);
  assert.equal(view(store).trip.expenses.at(-1).exchangeRateId, 'manual-rate');
  assert.deepEqual(view(store).trip.expenses[0], original);
  await store.flush();
  const current = view((await opened(mock)).store);
  assert.equal(current.rate.value, 31.12345678);
  assert.equal(current.ledger.expenses[0].rateRub, 32.5);
  assert.equal(current.ledger.expenses.at(-1).rateRub, 31.12345678);
  assert.equal(current.trip.exchangeRates.find((r) => r.id === 'manual-rate').obtainedAt, time);
});

test('full repayment and new expenses retain the same registered payment after restart', async () => {
  const { store, mock } = await opened();
  store.dispatch({ type: 'register-settlement', request: payment({ amountMinor: 35767 }) });
  assert.equal(view(store).balances.anya, 0);
  const before = clone(view(store).trip.settlements[0]);
  addExpense(store, 30);
  await store.flush();
  const reopened = (await opened(mock)).store;
  assert.deepEqual(view(reopened).trip.settlements[0], before);
  assert.equal(view(reopened).balances.anya, -10);
  assertBalances(reopened);
});

test('partial repayment, cancellation and request deduplication remain durable', async () => {
  const { store, mock } = await opened();
  const request = payment();
  store.dispatch({ type: 'register-settlement', request });
  assert.equal(view(store).balances.anya, -317.67);
  await store.flush();
  let reopened = (await opened(mock)).store;
  let snapshot = reopened.getSnapshot();
  reopened.dispatch({ type: 'register-settlement', request: { ...request, id: 'retry-id', occurredAt: cancelledAt } });
  assert.equal(reopened.getSnapshot(), snapshot);
  reopened.dispatch({ type: 'cancel-settlement', id: request.id, cancelledAt });
  assert.equal(view(reopened).balances.anya, -357.67);
  await reopened.flush();
  reopened = (await opened(mock)).store;
  assert.equal(view(reopened).trip.settlements[0].status, 'cancelled');
  assert.equal(view(reopened).trip.settlements[0].cancelledAt, cancelledAt);
  snapshot = reopened.getSnapshot();
  reopened.dispatch({ type: 'register-settlement', request });
  reopened.dispatch({ type: 'cancel-settlement', id: request.id, cancelledAt });
  assert.equal(reopened.getSnapshot(), snapshot);
  assert.throws(() => reopened.dispatch({ type: 'register-settlement', request: { ...request, amountMinor: 3000 } }));
});

test('two distinct equal payments remain separate after reopening', async () => {
  const { store, mock } = await opened();
  store.dispatch({ type: 'register-settlement', request: payment() });
  store.dispatch({ type: 'register-settlement', request: payment({ id: 'payment-2', requestId: 'request-2' }) });
  await store.flush();
  const reopened = (await opened(mock)).store;
  assert.equal(view(reopened).trip.settlements.length, 2);
  assert.equal(view(reopened).balances.anya, -277.67);
});

test('route stops stay in their chosen day and retain their array order after restart', async () => {
  const { store, mock } = await opened();
  const day = view(store).days[4];
  for (const id of ['stop-added-1', 'stop-added-2']) store.dispatch({ type: 'add-stop', dayId: day.id,
    stop: { id, title: id, kind: 'sight', time: '—', duration: 'время уточнить' } });
  const before = clone(view(store).days);
  await store.flush();
  assert.deepEqual(view((await opened(mock)).store).days, before);
  assert.deepEqual(before[4].stops.map((stop) => stop.id), ['stop-added-1', 'stop-added-2']);
});

for (const raw of ['', '{bad', 'null', '[]', '{"schemaVersion":2}', '{"schemaVersion":1,"trips":null}']) {
  test(`invalid saved Solar bytes never trigger demo reset: ${raw}`, async () => {
    const mock = backend(raw);
    let seeds = 0;
    const { store } = await opened(mock, () => { seeds++; return createDemoSolarState(); });
    assert.equal(store.getSnapshot().status, 'error');
    assert.equal(store.getSnapshot().data, null);
    assert.equal(seeds, 0);
    assert.equal(mock.writes.length, 0);
    assert.equal(mock.values.get(SOLAR_STORAGE_KEY), raw);
    assert.throws(() => store.dispatch({ type: 'add-participant', participant: { id: 'p', name: 'P', role: 'member' } }));
    assert.equal(await store.retry(), false);
    assert.equal(mock.writes.length, 0);
    assert.equal(seeds, 0);
  });
}

const corruptions = [
  ['fractional tetri', (t) => { t.expenses[0].amountMinor = 1.5; }],
  ['inconsistent shares', (t) => { t.expenses[0].shares[0].amountMinor++; }],
  ['negative share', (t) => { t.expenses[0].shares[0].amountMinor = -1; }],
  ['wrong equal allocation', (t) => { t.expenses[0].shares[0].amountMinor++; t.expenses[0].shares[1].amountMinor--; }],
  ['unknown payer', (t) => { t.expenses[0].paidById = 'unknown'; }],
  ['unknown rate', (t) => { t.expenses[0].exchangeRateId = 'unknown'; }],
  ['invalid rate', (t) => { t.exchangeRates[0].rateRub = 0; }],
  ['missing rate timestamp', (t) => { delete t.exchangeRates[0].obtainedAt; }],
  ['duplicate participant', (t) => { t.participants.push(t.participants[0]); }],
  ['duplicate expense', (t) => { t.expenses.push(t.expenses[0]); }],
  ['missing days', (t) => { t.days = []; }],
  ['wrong day order', (t) => { t.days.reverse(); }],
  ['unknown field', (t) => { t.serverOnlyData = true; }],
  ['unknown payment participant', (t) => { t.settlements.push({ ...payment({ fromId: 'unknown' }), status: 'completed' }); }],
  ['duplicate payment request', (t) => { t.settlements.push({ ...payment(), status: 'completed' }, { ...payment({ id: 'other' }), status: 'completed' }); }],
];
for (const [name, corrupt] of corruptions) {
  test(`invalid graph blocks hydration and preserves original data: ${name}`, async () => {
    const state = createDemoSolarState();
    corrupt(state.trips[0]);
    const raw = JSON.stringify(state);
    const mock = backend(raw);
    const { store } = await opened(mock);
    assert.equal(store.getSnapshot().status, 'error');
    assert.equal(store.getSnapshot().error.kind, 'structure');
    assert.equal(mock.values.get(SOLAR_STORAGE_KEY), raw);
    assert.equal(mock.writes.length, 0);
  });
}

test('getItem failure prevents seeding and writes; safe retry restores the existing modified trip', async () => {
  const initial = createDemoSolarState();
  initial.trips[0].title = 'Previously saved title';
  const mock = backend(JSON.stringify(initial));
  mock.readError = true;
  const { store } = await opened(mock, () => { throw new Error('must not seed'); });
  assert.equal(store.getSnapshot().status, 'error');
  assert.equal(mock.writes.length, 0);
  mock.readError = false;
  assert.equal(await store.retry(), true);
  assert.equal(view(store).trip.title, 'Previously saved title');
  assert.equal(mock.writes.length, 0);
});

test('missing-key initialization cannot become ready until the initial save succeeds', async () => {
  const mock = backend();
  mock.writeError = true;
  const { store } = await opened(mock);
  assert.equal(store.getSnapshot().status, 'error');
  assert.equal(store.getSnapshot().error.kind, 'write');
  assert.throws(() => store.dispatch({ type: 'select-trip', tripId: 'solar-georgia' }));
  mock.writeError = false;
  assert.equal(await store.retry(), true);
  assert.equal(mock.reads.length, 1);
  assert.ok(mock.values.has(SOLAR_STORAGE_KEY));
});

test('write failure keeps accepted changes and retries that snapshot without reloading or reseeding', async () => {
  const { store, mock } = await opened();
  const before = mock.values.get(SOLAR_STORAGE_KEY);
  mock.writeError = true;
  store.dispatch({ type: 'add-participant', participant: { id: 'dasha', name: 'Даша', role: 'member' } });
  assert.equal(await store.flush(), false);
  assert.equal(store.getSnapshot().error.kind, 'write');
  assert.equal(view(store).participants.length, 4);
  assert.equal(mock.values.get(SOLAR_STORAGE_KEY), before);
  assert.throws(() => addExpense(store, 10));
  await store.load();
  assert.equal(view(store).participants.length, 4);
  mock.writeError = false;
  assert.equal(await store.retry(), true);
  assert.equal(mock.reads.length, 1);
  assert.equal(view((await opened(mock)).store).participants.length, 4);
});

test('slow reads reject early actions and repeated loads coalesce', async () => {
  const mock = backend();
  const read = deferred();
  mock.adapter.getItem = (key) => { mock.reads.push(key); return read.promise; };
  const store = createSolarStorage(createAsyncSolarRepository(mock.adapter), createDemoSolarState);
  const first = store.load();
  assert.equal(store.load(), first);
  assert.throws(() => store.dispatch({ type: 'select-trip', tripId: 'solar-georgia' }));
  assert.equal(mock.writes.length, 0);
  read.resolve(null);
  await first;
  assert.equal(mock.reads.length, 1);
  assert.equal(store.getSnapshot().status, 'ready');
});

test('rapid changes are serialized; a failed writer stops and recovery includes every accepted action', async () => {
  const { store, mock } = await opened();
  const write = deferred();
  mock.adapter.setItem = async (key, value) => { mock.writes.push({ key, value }); await write.promise; mock.values.set(key, value); };
  store.dispatch({ type: 'add-participant', participant: { id: 'dasha', name: 'Даша', role: 'member' } });
  await tick();
  addExpense(store, 10);
  store.dispatch({ type: 'add-stop', dayId: view(store).days[4].id,
    stop: { id: 'queued-stop', title: 'Queued', time: '—', kind: 'sight', duration: '—' } });
  assert.equal(mock.writes.length, 2); // Initial seed plus one in-flight write.
  write.reject(new Error('device full'));
  await store.flush();
  assert.equal(mock.writes.length, 2);
  mock.adapter.setItem = async (key, value) => { mock.writes.push({ key, value }); mock.values.set(key, value); };
  assert.equal(await store.retry(), true);
  const reopened = (await opened(mock)).store;
  assert.equal(view(reopened).participants.length, 4);
  assert.equal(view(reopened).trip.expenses.length, 7);
  assert.equal(view(reopened).days[4].stops[0].id, 'queued-stop');
  assertBalances(reopened);
});

test('synchronous rapid changes persist the latest aggregate without losing earlier edits', async () => {
  const { store, mock } = await opened();
  for (let i = 0; i < 20; i++) store.dispatch({ type: 'add-stop', dayId: view(store).days[4].id,
    stop: { id: `rapid-${i}`, title: `Stop ${i}`, time: '—', kind: 'sight', duration: '—' } });
  await store.flush();
  assert.equal(view((await opened(mock)).store).days[4].stops.length, 20);
  assert.equal(mock.writes.length, 2); // Initial seed, then coalesced changes.
});

test('successful slow writes never overlap and finish with every queued change', async () => {
  const { store, mock } = await opened();
  const firstWrite = deferred();
  let active = 0, maximum = 0, calls = 0;
  mock.adapter.setItem = async (key, value) => {
    active++;
    maximum = Math.max(maximum, active);
    mock.writes.push({ key, value });
    if (++calls === 1) await firstWrite.promise;
    mock.values.set(key, value);
    active--;
  };
  store.dispatch({ type: 'add-participant', participant: { id: 'queued-person', name: 'Queued', role: 'member' } });
  await tick();
  addExpense(store, 0.03);
  store.dispatch({ type: 'add-stop', dayId: view(store).days[4].id,
    stop: { id: 'queued-place', title: 'Queued', time: '—', kind: 'sight', duration: '—' } });
  await store.load(); // A remounted consumer must not hydrate over pending changes.
  assert.equal(calls, 1);
  firstWrite.resolve();
  assert.equal(await store.flush(), true);
  assert.equal(maximum, 1);
  assert.equal(calls, 2);
  assert.equal(mock.reads.length, 1);
  const reopened = (await opened(mock)).store;
  assert.equal(view(reopened).participants.at(-1).id, 'queued-person');
  assert.equal(view(reopened).trip.expenses.at(-1).amountMinor, 3);
  assert.equal(view(reopened).days[4].stops.at(-1).id, 'queued-place');
  assertBalances(reopened);
});

test('lost write acknowledgement and retry cannot duplicate a registered payment', async () => {
  const { store, mock } = await opened();
  mock.adapter.setItem = async (key, value) => {
    mock.values.set(key, value);
    throw new Error('acknowledgement lost');
  };
  const request = payment();
  store.dispatch({ type: 'register-settlement', request });
  assert.equal(await store.flush(), false);
  mock.adapter.setItem = async (key, value) => { mock.values.set(key, value); };
  assert.equal(await store.retry(), true);
  const reopened = (await opened(mock)).store;
  reopened.dispatch({ type: 'register-settlement', request });
  assert.equal(view(reopened).trip.settlements.length, 1);
  assert.equal(view(reopened).balances.anya, -317.67);
});

test('repeated opening never replaces custom participants or routes with demo defaults', async () => {
  const { store, mock } = await opened();
  store.dispatch({ type: 'add-participant', participant: { id: 'dasha', name: 'Даша', role: 'member' } });
  store.dispatch({ type: 'add-stop', dayId: view(store).days[9].id,
    stop: { id: 'last-day', title: 'Custom stop', time: '—', kind: 'sight', duration: '—' } });
  await store.flush();
  const bytes = mock.values.get(SOLAR_STORAGE_KEY);
  for (let i = 0; i < 3; i++) {
    const reopened = (await opened(mock, () => { throw new Error('do not seed'); })).store;
    assert.equal(view(reopened).participants.length, 4);
    assert.equal(view(reopened).days[9].stops[0].title, 'Custom stop');
    assert.equal(mock.values.get(SOLAR_STORAGE_KEY), bytes);
  }
});

test('mutation validation rejects unsafe data before publishing or scheduling writes', async () => {
  const { store, mock } = await opened();
  const snapshot = store.getSnapshot();
  assert.throws(() => addExpense(store, 0.004));
  assert.throws(() => store.dispatch({ type: 'add-expense', expense: { ...expense(store), paidBy: 'unknown' }, rateId: view(store).rateId }));
  assert.throws(() => store.dispatch({ type: 'add-stop', dayId: 'unknown', stop: {} }));
  assert.equal(store.getSnapshot(), snapshot);
  assert.equal(mock.writes.length, 1);
  assert.ok(Object.isFrozen(view(store).trip.participants));
  assert.throws(() => view(store).trip.participants.push({ id: 'bad' }));
});

test('independent repository implementations can replace AsyncStorage without changing store actions', async () => {
  let saved = null;
  const repository = { load: async () => saved, save: async (state) => { saved = clone(state); } };
  const store = createSolarStorage(repository, createDemoSolarState);
  await store.load();
  addExpense(store, 10);
  await store.flush();
  const reopened = createSolarStorage(repository, createDemoSolarState);
  await reopened.load();
  assert.equal(view(reopened).trip.expenses.length, 7);
});

test('100 saved/reopened financial workflows preserve exact shares, balances and request IDs', async () => {
  for (let i = 0; i < 100; i++) {
    const { store, mock } = await opened();
    addExpense(store, (i + 1) / 100);
    const request = payment({ amountMinor: 1 + i });
    store.dispatch({ type: 'register-settlement', request });
    if (i % 2) store.dispatch({ type: 'cancel-settlement', id: request.id, cancelledAt });
    await store.flush();
    const reopened = (await opened(mock)).store;
    assert.deepEqual(view(reopened).balances, view(store).balances);
    const before = reopened.getSnapshot();
    reopened.dispatch({ type: 'register-settlement', request });
    assert.equal(reopened.getSnapshot(), before);
    assertBalances(reopened);
  }
});

function screenHarness(store) {
  const states = new Map();
  let active;
  const react = { useState(initial) {
    const current = active, i = current.index++;
    if (!(i in current.values)) current.values[i] = typeof initial === 'function' ? initial() : initial;
    return [current.values[i], (value) => { current.values[i] = typeof value === 'function' ? value(current.values[i]) : value; }];
  }, useRef(initial) { return react.useState(() => ({ current: initial }))[0]; } };
  const isolated = loader({ react, 'expo-router': { router: { push: () => {} } },
    'react-native': { StyleSheet: { create: (s) => s }, View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable' },
    '@/store/solar-store': { useSolarTrip: () => ({ ...view(store), dispatch: store.dispatch }) },
    solar: new Proxy({}, { get: (_, name) => name }),
  });
  const TripScreen = isolated('src/app/demo/trip.tsx').default;
  const ExpensesScreen = isolated('src/app/demo/expenses.tsx').default;
  function render(Component, props = {}, key = Component) {
    if (!states.has(key)) states.set(key, []);
    active = { values: states.get(key), index: 0 };
    return Component(props);
  }
  function find(tree, predicate) {
    if (!tree || typeof tree !== 'object') return undefined;
    if (Array.isArray(tree)) return tree.map((child) => find(child, predicate)).find(Boolean);
    return predicate(tree) ? tree : find(tree.props?.children, predicate);
  }
  return { render, find, TripScreen, ExpensesScreen, remount: () => states.clear() };
}

test('UI: participant added in the trip appears in the expense form and survives screen remounts', async () => {
  const { store } = await opened();
  const h = screenHarness(store);
  h.find(h.render(h.TripScreen), (e) => e.props?.title === 'Пригласить участника').props.onPress();
  const participantsTab = () => {
    const e = h.find(h.render(h.TripScreen), (e) => e.type?.name === 'ParticipantsTab');
    return h.render(e.type, e.props);
  };
  h.find(participantsTab(), (e) => e.props?.placeholder === 'Имя').props.onChangeText('Даша');
  h.find(participantsTab(), (e) => e.props?.title === 'Добавить').props.onPress();
  assert.equal(view(store).participants.at(-1).name, 'Даша');
  h.remount();
  h.find(h.render(h.ExpensesScreen), (e) => e.props?.title === '+ Добавить расход').props.onPress();
  const form = h.find(h.render(h.ExpensesScreen), (e) => e.type?.name === 'ExpenseForm');
  assert.equal(form.props.participants.at(-1).name, 'Даша');
  assert.ok(h.find(h.render(form.type, form.props), (e) => e.props?.label === 'Даша'));
});

test('UI: expense form, trip summary and remaining budget all read the same updated aggregate', async () => {
  const { store, mock } = await opened();
  const h = screenHarness(store);
  h.find(h.render(h.ExpensesScreen), (e) => e.props?.title === '+ Добавить расход').props.onPress();
  const form = h.find(h.render(h.ExpensesScreen), (e) => e.type?.name === 'ExpenseForm');
  const renderForm = () => h.render(form.type, form.props);
  h.find(renderForm(), (e) => e.props?.label === 'Название').props.onChangeText('UI expense');
  h.find(renderForm(), (e) => e.props?.label === 'Сумма в местной валюте').props.onChangeText('12,34');
  h.find(renderForm(), (e) => e.props?.title === 'Сохранить расход').props.onPress();
  const mainAmount = h.find(h.render(h.ExpensesScreen), (e) => e.type === 'CurrencyAmount' && e.props?.size === 'large');
  h.find(h.render(h.TripScreen), (e) => e.type === 'Pressable' && e.props?.children?.props?.children === 'Расходы').props.onPress();
  const tab = h.find(h.render(h.TripScreen), (e) => e.type?.name === 'ExpensesTab');
  const summaryAmount = h.find(h.render(tab.type, tab.props), (e) => e.type === 'CurrencyAmount');
  assert.equal(mainAmount.props.amount, summaryAmount.props.amount);
  assert.deepEqual(mainAmount.props.converted, summaryAmount.props.converted);
  assert.equal(mainAmount.props.converted.amount, 48419.8);
  assert.equal(view(store).remainingRub, 311580.2);
  await store.flush();
  assert.equal(view((await opened(mock)).store).trip.expenses.at(-1).title, 'UI expense');
});

test('UI: route add button updates the shared day and the saved stop survives restarting', async () => {
  const { store, mock } = await opened();
  const h = screenHarness(store);
  const route = h.find(h.render(h.TripScreen), (e) => e.type?.name === 'RouteTab');
  h.find(h.render(route.type, route.props), (e) => e.props?.title === '+ Добавить место').props.onPress();
  assert.equal(view(store).days[0].stops.at(-1).title, 'Новое место');
  await store.flush();
  const reopened = (await opened(mock)).store;
  assert.equal(view(reopened).days[0].stops.at(-1).id, view(store).days[0].stops.at(-1).id);
});

test('stored object IDs and snapshots remain immutable even if a caller submits a shallow-frozen object', () => {
  const input = createDemoSolarState();
  Object.freeze(input);
  const checked = immutableSolarState(input);
  input.trips[0].participants[0].name = 'External edit';
  assert.equal(checked.trips[0].participants[0].name, 'Катя');
  assert.ok(Object.isFrozen(checked.trips[0].expenses[0].shares[0]));
});

function providerHarness(mock) {
  const effects = [];
  let mounted = false, context;
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useContext: () => context,
    useEffect: (effect) => { if (!mounted) { effects.push(effect); mounted = true; } },
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  };
  const module = loader({ react,
    '@react-native-async-storage/async-storage': mock.adapter,
    '@/components/storage-boundary': { StorageBoundary: 'StorageBoundary' },
  })('src/store/solar-store.tsx');
  const child = { type: 'SolarScreen', props: {} };
  const render = () => {
    const tree = module.SolarTripProvider({ children: child });
    context = tree.props.value;
    return { store: context, boundary: tree.props.children };
  };
  return { render, effects, child, useTrip: module.useSolarTrip };
}

test('provider exposes shared data only after hydration and deduplicates Strict Mode effect replay', async () => {
  const mock = backend();
  const read = deferred();
  mock.adapter.getItem = (key) => { mock.reads.push(key); return read.promise; };
  const h = providerHarness(mock);
  let screen = h.render();
  assert.equal(mock.reads.length, 0);
  assert.equal(screen.boundary.props.children, null);
  assert.throws(() => screen.store.dispatch({ type: 'select-trip', tripId: 'solar-georgia' }));
  h.effects[0]();
  h.effects[0]();
  await tick();
  assert.equal(mock.reads.length, 1);
  read.resolve(JSON.stringify(createDemoSolarState()));
  await screen.store.load();
  screen = h.render();
  assert.equal(screen.boundary.props.status, 'ready');
  assert.equal(screen.boundary.props.children, h.child);
  h.useTrip().dispatch({ type: 'add-participant', participant: { id: 'hook-person', name: 'Hook', role: 'member' } });
  assert.equal(h.useTrip().participants.at(-1).id, 'hook-person');
  await screen.store.flush();
});

test('provider hides corrupt data and write-error retry retains the same mounted screens', async () => {
  const mock = backend('{broken');
  const h = providerHarness(mock);
  h.render();
  h.effects[0]();
  await h.render().store.load();
  let screen = h.render();
  assert.equal(screen.boundary.props.children, null);
  assert.equal(screen.boundary.props.error.kind, 'json');
  assert.equal(mock.writes.length, 0);
  mock.values.set(SOLAR_STORAGE_KEY, JSON.stringify(createDemoSolarState()));
  screen.boundary.props.onRetry();
  await screen.store.load();
  screen = h.render();
  assert.equal(screen.boundary.props.children, h.child);
  mock.writeError = true;
  h.useTrip().dispatch({ type: 'add-participant', participant: { id: 'unsaved', name: 'Unsaved', role: 'member' } });
  await screen.store.flush();
  screen = h.render();
  assert.equal(screen.boundary.props.status, 'error');
  assert.equal(screen.boundary.props.error.kind, 'write');
  assert.equal(screen.boundary.props.children, h.child);
  mock.writeError = false;
  screen.boundary.props.onRetry();
  await screen.store.retry();
  screen = h.render();
  assert.equal(screen.boundary.props.status, 'ready');
  assert.equal(screen.boundary.props.children, h.child);
  assert.equal(h.useTrip().participants.at(-1).id, 'unsaved');
  assert.equal(mock.reads.length, 2);
});
