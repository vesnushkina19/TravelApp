/* global __dirname */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Compile existing TypeScript in memory: no new dependency, emitted file or Expo server.
function loader(overrides = {}) {
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(__dirname, '..', relative);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const source = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const run = vm.runInThisContext(`(function(require, module, exports) {${source}\n})`, { filename: file });
    run((name) => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (overrides.solar && name.startsWith('@/components/solar/')) return overrides.solar;
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

const load = loader();
const money = load('src/utils/money.ts');
const split = load('src/utils/split.ts');
const demo = load('src/data/demo/georgia-trip.ts');
const settlementDomain = load('src/domain/settlement.ts');
const settlementLedger = load('src/utils/settlement-ledger.ts');
const ids = ['a', 'b', 'c', 'd'];
const signedCents = (value) => money.moneyToCents(value, { allowZero: true, allowNegative: true });
const makeExpense = (overrides = {}, people = ids) => ({
  id: 'expense', title: 'Test', category: 'other', date: '2027-05-03',
  ...split.createExpenseFinancials({
    amount: '100', currency: 'GEL', rateRub: '32,5', paidBy: people[0], splitBetween: people,
    ...overrides,
  }, people),
});

for (const [name, amount, shares] of [
  ['B1: fractional tetri', '0,03', { a: '0,015', b: '0,015' }],
  ['B1: missing tetri', '0,03', { a: '0,01', b: '0,01' }],
  ['B2: negative share', '100', { a: '-100', b: '200' }],
]) {
  test(name, () => assert.throws(() => makeExpense({ amount, splitBetween: ['a', 'b'], manualShares: shares })));
}

for (const value of ['0,004', '1.005', '0', 0, '-1', -1, NaN, Infinity, -Infinity,
  '', ' ', 'abc', '1e2', '0x10', '1,2.3', '1 2', '1\t00', '1e308', 1e308,
  '90071992547409.92', '90071992547409.91', '9'.repeat(1000)]) {
  test(`reject invalid expense amount ${String(value).slice(0, 45)}`, () => {
    assert.throws(() => makeExpense({ amount: value }));
  });
}

for (const value of ['', 'abc', '-0.01', NaN, Infinity, '-Infinity', '1e2', '0x10', '0,001', 1e308]) {
  test(`reject invalid manual share ${String(value)}`, () => {
    assert.throws(() => makeExpense({ splitBetween: ['a', 'b'], manualShares: { a: value, b: '100' } }));
  });
}

test('decimal comma, grouping spaces and zero shares are accepted exactly', () => {
  assert.equal(money.moneyToCents('1 234,50'), 123450);
  assert.equal(money.moneyToCents('1\u202f234,50'), 123450);
  assert.equal(money.moneyToCents('1\u00a0234.50'), 123450);
  const e = makeExpense({ amount: '0,03', splitBetween: ['a', 'b'], manualShares: { a: '0', b: '0,03' } });
  assert.deepEqual(e.manualShares, { a: 0, b: 0.03 });
  assert.deepEqual(split.expenseSharesCents(e, ids), { a: 0, b: 3 });
});

test('integer money summation avoids floating-point drift', () => {
  assert.equal(money.sumMoney([0.1, 0.2]), 0.3);
  assert.throws(() => money.moneyToCents(0.1 + 0.2));
  assert.throws(() => money.moneyFromCents(1.1));
  assert.throws(() => money.moneyFromCents(Number.MAX_SAFE_INTEGER + 1));
});

test('safe boundary must survive unchanged through the existing numeric format', () => {
  const value = money.moneyToCents('90071992547409.90');
  assert.equal(value, 9007199254740990);
  assert.equal(signedCents(money.moneyFromCents(value)), value);
  assert.throws(() => money.moneyFromCents(9007199254740991n));
  assert.throws(() => money.sumMoney([money.moneyFromCents(value), 1]));
});

for (const [name, overrides, people] of [
  ['empty participants', {}, []],
  ['duplicate participants', {}, ['a', 'a']],
  ['empty participant ID', {}, ['a', ' ']],
  ['unknown payer', { paidBy: 'unknown' }, ids],
  ['empty selection', { splitBetween: [] }, ids],
  ['duplicate selection', { splitBetween: ['a', 'a'] }, ids],
  ['unknown selection', { splitBetween: ['a', 'unknown'] }, ids],
  ['missing manual key', { splitBetween: ['a', 'b'], manualShares: { a: '100' } }, ids],
  ['extra manual key', { splitBetween: ['a'], manualShares: { a: '100', b: '0' } }, ids],
  ['wrong manual key', { splitBetween: ['a'], manualShares: { b: '100' } }, ids],
]) {
  test(`reject ${name}`, () => assert.throws(() => makeExpense(overrides, people)));
}

test('empty participant list is also rejected for an empty ledger', () => {
  assert.throws(() => split.computeBalances([], []));
  assert.throws(() => split.computeExpenseTotals([], [], 32.5));
});

test('existing objects are revalidated at the calculation boundary', () => {
  const e = makeExpense();
  assert.throws(() => split.computeBalances([{ ...e, amount: 0.004 }], ids));
  assert.throws(() => split.expenseSharesCents({ ...e, splitBetween: [] }, ids));
  assert.throws(() => split.computeBalances([{ ...e, paidBy: 'unknown' }], ids));
  assert.throws(() => split.computeBalances([{ ...e, rateRub: Infinity }], ids));
});

test('0.01 GEL split between three people retains its one tetri', () => {
  const e = makeExpense({ amount: '0,01', splitBetween: ids.slice(0, 3) });
  assert.deepEqual(split.expenseSharesCents(e, ids), { a: 1, b: 0, c: 0 });
});

for (const n of [2, 3, 4]) {
  test(`equal distribution among ${n} participants`, () => {
    const people = ids.slice(0, n);
    const shares = Object.values(split.expenseSharesCents(makeExpense({ amount: '10' }, people), people));
    assert.equal(shares.reduce((sum, value) => sum + value, 0), 1000);
    assert.ok(Math.max(...shares) - Math.min(...shares) <= 1);
  });
}

test('personal expense produces no debt', () => {
  const balances = split.computeBalances([makeExpense({ paidBy: 'b', splitBetween: ['b'] })], ids);
  assert.deepEqual(balances, { a: 0, b: 0, c: 0, d: 0 });
  assert.deepEqual(split.computeSettlements(balances), []);
});

test('a subset of participants is charged even when the payer is outside it', () => {
  const balances = split.computeBalances([makeExpense({ amount: '10', paidBy: 'c', splitBetween: ['a', 'b'] })], ids);
  assert.deepEqual(balances, { a: -5, b: -5, c: 10, d: 0 });
});

for (const value of ['0', '-1', '', 'bad', 'NaN', NaN, Infinity, 'Infinity', '1e-8', '0x10',
  '0.000000001', '31.123456789', '90071993', 1e308]) {
  test(`reject invalid rate ${String(value)}`, () => assert.throws(() => money.parseRate(value)));
}

test('small rates and eight-digit rates are preserved rather than rounded to money', () => {
  for (const [input, expected] of [['0,004', 0.004], ['0.00000001', 1e-8], ['31.12345678', 31.12345678]]) {
    assert.equal(money.parseRate(input), expected);
    assert.equal(money.parseRate(expected), expected);
    assert.equal(makeExpense({ rateRub: input }).rateRub, expected);
  }
});

test('conversion uses exact multiplication and half-up kopeck rounding', () => {
  assert.equal(money.convertGelToRub(0.1, 10.05), 1.01);
  assert.equal(money.convertGelToRub(0.01, 0.5), 0.01);
  assert.equal(money.convertGelToRub(100, 0.004), 0.4);
  assert.equal(money.convertGelToRub(0.01, 1e-8), 0);
  assert.throws(() => makeExpense({ amount: '100000000', rateRub: '90000000' }));
});

test('historical rates and expense objects do not change when the current rate changes', () => {
  let current = money.parseRate('32,5');
  const first = makeExpense({ rateRub: current });
  const before = JSON.stringify(first);
  current = money.parseRate('40,12345678');
  const second = makeExpense({ rateRub: current });
  const totals = split.computeExpenseTotals([first, second], ids, current);
  assert.equal(JSON.stringify(first), before);
  assert.equal(first.rateRub, 32.5);
  assert.equal(second.rateRub, 40.12345678);
  assert.equal(totals.totalRub, 7262.35);
});

test('aggregate money and current-rate conversion overflow is rejected', () => {
  const e = makeExpense({ amount: '50000000000000', rateRub: '0.01', splitBetween: ['b'] });
  assert.throws(() => split.computeExpenseTotals([e, e], ids, 0.01));
  assert.throws(() => split.computeBalances([e, e], ids));
  assert.throws(() => split.computeExpenseTotals([e], ids, 10));
});

test('unbalanced, fractional and nonfinite settlement inputs are rejected', () => {
  for (const values of [{ a: 1, b: -0.99 }, { a: 0.001, b: -0.001 }, { a: NaN }, { a: Infinity }]) {
    assert.throws(() => split.computeSettlements(values));
  }
});

function assertLedger(expenses, people, payments = []) {
  for (const e of expenses) {
    const shares = Object.values(split.expenseSharesCents(e, people));
    assert.ok(shares.every((value) => Number.isSafeInteger(value) && value >= 0));
    assert.equal(shares.reduce((sum, value) => sum + BigInt(value), 0n), BigInt(money.moneyToCents(e.amount)));
  }
  const balances = split.computeBalances(expenses, people, payments);
  const remaining = Object.fromEntries(Object.entries(balances).map(([id, value]) => [id, BigInt(signedCents(value))]));
  assert.equal(Object.values(remaining).reduce((sum, value) => sum + value, 0n), 0n);
  const required = Object.values(remaining).filter((value) => value > 0n).reduce((sum, value) => sum + value, 0n);
  let transferred = 0n;
  for (const transfer of split.computeSettlements(balances)) {
    const value = BigInt(money.moneyToCents(transfer.amount));
    assert.ok(value > 0n);
    assert.ok(remaining[transfer.from] < 0n && remaining[transfer.to] > 0n);
    remaining[transfer.from] += value;
    remaining[transfer.to] -= value;
    transferred += value;
  }
  assert.equal(transferred, required);
  assert.ok(Object.values(remaining).every((value) => value === 0n));
}

test('original demo totals, balances and settlements remain unchanged', () => {
  const people = demo.DemoParticipants.map((person) => person.id);
  const before = JSON.stringify(demo.DemoExpenses);
  assert.deepEqual(split.computeExpenseTotals(demo.DemoExpenses, people, 32.5), { totalGel: 1477.5, totalRub: 48018.75 });
  assert.deepEqual(split.computeBalances(demo.DemoExpenses, people), { kate: 613.83, anya: -357.67, misha: -256.16 });
  assertLedger(demo.DemoExpenses, people);
  assert.equal(JSON.stringify(demo.DemoExpenses), before);
});

test('2000 deterministic generated ledgers conserve shares, balances and transfers', () => {
  let seed = 80421;
  const next = (max) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  for (let i = 0; i < 2000; i++) {
    const people = Array.from({ length: 1 + next(8) }, (_, n) => `p${n}`);
    const expenses = Array.from({ length: 1 + next(12) }, (_, n) => {
      const selected = people.filter(() => next(3) !== 0);
      if (!selected.length) selected.push(people[0]);
      const total = 1 + next(1_000_000);
      let left = total;
      const manual = Object.fromEntries(selected.map((id, index) => {
        const share = index === selected.length - 1 ? left : next(left + 1);
        left -= share;
        return [id, money.moneyFromCents(share)];
      }));
      return { ...makeExpense({
        amount: money.moneyFromCents(total), paidBy: people[next(people.length)], splitBetween: selected,
        manualShares: n % 2 ? manual : undefined,
      }, people), id: `e${n}` };
    });
    assertLedger(expenses, people);
    const old = JSON.stringify(expenses);
    split.computeBalances(expenses, [...people, 'new-person']);
    assert.equal(JSON.stringify(expenses), old);
  }
});

test('ID values resembling object prototype keys remain valid without corrupting balances', () => {
  const people = ['__proto__', 'constructor'];
  const e = makeExpense({ amount: '0.03' }, people);
  assertLedger([e], people);
});

// Exercise actual form callbacks with isolated hooks and inert native/Solar elements.
async function screenHarness() {
  const { createSolarStorage } = load('src/store/solar-storage.ts');
  const { createAsyncSolarRepository } = load('src/repositories/solar-repository.ts');
  const { createDemoSolarState } = load('src/data/demo/solar-seed.ts');
  const { getTripView } = load('src/domain/trip-finance.ts');
  let raw = null;
  const storage = createSolarStorage(createAsyncSolarRepository({
    getItem: async () => raw, setItem: async (_key, value) => { raw = value; },
  }), createDemoSolarState);
  await storage.load();
  const view = () => {
    const data = storage.getSnapshot().data;
    return getTripView(data.trips.find((trip) => trip.id === data.activeTripId));
  };
  const states = new Map();
  let active;
  const react = { useState(initial) {
    const current = active;
    const index = current.index++;
    if (!(index in current.values)) current.values[index] = typeof initial === 'function' ? initial() : initial;
    return [current.values[index], (value) => {
      current.values[index] = typeof value === 'function' ? value(current.values[index]) : value;
    }];
  }, useReducer(reducer, initial) {
    const [value, setValue] = react.useState(initial);
    return [value, (action) => setValue((state) => reducer(state, action))];
  }, useRef(initial) {
    return react.useState(() => ({ current: initial }))[0];
  } };
  const isolated = loader({ react, '@/store/solar-store': { useSolarTrip: () => ({ ...view(), dispatch: storage.dispatch }) }, 'react-native': { StyleSheet: { create: (s) => s }, ScrollView: 'ScrollView', View: 'View' },
    solar: new Proxy({}, { get: (_, name) => name }) });
  const Screen = isolated('src/app/demo/expenses.tsx').default;
  const render = (Component, props = {}, instance = Component) => {
    if (!states.has(instance)) states.set(instance, []);
    active = { values: states.get(instance), index: 0 };
    return Component(props);
  };
  const find = (tree, predicate) => {
    if (!tree || typeof tree !== 'object') return undefined;
    if (Array.isArray(tree)) return tree.map((child) => find(child, predicate)).find(Boolean);
    return predicate(tree) ? tree : find(tree.props?.children, predicate);
  };
  return { Screen, render, find, getLedger: () => view().ledger };
}

test('the existing expense form shows an error and never saves fractional manual shares', async () => {
  const h = await screenHarness();
  let root = h.render(h.Screen);
  h.find(root, (e) => e.props?.title === '+ Добавить расход').props.onPress();
  root = h.render(h.Screen);
  const form = h.find(root, (e) => e.type?.name === 'ExpenseForm');
  let saved = 0;
  const props = { ...form.props, onSave: () => { saved++; } };
  const render = () => h.render(form.type, props);
  h.find(render(), (e) => e.props?.label === 'Название').props.onChangeText('Test');
  h.find(render(), (e) => e.props?.label === 'Сумма в местной валюте').props.onChangeText('0,03');
  h.find(render(), (e) => e.props?.value === 'equal').props.onChange('manual');
  h.find(render(), (e) => e.props?.label === 'Катя' && e.type === 'TextField').props.onChangeText('0,015');
  h.find(render(), (e) => e.props?.label === 'Аня' && e.type === 'TextField').props.onChangeText('0,015');
  h.find(render(), (e) => e.props?.label === 'Миша' && e.type === 'TextField').props.onChangeText('0');
  h.find(render(), (e) => e.props?.title === 'Сохранить расход').props.onPress();
  assert.equal(saved, 0);
  assert.ok(h.find(render(), (e) => e.props?.accessibilityRole === 'alert'));
});

test('the existing rate card preserves a small rate and disables invalid rates', async () => {
  const h = await screenHarness();
  const card = h.find(h.render(h.Screen), (e) => e.type?.name === 'RateCard');
  let applied;
  const props = { ...card.props, onChange: (rate) => { applied = rate; } };
  const render = () => h.render(card.type, props);
  h.find(render(), (e) => e.props?.title === 'Указать свой курс').props.onPress();
  h.find(render(), (e) => e.props?.label === 'Свой курс, ₽ за 1 GEL').props.onChangeText('1e308');
  assert.equal(h.find(render(), (e) => e.props?.title === 'Применить').props.disabled, true);
  h.find(render(), (e) => e.props?.label === 'Свой курс, ₽ за 1 GEL').props.onChangeText('0,004');
  assert.equal(h.find(render(), (e) => e.props?.title === 'Применить').props.disabled, false);
  h.find(render(), (e) => e.props?.title === 'Применить').props.onPress();
  assert.equal(applied.value, 0.004);
});

test('valid decimal manual shares are saved through the existing form and parent handler', async () => {
  const h = await screenHarness();
  h.find(h.render(h.Screen), (e) => e.props?.title === '+ Добавить расход').props.onPress();
  const form = h.find(h.render(h.Screen), (e) => e.type?.name === 'ExpenseForm');
  const render = () => h.render(form.type, form.props);
  h.find(render(), (e) => e.props?.label === 'Название').props.onChangeText('Valid expense');
  h.find(render(), (e) => e.props?.label === 'Сумма в местной валюте').props.onChangeText('0,03');
  h.find(render(), (e) => e.props?.value === 'equal').props.onChange('manual');
  for (const [name, value] of [['Катя', '0'], ['Аня', '0,01'], ['Миша', '0,02']]) {
    h.find(render(), (e) => e.props?.label === name && e.type === 'TextField').props.onChangeText(value);
  }
  h.find(render(), (e) => e.props?.title === 'Сохранить расход').props.onPress();
  const root = h.render(h.Screen);
  const saved = h.find(root, (e) => e.props?.expense?.title === 'Valid expense').props.expense;
  assert.equal(saved.amount, 0.03);
  assert.deepEqual(saved.manualShares, { kate: 0, anya: 0.01, misha: 0.02 });
  assert.ok(h.find(root, (e) => e.props?.title === '+ Добавить расход'));
});

test('a parent financial validation error is shown in the existing form', async () => {
  const h = await screenHarness();
  h.find(h.render(h.Screen), (e) => e.props?.title === '+ Добавить расход').props.onPress();
  const form = h.find(h.render(h.Screen), (e) => e.type?.name === 'ExpenseForm');
  const props = { ...form.props, onSave: () => { throw new Error('Сумма: превышен безопасный диапазон'); } };
  const render = () => h.render(form.type, props);
  h.find(render(), (e) => e.props?.label === 'Название').props.onChangeText('Test');
  h.find(render(), (e) => e.props?.label === 'Сумма в местной валюте').props.onChangeText('10');
  h.find(render(), (e) => e.props?.title === 'Сохранить расход').props.onPress();
  assert.equal(h.find(render(), (e) => e.props?.accessibilityRole === 'alert').props.children,
    'Сумма: превышен безопасный диапазон');
});

const operationTime = '2027-05-03T10:00:00.000Z';
const cancellationTime = '2027-05-03T11:00:00.000Z';
const request = (overrides = {}) => ({
  id: 'payment-1', requestId: 'request-1', fromId: 'b', toId: 'a', amountMinor: 10000,
  currency: 'GEL', occurredAt: operationTime, ...overrides,
});
const debtLedger = () => ({
  expenses: [makeExpense({ amount: '100', paidBy: 'a', splitBetween: ['b'] })], settlements: [],
});
const balancesOf = (ledger, people = ids) => split.computeBalances(ledger.expenses, people, ledger.settlements);

test('B4: full repayment changes balances and removes the recommendation', () => {
  const original = debtLedger();
  const paid = settlementLedger.registerSettlement(original, request(), ids);
  assert.deepEqual(balancesOf(paid), { a: 0, b: 0, c: 0, d: 0 });
  assert.deepEqual(split.computeSettlements(balancesOf(paid)), []);
  assert.deepEqual(paid.settlements[0], { ...request(), status: 'completed' });
  assert.equal(original.settlements.length, 0);
});

test('B4: paying 40 GEL against 100 leaves 60 GEL owed', () => {
  const partial = settlementLedger.registerSettlement(debtLedger(), request({ amountMinor: 4000 }), ids);
  assert.deepEqual(balancesOf(partial), { a: 60, b: -60, c: 0, d: 0 });
  assert.deepEqual(split.computeSettlements(balancesOf(partial)), [{ from: 'b', to: 'a', amount: 60 }]);
  const full = settlementLedger.registerSettlement(partial, request({
    id: 'payment-2', requestId: 'request-2', amountMinor: 6000,
  }), ids);
  assert.equal(full.settlements.length, 2);
  assertLedger(full.expenses, ids, full.settlements);
  assert.deepEqual(split.computeSettlements(balancesOf(full)), []);
});

test('B4: new expenses preserve payment identity, amount and historical effect', () => {
  const paid = settlementLedger.registerSettlement(debtLedger(), request(), ids);
  const payment = paid.settlements[0];
  const state = settlementLedger.reduceFinancialLedger({ ...paid, error: null }, {
    type: 'add-expense', expense: makeExpense({ amount: '30', paidBy: 'a', splitBetween: ['b'] }), displayRate: 32.5,
  }, ids);
  assert.equal(state.error, null);
  assert.equal(state.settlements[0], payment);
  assert.deepEqual(balancesOf(state), { a: 30, b: -30, c: 0, d: 0 });
  assert.deepEqual(split.computeExpenseTotals(state.expenses, ids, 32.5, state.settlements), { totalGel: 130, totalRub: 4225 });
});

test('payments never increase the spending total or alter expense rates', () => {
  const original = debtLedger();
  const snapshot = JSON.stringify(original.expenses);
  const paid = settlementLedger.registerSettlement(original, request(), ids);
  assert.deepEqual(split.computeExpenseTotals(paid.expenses, ids, 40, paid.settlements), { totalGel: 100, totalRub: 3250 });
  assert.equal(JSON.stringify(paid.expenses), snapshot);
});

test('cancellation retains the original event and timestamp and restores the debt exactly', () => {
  const paid = settlementLedger.registerSettlement(debtLedger(), request({ amountMinor: 4000 }), ids);
  const original = paid.settlements[0];
  const cancelled = settlementLedger.cancelSettlement(paid, original.id, cancellationTime, ids);
  assert.equal(cancelled.settlements.length, 1);
  assert.deepEqual(cancelled.settlements[0], { ...original, status: 'cancelled', cancelledAt: cancellationTime });
  assert.deepEqual(balancesOf(cancelled), { a: 100, b: -100, c: 0, d: 0 });
  assert.equal(original.status, 'completed');
  assert.equal(original.cancelledAt, undefined);
  assert.equal(settlementLedger.cancelSettlement(cancelled, original.id, cancellationTime, ids), cancelled);
});

test('cancelling one of multiple payments reverses only that payment', () => {
  let ledger = settlementLedger.registerSettlement(debtLedger(), request({ amountMinor: 4000 }), ids);
  ledger = settlementLedger.registerSettlement(ledger, request({ id: 'payment-2', requestId: 'request-2', amountMinor: 4000 }), ids);
  ledger = settlementLedger.cancelSettlement(ledger, 'payment-1', cancellationTime, ids);
  assert.deepEqual(balancesOf(ledger), { a: 60, b: -60, c: 0, d: 0 });
  assert.equal(ledger.settlements[1].status, 'completed');
});

test('retry with the same request ID is a no-op even after full repayment', () => {
  const paid = settlementLedger.registerSettlement(debtLedger(), request(), ids);
  const retried = settlementLedger.registerSettlement(paid, request({ id: 'retry-generated-id', occurredAt: cancellationTime }), ids);
  assert.equal(retried, paid);
  assert.equal(retried.settlements.length, 1);
  assert.equal(retried.settlements[0].id, 'payment-1');
  assert.equal(retried.settlements[0].occurredAt, operationTime);
});

test('retry after cancellation never reactivates the payment', () => {
  const paid = settlementLedger.registerSettlement(debtLedger(), request(), ids);
  const cancelled = settlementLedger.cancelSettlement(paid, 'payment-1', cancellationTime, ids);
  assert.equal(settlementLedger.registerSettlement(cancelled, request(), ids), cancelled);
  assert.deepEqual(balancesOf(cancelled), { a: 100, b: -100, c: 0, d: 0 });
});

test('a different request can pay again after cancellation', () => {
  let ledger = settlementLedger.registerSettlement(debtLedger(), request(), ids);
  ledger = settlementLedger.cancelSettlement(ledger, 'payment-1', cancellationTime, ids);
  ledger = settlementLedger.registerSettlement(ledger, request({ id: 'payment-2', requestId: 'request-2' }), ids);
  assert.equal(ledger.settlements.length, 2);
  assert.deepEqual(split.computeSettlements(balancesOf(ledger)), []);
});

test('distinct payments with the same participants and amount remain distinct', () => {
  const first = settlementLedger.registerSettlement(debtLedger(), request({ amountMinor: 4000 }), ids);
  const second = settlementLedger.registerSettlement(first, request({ id: 'payment-2', requestId: 'request-2', amountMinor: 4000 }), ids);
  assert.equal(second.settlements.length, 2);
  assert.deepEqual(balancesOf(second), { a: 20, b: -20, c: 0, d: 0 });
});

for (const overrides of [
  { amountMinor: 0 }, { amountMinor: -1 }, { amountMinor: 1.5 }, { amountMinor: NaN },
  { amountMinor: Infinity }, { amountMinor: '100' }, { amountMinor: Number.MAX_SAFE_INTEGER + 1 },
  { amountMinor: Number.MAX_SAFE_INTEGER }, { fromId: 'unknown' }, { toId: 'unknown' },
  { fromId: 'a', toId: 'a' }, { currency: 'RUB' }, { id: '' }, { requestId: '' },
  { occurredAt: 'invalid' }, { occurredAt: '2027-02-31T10:00:00.000Z' },
]) {
  test(`invalid payment rejected: ${JSON.stringify(overrides)}`, () => {
    assert.throws(() => settlementDomain.createSettlement(request(overrides), ids));
    assert.throws(() => settlementLedger.registerSettlement(debtLedger(), request(overrides), ids));
  });
}

test('empty or duplicate participant IDs are rejected for payments', () => {
  for (const people of [[], ['a', 'a', 'b'], ['a', 'b', ' ']]) {
    assert.throws(() => settlementDomain.createSettlement(request(), people));
  }
});

test('overspending and transfers in the wrong direction are rejected', () => {
  assert.throws(() => settlementLedger.registerSettlement(debtLedger(), request({ amountMinor: 10001 }), ids));
  assert.throws(() => settlementLedger.registerSettlement(debtLedger(), request({ fromId: 'a', toId: 'b' }), ids));
  assert.throws(() => settlementLedger.registerSettlement(debtLedger(), request({ fromId: 'c' }), ids));
  assert.throws(() => settlementLedger.registerSettlement(debtLedger(), request({ toId: 'c' }), ids));
});

test('a payment is capped by the recipient as well as the sender', () => {
  const ledger = { expenses: [
    makeExpense({ amount: '40', paidBy: 'a', splitBetween: ['b'] }),
    makeExpense({ amount: '60', paidBy: 'c', splitBetween: ['b'] }),
  ], settlements: [] };
  assert.throws(() => settlementLedger.registerSettlement(ledger, request({ amountMinor: 5000 }), ids));
  const next = settlementLedger.registerSettlement(ledger, request({ amountMinor: 4000 }), ids);
  assert.deepEqual(balancesOf(next), { a: 0, b: -60, c: 60, d: 0 });
});

test('request ID reuse with a different intent and operation ID collisions are rejected', () => {
  const ledger = settlementLedger.registerSettlement(debtLedger(), request({ amountMinor: 4000 }), ids);
  assert.throws(() => settlementLedger.registerSettlement(ledger, request({ amountMinor: 3000 }), ids));
  assert.throws(() => settlementLedger.registerSettlement(ledger, request({ id: 'payment-1', requestId: 'request-2', amountMinor: 4000 }), ids));
  assert.throws(() => settlementLedger.registerSettlement(ledger, request({ toId: 'c', amountMinor: 4000 }), ids));
  assert.equal(ledger.settlements.length, 1);
});

test('exact journal replays count once, conflicting journal events are rejected', () => {
  const operation = settlementDomain.createSettlement(request({ amountMinor: 4000 }), ids);
  const ledger = debtLedger();
  assert.deepEqual(split.computeBalances(ledger.expenses, ids, [operation, { ...operation }]), { a: 60, b: -60, c: 0, d: 0 });
  for (const duplicate of [
    { ...operation, amountMinor: 3000 }, { ...operation, requestId: 'other' }, { ...operation, id: 'other' },
    { ...operation, status: 'cancelled', cancelledAt: cancellationTime },
  ]) assert.throws(() => split.computeBalances(ledger.expenses, ids, [operation, duplicate]));
});

test('unknown statuses, invalid cancellations and unknown operations are rejected', () => {
  const paid = settlementLedger.registerSettlement(debtLedger(), request(), ids);
  for (const malformed of [
    { ...paid.settlements[0], status: 'pending' },
    { ...paid.settlements[0], cancelledAt: cancellationTime },
    { ...paid.settlements[0], status: 'cancelled' },
    { ...paid.settlements[0], status: 'cancelled', cancelledAt: '2027-05-01T00:00:00.000Z' },
  ]) assert.throws(() => split.computeBalances(paid.expenses, ids, [malformed]));
  assert.throws(() => settlementLedger.cancelSettlement(paid, 'missing', cancellationTime, ids));
  assert.throws(() => settlementLedger.cancelSettlement(paid, 'payment-1', 'bad', ids));
  assert.throws(() => settlementLedger.cancelSettlement(paid, 'payment-1', '2027-05-01T00:00:00.000Z', ids));
});

test('integer balance overflow from an incoming payment journal is rejected', () => {
  const operation = settlementDomain.createSettlement(request({ amountMinor: 5000000000000000 }), ids);
  assert.throws(() => split.computeBalances([], ids, [operation, { ...operation, id: 'payment-2', requestId: 'request-2' }]));
});

test('queued duplicate and overpaying actions are validated atomically with no partial state changes', () => {
  const initial = { ...debtLedger(), error: null };
  const action = { type: 'register-settlement', request: request({ amountMinor: 6000 }), displayRate: 32.5 };
  const first = settlementLedger.reduceFinancialLedger(initial, action, ids);
  const duplicate = settlementLedger.reduceFinancialLedger(first, action, ids);
  assert.equal(duplicate, first);
  const overpay = settlementLedger.reduceFinancialLedger(duplicate, {
    ...action, request: request({ id: 'payment-2', requestId: 'request-2', amountMinor: 6000 }),
  }, ids);
  assert.ok(overpay.error);
  assert.equal(overpay.settlements, first.settlements);
  assert.deepEqual(balancesOf(overpay), { a: 40, b: -40, c: 0, d: 0 });
  assert.equal(initial.settlements.length, 0);
});

test('reducer is deterministic and cancelled events are replay-safe', () => {
  const initial = { ...debtLedger(), error: null };
  const action = { type: 'register-settlement', request: request(), displayRate: 32.5 };
  const first = settlementLedger.reduceFinancialLedger(initial, action, ids);
  assert.deepEqual(settlementLedger.reduceFinancialLedger(initial, action, ids), first);
  const cancel = { type: 'cancel-settlement', id: 'payment-1', cancelledAt: cancellationTime, displayRate: 32.5 };
  const cancelled = settlementLedger.reduceFinancialLedger(first, cancel, ids);
  assert.equal(settlementLedger.reduceFinancialLedger(cancelled, cancel, ids), cancelled);
  assert.equal(settlementLedger.reduceFinancialLedger(cancelled, action, ids), cancelled);
  assert.equal(cancelled.settlements[0].status, 'cancelled');
});

test('300 generated workflows conserve balances through payments, retries, new expenses and cancellation', () => {
  let seed = 20261028;
  const next = (max) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  for (let sample = 0; sample < 300; sample++) {
    const people = Array.from({ length: 2 + next(4) }, (_, i) => `p${i}`);
    let ledger = { expenses: [makeExpense({ amount: money.moneyFromCents(1 + next(100000)) }, people)], settlements: [] };
    for (let step = 0; step < 8; step++) {
      const time = new Date(Date.UTC(2027, 4, 3, 10, 0, step)).toISOString();
      const active = ledger.settlements.filter((operation) => operation.status === 'completed');
      if (step % 4 === 3 && active.length) {
        const operation = active[next(active.length)];
        ledger = settlementLedger.cancelSettlement(ledger, operation.id, time, people);
      } else if (step === 4) {
        const state = settlementLedger.reduceFinancialLedger({ ...ledger, error: null }, {
          type: 'add-expense', expense: makeExpense({ amount: '12.34' }, people), displayRate: 32.5,
        }, people);
        assert.equal(state.error, null);
        ledger = state;
      } else {
        const choices = split.computeSettlements(balancesOf(ledger, people));
        if (choices.length) {
          const choice = choices[next(choices.length)];
          const limit = money.moneyToCents(choice.amount);
          const command = request({ id: `p-${sample}-${step}`, requestId: `r-${sample}-${step}`,
            fromId: choice.from, toId: choice.to, amountMinor: 1 + next(limit), occurredAt: time });
          ledger = settlementLedger.registerSettlement(ledger, command, people);
          assert.equal(settlementLedger.registerSettlement(ledger, command, people), ledger);
        }
      }
      assertLedger(ledger.expenses, people, ledger.settlements);
    }
  }
});

function controlsFor(h, sender = 'anya') {
  const root = h.render(h.Screen);
  const element = h.find(root, (e) => e.type?.name === 'PaymentControls' && e.props.suggestion.from === sender);
  assert.ok(element, `expected an outstanding recommendation for ${sender}`);
  return h.render(element.type, element.props, `${element.props.suggestion.from}->${element.props.suggestion.to}`);
}

test('UI: full repayment and a rapid repeated click create one operation and update history', async () => {
  const h = await screenHarness();
  const button = h.find(controlsFor(h), (e) => e.props?.title === 'Отметить погашенным');
  button.props.onPress();
  button.props.onPress();
  const ledger = h.getLedger();
  assert.equal(ledger.settlements.length, 1);
  assert.equal(ledger.settlements[0].amountMinor, 35767);
  const people = demo.DemoParticipants.map((person) => person.id);
  assert.equal(balancesOf(ledger, people).anya, 0);
  const root = h.render(h.Screen);
  assert.equal(h.find(root, (e) => e.type?.name === 'PaymentControls' && e.props.suggestion.from === 'anya'), undefined);
  assert.ok(h.find(root, (e) => e.props?.title === 'История переводов'));
  assert.ok(h.find(root, (e) => e.props?.children === '✓ Перевод учтён'));
});

test('UI: two intentional partial payments of the same amount remain separate; a rapid repeat does not', async () => {
  const h = await screenHarness();
  for (let attempt = 0; attempt < 2; attempt++) {
    h.find(controlsFor(h), (e) => e.props?.title === 'Погасить часть').props.onPress();
    h.find(controlsFor(h), (e) => e.props?.label === 'Сумма погашения').props.onChangeText('40,00');
    const save = h.find(controlsFor(h), (e) => e.props?.title === 'Записать перевод');
    save.props.onPress();
    save.props.onPress();
    assert.equal(h.getLedger().settlements.length, attempt + 1);
  }
  const ledger = h.getLedger();
  assert.equal(ledger.settlements[0].amountMinor, 4000);
  assert.equal(ledger.settlements[1].amountMinor, 4000);
  assert.notEqual(ledger.settlements[0].id, ledger.settlements[1].id);
  assert.notEqual(ledger.settlements[0].requestId, ledger.settlements[1].requestId);
  assert.equal(balancesOf(ledger, demo.DemoParticipants.map((p) => p.id)).anya, -277.67);
});

test('UI: invalid or excessive partial payments show an error and do not change the ledger', async () => {
  const h = await screenHarness();
  h.find(controlsFor(h), (e) => e.props?.title === 'Погасить часть').props.onPress();
  for (const value of ['', '0', '-1', '0,015', 'NaN', 'Infinity', '1e2', '1000']) {
    h.find(controlsFor(h), (e) => e.props?.label === 'Сумма погашения').props.onChangeText(value);
    h.find(controlsFor(h), (e) => e.props?.title === 'Записать перевод').props.onPress();
    assert.equal(h.getLedger().settlements.length, 0);
    assert.ok(h.find(controlsFor(h), (e) => e.props?.accessibilityRole === 'alert'));
  }
});

test('UI: cancellation is replay-safe, retains history and restores the recommendation', async () => {
  const h = await screenHarness();
  h.find(controlsFor(h), (e) => e.props?.title === 'Отметить погашенным').props.onPress();
  const paid = h.getLedger().settlements[0];
  const cancel = h.find(h.render(h.Screen), (e) => e.props?.title === 'Отменить перевод');
  cancel.props.onPress();
  cancel.props.onPress();
  const root = h.render(h.Screen);
  const ledger = h.getLedger();
  assert.equal(ledger.settlements.length, 1);
  assert.equal(ledger.settlements[0].id, paid.id);
  assert.equal(ledger.settlements[0].occurredAt, paid.occurredAt);
  assert.equal(ledger.settlements[0].status, 'cancelled');
  assert.ok(ledger.settlements[0].cancelledAt);
  assert.equal(h.find(root, (e) => e.props?.title === 'Перевод отменён').props.disabled, true);
  assert.equal(h.find(root, (e) => e.type?.name === 'PaymentControls' && e.props.suggestion.from === 'anya').props.suggestion.amount, 357.67);
});

test('UI: all repayments clear the balances, while recording a new expense retains both payments', async () => {
  const h = await screenHarness();
  h.find(controlsFor(h, 'anya'), (e) => e.props?.title === 'Отметить погашенным').props.onPress();
  h.find(controlsFor(h, 'misha'), (e) => e.props?.title === 'Отметить погашенным').props.onPress();
  const paid = h.getLedger().settlements;
  let root = h.render(h.Screen);
  assert.ok(h.find(root, (e) => e.props?.children === 'Все в расчёте 🎉'));
  h.find(root, (e) => e.props?.title === '+ Добавить расход').props.onPress();
  root = h.render(h.Screen);
  const form = h.find(root, (e) => e.type?.name === 'ExpenseForm');
  const render = () => h.render(form.type, form.props);
  h.find(render(), (e) => e.props?.label === 'Название').props.onChangeText('After payments');
  h.find(render(), (e) => e.props?.label === 'Сумма в местной валюте').props.onChangeText('30');
  h.find(render(), (e) => e.props?.title === 'Сохранить расход').props.onPress();
  const ledger = h.getLedger();
  assert.equal(ledger.settlements, paid);
  assert.equal(ledger.settlements.length, 2);
  assert.equal(ledger.expenses.length, demo.DemoExpenses.length + 1);
  assert.deepEqual(balancesOf(ledger, ['kate', 'anya', 'misha']), { kate: 20, anya: -10, misha: -10 });
});
