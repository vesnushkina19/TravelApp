import { useReducer, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/solar/app-button';
import { AppCard } from '@/components/solar/app-card';
import { CurrencyAmount } from '@/components/solar/currency-amount';
import { DemoNotice } from '@/components/solar/demo-notice';
import { ExpenseItem } from '@/components/solar/expense-item';
import { FilterChip } from '@/components/solar/filter-chip';
import { ParticipantAvatar } from '@/components/solar/participant-avatar';
import { ProgressBar } from '@/components/solar/progress-bar';
import { SectionHeader } from '@/components/solar/section-header';
import { SegmentedControl } from '@/components/solar/segmented-control';
import { SolarScreen } from '@/components/solar/solar-screen';
import { SolarText } from '@/components/solar/solar-text';
import { TextField } from '@/components/solar/text-field';
import { Solar, SolarRadius, SolarSpace } from '@/constants/solar';
import {
  DEMO_RATE_RUB_PER_GEL,
  DemoExpenses,
  DemoParticipants,
  DemoTrip,
  DemoTripDates,
  ExpenseCategories,
  formatDay,
  type Expense,
  type ExpenseCategory,
} from '@/data/demo/georgia-trip';
import type { SettlementRequest } from '@/domain/settlement';
import {
  convertGelToRub, financialResult, formatMoney, moneyFromCents, moneyToCents, newId, parseRate,
  RATE_DECIMALS, sumMoney,
} from '@/utils/money';
import {
  reduceFinancialLedger, registerSettlement, type FinancialLedgerState, type LedgerAction,
} from '@/utils/settlement-ledger';
import {
  computeBalances, computeExpenseTotals, computeSettlements, createExpenseFinancials, type SettlementSuggestion,
} from '@/utils/split';

const participants = DemoParticipants;
const participantIds = participants.map((p) => p.id);
const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? id;
const indexOf = (id: string) => participantIds.indexOf(id);

type Rate = { kind: 'demo' | 'manual'; value: number; setAt?: string };
const ledgerReducer = (state: FinancialLedgerState, action: LedgerAction) =>
  reduceFinancialLedger(state, action, participantIds);

export default function ExpensesScreen() {
  const [ledger, dispatch] = useReducer(ledgerReducer, { expenses: DemoExpenses, settlements: [], error: null });
  const { expenses, settlements: payments } = ledger;
  const [rate, setRate] = useState<Rate>({ kind: 'demo', value: DEMO_RATE_RUB_PER_GEL });
  const [formOpen, setFormOpen] = useState(false);

  const { totalGel, totalRub } = computeExpenseTotals(expenses, participantIds, rate.value, payments);
  const remainingRub = moneyFromCents(
    moneyToCents(DemoTrip.budgetRub) - moneyToCents(totalRub, { allowZero: true }),
  );

  const balances = computeBalances(expenses, participantIds, payments);
  const recommendations = computeSettlements(balances);

  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <SolarScreen>
      <View style={styles.header}>
        <SolarText variant="title">Расходы компании</SolarText>
        <SolarText secondary>
          {DemoTrip.flag} {DemoTrip.title} · {formatDay(DemoTrip.startDate)} — {formatDay(DemoTrip.endDate)}
        </SolarText>
      </View>

      <DemoNotice text="Суммы и курс условные — это не реальные финансовые сведения." />

      <AppCard tone="navy">
        <SolarText variant="caption" color={Solar.sky}>
          Потрачено всего
        </SolarText>
        <CurrencyAmount
          amount={totalGel}
          currency="GEL"
          converted={{ amount: totalRub, currency: 'RUB' }}
          size="large"
          color={Solar.white}
        />
        <ProgressBar value={totalRub / DemoTrip.budgetRub} trackColor="rgba(216, 238, 244, 0.25)" />
        <View style={styles.budgetRow}>
          <View style={styles.flex}>
            <SolarText variant="caption" color={Solar.sky}>
              Бюджет
            </SolarText>
            <SolarText variant="bodyStrong" color={Solar.white} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(DemoTrip.budgetRub, 'RUB')}
            </SolarText>
          </View>
          <View style={[styles.flex, styles.alignEnd]}>
            <SolarText variant="caption" color={Solar.sky}>
              {remainingRub >= 0 ? 'Остаток' : 'Перерасход'}
            </SolarText>
            <SolarText
              variant="bodyStrong"
              color={remainingRub >= 0 ? Solar.white : Solar.orange}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {formatMoney(Math.abs(remainingRub), 'RUB')}
            </SolarText>
          </View>
        </View>
        <SolarText variant="caption" color={Solar.sky}>
          Использовано {Math.round((totalRub / DemoTrip.budgetRub) * 100)}% бюджета
        </SolarText>
      </AppCard>

      <RateCard
        rate={rate}
        onChange={setRate}
        validateRate={(value) => { computeExpenseTotals(expenses, participantIds, value, payments); }}
      />

      {formOpen ? (
        <ExpenseForm
          rate={rate.value}
          onCancel={() => setFormOpen(false)}
          onSave={(e) => {
            const next = [...expenses, e];
            computeExpenseTotals(next, participantIds, rate.value, payments);
            dispatch({ type: 'add-expense', expense: e, displayRate: rate.value });
            setFormOpen(false);
          }}
        />
      ) : (
        <AppButton title="+ Добавить расход" onPress={() => setFormOpen(true)} />
      )}

      <SectionHeader title="История" subtitle={`${expenses.length} расходов`} />
      <AppCard>
        {sorted.length === 0 ? (
          <SolarText variant="caption" secondary style={styles.center}>
            Расходов пока нет
          </SolarText>
        ) : (
          sorted.map((e, i) => (
            <View key={e.id} style={i > 0 && styles.divider}>
              <ExpenseItem expense={e} payerName={nameOf(e.paidBy)} />
            </View>
          ))
        )}
      </AppCard>

      <SectionHeader title="Баланс участников" subtitle="С учётом расходов и зарегистрированных переводов" />
      <AppCard>
        {participants.map((p, i) => {
          const balance = balances[p.id] ?? 0;
          const paid = sumMoney(expenses.filter((e) => e.paidBy === p.id).map((e) => e.amount));
          return (
            <View key={p.id} style={[styles.row, i > 0 && styles.divider]}>
              <ParticipantAvatar name={p.name} index={i} size={40} />
              <View style={styles.flex}>
                <SolarText variant="bodyStrong" numberOfLines={1}>
                  {p.name}
                </SolarText>
                <SolarText variant="caption" secondary>
                  оплачено {formatMoney(paid, 'GEL')}
                </SolarText>
              </View>
              <View style={styles.alignEnd}>
                <SolarText variant="bodyStrong" numberOfLines={1}>
                  {balance > 0 ? '+' : balance < 0 ? '−' : ''}
                  {formatMoney(Math.abs(balance), 'GEL')}
                </SolarText>
                <SolarText variant="caption" secondary>
                  {balance > 0 ? 'к получению' : balance < 0 ? 'к оплате' : 'в расчёте'}
                </SolarText>
              </View>
            </View>
          );
        })}
      </AppCard>

      <SectionHeader title="Кто кому должен" subtitle="Минимум переводов, чтобы все были в расчёте" />
      <AppCard>
        {recommendations.length === 0 ? (
          <SolarText variant="caption" secondary style={styles.center}>
            Все в расчёте 🎉
          </SolarText>
        ) : (
          recommendations.map((s, i) => {
            return (
              <View key={JSON.stringify([s.from, s.to])} style={[styles.debt, i > 0 && styles.divider]}>
                <View style={styles.row}>
                  <ParticipantAvatar name={nameOf(s.from)} index={indexOf(s.from)} size={32} />
                  <SolarText variant="heading" secondary>
                    →
                  </SolarText>
                  <ParticipantAvatar name={nameOf(s.to)} index={indexOf(s.to)} size={32} />
                  <View style={styles.flex}>
                    <SolarText variant="bodyStrong" numberOfLines={1}>
                      {nameOf(s.from)} → {nameOf(s.to)}
                    </SolarText>
                  </View>
                  <CurrencyAmount
                    amount={s.amount}
                    currency="GEL"
                    converted={{ amount: convertGelToRub(s.amount, rate.value), currency: 'RUB' }}
                    size="small"
                    align="right"
                  />
                </View>
                <PaymentControls
                  suggestion={s}
                  ledger={ledger}
                  onRegister={(request) => dispatch({ type: 'register-settlement', request, displayRate: rate.value })}
                />
              </View>
            );
          })
        )}
      </AppCard>

      {ledger.error && (
        <SolarText variant="captionStrong" color="#B42318" accessibilityRole="alert">
          {ledger.error}
        </SolarText>
      )}

      {payments.length > 0 && (
        <>
          <SectionHeader title="История переводов" subtitle={`${payments.length} операций`} />
          <AppCard>
            {[...payments].reverse().map((payment, i) => (
              <View key={payment.id} style={[styles.debt, i > 0 && styles.divider]}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <SolarText variant="bodyStrong" style={payment.status === 'cancelled' && styles.strike}>
                      {nameOf(payment.fromId)} → {nameOf(payment.toId)}
                    </SolarText>
                    <SolarText variant="caption" secondary>
                      {new Date(payment.occurredAt).toLocaleString('ru-RU')}
                    </SolarText>
                    <SolarText variant="captionStrong" color={Solar.navySecondary}>
                      {payment.status === 'completed'
                        ? '✓ Перевод учтён'
                        : `Отменён ${new Date(payment.cancelledAt).toLocaleString('ru-RU')}`}
                    </SolarText>
                  </View>
                  <CurrencyAmount amount={moneyFromCents(payment.amountMinor)} currency="GEL" size="small" align="right" />
                </View>
                <AppButton
                  title={payment.status === 'completed' ? 'Отменить перевод' : 'Перевод отменён'}
                  variant="ghost"
                  compact
                  disabled={payment.status === 'cancelled'}
                  onPress={() => dispatch({
                    type: 'cancel-settlement', id: payment.id,
                    cancelledAt: new Date().toISOString(), displayRate: rate.value,
                  })}
                />
              </View>
            ))}
          </AppCard>
        </>
      )}
    </SolarScreen>
  );
}

function PaymentControls({ suggestion, ledger, onRegister }: {
  suggestion: SettlementSuggestion;
  ledger: FinancialLedgerState;
  onRegister: (request: SettlementRequest) => void;
}) {
  const [partialOpen, setPartialOpen] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<{ ledger: FinancialLedgerState; request: SettlementRequest } | null>(null);

  const submit = (amount: string | number) => {
    const result = financialResult(() => {
      const amountMinor = moneyToCents(amount, { label: 'Сумма перевода' });
      // Repeated clicks before React commits reuse the same intent, not a new operation.
      const previous = pending.current;
      const request: SettlementRequest = previous?.ledger === ledger
        && previous.request.fromId === suggestion.from && previous.request.toId === suggestion.to
        && previous.request.amountMinor === amountMinor ? previous.request : {
          id: newId('settlement'), requestId: newId('settlement-request'),
          fromId: suggestion.from, toId: suggestion.to, amountMinor,
          currency: 'GEL', occurredAt: new Date().toISOString(),
        };
      registerSettlement(ledger, request, participantIds);
      pending.current = { ledger, request };
      onRegister(request);
    });
    setError(result.error);
    if (result.error === null) {
      setPartialOpen(false);
      setInput('');
    }
  };

  return (
    <>
      <AppButton title="Отметить погашенным" variant="secondary" compact onPress={() => submit(suggestion.amount)} />
      <AppButton title="Погасить часть" variant="ghost" compact onPress={() => { setPartialOpen(true); setError(null); }} />
      {partialOpen && (
        <AppCard tone="sky">
          <TextField label="Сумма погашения" value={input} onChangeText={setInput} keyboardType="decimal-pad" suffix="GEL" placeholder="0,00" />
          <View style={styles.row}>
            <AppButton title="Отмена" variant="ghost" compact style={styles.flex} onPress={() => { setPartialOpen(false); setError(null); }} />
            <AppButton title="Записать перевод" compact style={styles.flex} onPress={() => submit(input)} />
          </View>
        </AppCard>
      )}
      {error && <SolarText variant="captionStrong" color="#B42318" accessibilityRole="alert">{error}</SolarText>}
    </>
  );
}

function RateCard({ rate, onChange, validateRate }: {
  rate: Rate;
  onChange: (r: Rate) => void;
  validateRate: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const parsed = financialResult(() => {
    const value = parseRate(input);
    validateRate(value);
    return value;
  });
  const valid = parsed.error === null;
  const demoValid = financialResult(() => validateRate(DEMO_RATE_RUB_PER_GEL)).error === null;

  return (
    <AppCard>
      <View style={styles.row}>
        <View style={styles.flex}>
          <SolarText variant="caption" secondary>
            Курс пересчёта
          </SolarText>
          <SolarText variant="heading">
            1 GEL = {rate.value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: RATE_DECIMALS })} ₽
          </SolarText>
        </View>
        <View style={[styles.ratePill, rate.kind === 'demo' ? styles.ratePillDemo : styles.ratePillManual]}>
          <SolarText variant="captionStrong">{rate.kind === 'demo' ? 'Демо-курс' : 'Ручной курс'}</SolarText>
        </View>
      </View>
      <SolarText variant="caption" secondary>
        {rate.kind === 'demo'
          ? 'Источник: условный курс для прототипа · не актуален'
          : `Источник: введён вручную · ${rate.setAt}`}
      </SolarText>
      <SolarText variant="caption" secondary>
        {editing && input.trim() && parsed.error
          ? parsed.error
          : 'Каждый расход хранит свой курс на дату операции. Новый курс применяется к новым расходам.'}
      </SolarText>

      {editing ? (
        <>
          <TextField
            label="Свой курс, ₽ за 1 GEL"
            value={input}
            onChangeText={setInput}
            keyboardType="decimal-pad"
            placeholder="Например, 31,80"
            suffix="₽"
            autoFocus
          />
          <View style={styles.row}>
            <AppButton title="Отмена" variant="ghost" compact style={styles.flex} onPress={() => setEditing(false)} />
            <AppButton
              title="Применить"
              compact
              style={styles.flex}
              disabled={!valid}
              onPress={() => {
                if (parsed.value === null) return;
                onChange({ kind: 'manual', value: parsed.value, setAt: formatDay(new Date().toISOString().slice(0, 10)) });
                setEditing(false);
                setInput('');
              }}
            />
          </View>
        </>
      ) : (
        <View style={styles.row}>
          <AppButton title="Указать свой курс" variant="secondary" compact style={styles.flex} onPress={() => setEditing(true)} />
          {rate.kind === 'manual' && (
            <AppButton
              title="Демо-курс"
              variant="ghost"
              compact
              style={styles.flex}
              disabled={!demoValid}
              onPress={() => { if (demoValid) onChange({ kind: 'demo', value: DEMO_RATE_RUB_PER_GEL }); }}
            />
          )}
        </View>
      )}
    </AppCard>
  );
}

const categories = Object.keys(ExpenseCategories) as ExpenseCategory[];

function ExpenseForm({
  rate,
  onSave,
  onCancel,
}: {
  rate: number;
  onSave: (e: Expense) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [amountInput, setAmountInput] = useState('');
  const [paidBy, setPaidBy] = useState(participants[0]?.id ?? '');
  const [split, setSplit] = useState<string[]>(participantIds);
  const [mode, setMode] = useState<'equal' | 'manual'>('equal');
  const [manual, setManual] = useState<Record<string, string>>({});
  const [date, setDate] = useState(DemoTripDates[0]);
  const [error, setError] = useState<string | null>(null);

  const amount = financialResult(() => moneyFromCents(moneyToCents(amountInput)));
  const amountValid = amount.value !== null;
  const converted = financialResult(() => convertGelToRub(amount.value ?? 0, rate));
  const manualSum = financialResult(() => sumMoney(split.map((id) => moneyFromCents(
    moneyToCents(manual[id] ?? '', { allowZero: true, label: `Доля участника ${nameOf(id)}` }),
  ))));

  const toggleSplit = (id: string) =>
    setSplit((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const save = () => {
    if (!title.trim()) return setError('Введите название');
    const result = financialResult(() => {
      const financials = createExpenseFinancials({
        amount: amountInput,
        currency: 'GEL',
        rateRub: rate,
        paidBy,
        splitBetween: split,
        manualShares: mode === 'manual'
          ? Object.fromEntries(split.map((id) => [id, manual[id] ?? ''])) : undefined,
      }, participantIds);
      onSave({ id: newId('e'), title: title.trim(), category, ...financials, date });
    });
    if (result.error !== null) setError(result.error);
  };

  return (
    <AppCard>
      <SectionHeader title="Новый расход" actionLabel="Отмена" onAction={onCancel} />

      <TextField label="Название" value={title} onChangeText={setTitle} placeholder="Например, ужин в ресторане" />

      <FormLabel text="Категория" />
      <View style={styles.chips}>
        {categories.map((c) => (
          <FilterChip
            key={c}
            label={`${ExpenseCategories[c].icon} ${ExpenseCategories[c].label}`}
            selected={c === category}
            onPress={() => setCategory(c)}
          />
        ))}
      </View>

      <TextField
        label="Сумма в местной валюте"
        value={amountInput}
        onChangeText={setAmountInput}
        keyboardType="decimal-pad"
        placeholder="0,00"
        suffix="GEL"
      />
      <SolarText variant="caption" secondary>
        {amountValid && converted.value !== null
          ? `≈ ${formatMoney(converted.value, 'RUB')} по курсу ${rate.toLocaleString('ru-RU', { maximumFractionDigits: RATE_DECIMALS })} ₽`
          : 'Эквивалент в рублях посчитается автоматически'}
      </SolarText>

      <FormLabel text="Кто оплатил" />
      <View style={styles.chips}>
        {participants.map((p) => (
          <FilterChip key={p.id} label={p.name} selected={p.id === paidBy} onPress={() => setPaidBy(p.id)} />
        ))}
      </View>

      <FormLabel text="Между кем разделить" />
      <View style={styles.chips}>
        {participants.map((p) => (
          <FilterChip key={p.id} label={p.name} selected={split.includes(p.id)} onPress={() => toggleSplit(p.id)} />
        ))}
      </View>

      <SegmentedControl
        options={[
          { value: 'equal', label: 'Поровну' },
          { value: 'manual', label: 'Вручную' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'equal' ? (
        <SolarText variant="caption" secondary>
          {amount.value !== null && split.length > 0
            ? `По ${formatMoney(amount.value / split.length, 'GEL')} на человека`
            : 'Сумма разделится поровну между выбранными'}
        </SolarText>
      ) : (
        <View style={styles.manual}>
          {split.map((id) => (
            <TextField
              key={id}
              label={nameOf(id)}
              value={manual[id] ?? ''}
              onChangeText={(t) => setManual((cur) => ({ ...cur, [id]: t }))}
              keyboardType="decimal-pad"
              placeholder="0,00"
              suffix="GEL"
            />
          ))}
          <SolarText variant="caption" secondary>
            Распределено {manualSum.value === null ? '—' : formatMoney(manualSum.value, 'GEL')}
            {amount.value !== null ? ` из ${formatMoney(amount.value, 'GEL')}` : ''}
          </SolarText>
        </View>
      )}

      <FormLabel text="Дата" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {DemoTripDates.map((d) => (
          <FilterChip key={d} label={formatDay(d)} selected={d === date} onPress={() => setDate(d)} />
        ))}
      </ScrollView>

      {error && (
        <SolarText variant="captionStrong" color="#B42318" accessibilityRole="alert">
          {error}
        </SolarText>
      )}
      <AppButton title="Сохранить расход" onPress={save} />
    </AppCard>
  );
}

function FormLabel({ text }: { text: string }) {
  return (
    <SolarText variant="captionStrong" secondary style={styles.formLabel}>
      {text}
    </SolarText>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: SolarSpace.xs,
  },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
    paddingVertical: SolarSpace.s,
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SolarSpace.s + 2,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: SolarSpace.m,
    marginTop: SolarSpace.xs,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: Solar.navyLine,
  },
  debt: {
    gap: SolarSpace.s + 2,
    paddingVertical: SolarSpace.m - 4,
  },
  strike: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  ratePill: {
    borderRadius: SolarRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1.5,
  },
  ratePillDemo: {
    borderColor: Solar.orange,
    borderStyle: 'dashed',
  },
  ratePillManual: {
    borderColor: Solar.navyLine,
    backgroundColor: Solar.sky,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SolarSpace.s,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: SolarSpace.s,
  },
  manual: {
    gap: SolarSpace.s,
  },
  formLabel: {
    marginTop: SolarSpace.xs,
  },
});
