import { useState } from 'react';
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
import { formatMoney, newId, parseAmount, round2 } from '@/utils/money';
import { computeBalances, computeSettlements } from '@/utils/split';

const participants = DemoParticipants;
const participantIds = participants.map((p) => p.id);
const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? id;
const indexOf = (id: string) => participantIds.indexOf(id);

type Rate = { kind: 'demo' | 'manual'; value: number; setAt?: string };

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>(DemoExpenses);
  const [rate, setRate] = useState<Rate>({ kind: 'demo', value: DEMO_RATE_RUB_PER_GEL });
  const [formOpen, setFormOpen] = useState(false);
  const [settled, setSettled] = useState<string[]>([]);

  const totalGel = expenses.reduce((s, e) => s + e.amount, 0);
  const totalRub = expenses.reduce((s, e) => s + e.amount * e.rateRub, 0);
  const remainingRub = DemoTrip.budgetRub - totalRub;

  const balances = computeBalances(expenses, participantIds);
  const settlements = computeSettlements(balances);

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

      <RateCard rate={rate} onChange={setRate} />

      {formOpen ? (
        <ExpenseForm
          rate={rate.value}
          onCancel={() => setFormOpen(false)}
          onSave={(e) => {
            setExpenses((cur) => [...cur, e]);
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

      <SectionHeader title="Баланс участников" subtitle="Сколько оплатил каждый минус его доля" />
      <AppCard>
        {participants.map((p, i) => {
          const balance = balances[p.id] ?? 0;
          const paid = expenses.filter((e) => e.paidBy === p.id).reduce((s, e) => s + e.amount, 0);
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
        {settlements.length === 0 ? (
          <SolarText variant="caption" secondary style={styles.center}>
            Все в расчёте 🎉
          </SolarText>
        ) : (
          settlements.map((s, i) => {
            const key = `${s.from}>${s.to}:${s.amount}`;
            const done = settled.includes(key);
            return (
              <View key={key} style={[styles.debt, i > 0 && styles.divider]}>
                <View style={styles.row}>
                  <ParticipantAvatar name={nameOf(s.from)} index={indexOf(s.from)} size={32} />
                  <SolarText variant="heading" secondary>
                    →
                  </SolarText>
                  <ParticipantAvatar name={nameOf(s.to)} index={indexOf(s.to)} size={32} />
                  <View style={styles.flex}>
                    <SolarText
                      variant="bodyStrong"
                      numberOfLines={1}
                      style={done && styles.strike}>
                      {nameOf(s.from)} → {nameOf(s.to)}
                    </SolarText>
                    {done && (
                      <SolarText variant="captionStrong" color={Solar.navySecondary}>
                        ✓ Погашено
                      </SolarText>
                    )}
                  </View>
                  <CurrencyAmount
                    amount={s.amount}
                    currency="GEL"
                    converted={{ amount: s.amount * rate.value, currency: 'RUB' }}
                    size="small"
                    align="right"
                  />
                </View>
                <AppButton
                  title={done ? 'Отменить отметку' : 'Отметить погашенным'}
                  variant={done ? 'ghost' : 'secondary'}
                  compact
                  onPress={() =>
                    setSettled((cur) => (done ? cur.filter((k) => k !== key) : [...cur, key]))
                  }
                />
              </View>
            );
          })
        )}
      </AppCard>
    </SolarScreen>
  );
}

function RateCard({ rate, onChange }: { rate: Rate; onChange: (r: Rate) => void }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const parsed = parseAmount(input);
  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <AppCard>
      <View style={styles.row}>
        <View style={styles.flex}>
          <SolarText variant="caption" secondary>
            Курс пересчёта
          </SolarText>
          <SolarText variant="heading">
            1 GEL = {rate.value.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
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
        Каждый расход хранит свой курс на дату операции. Новый курс применяется к новым расходам.
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
                onChange({ kind: 'manual', value: round2(parsed), setAt: formatDay(new Date().toISOString().slice(0, 10)) });
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
              onPress={() => onChange({ kind: 'demo', value: DEMO_RATE_RUB_PER_GEL })}
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
  const [paidBy, setPaidBy] = useState(participants[0].id);
  const [split, setSplit] = useState<string[]>(participantIds);
  const [mode, setMode] = useState<'equal' | 'manual'>('equal');
  const [manual, setManual] = useState<Record<string, string>>({});
  const [date, setDate] = useState(DemoTripDates[0]);
  const [error, setError] = useState<string | null>(null);

  const amount = parseAmount(amountInput);
  const amountValid = Number.isFinite(amount) && amount > 0;
  const manualSum = split.reduce((s, id) => s + (parseAmount(manual[id] ?? '') || 0), 0);

  const toggleSplit = (id: string) =>
    setSplit((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const save = () => {
    if (!title.trim()) return setError('Введите название');
    if (!amountValid) return setError('Введите сумму больше нуля');
    if (split.length === 0) return setError('Выберите, между кем разделить');
    if (mode === 'manual' && Math.abs(manualSum - amount) > 0.01)
      return setError(`Доли должны в сумме давать ${formatMoney(amount, 'GEL')}`);

    onSave({
      id: newId('e'),
      title: title.trim(),
      category,
      amount: round2(amount),
      currency: 'GEL',
      rateRub: rate,
      paidBy,
      splitBetween: split,
      manualShares:
        mode === 'manual'
          ? Object.fromEntries(split.map((id) => [id, parseAmount(manual[id] ?? '') || 0]))
          : undefined,
      date,
    });
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
        {amountValid
          ? `≈ ${formatMoney(amount * rate, 'RUB')} по курсу ${rate.toLocaleString('ru-RU')} ₽`
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
          {amountValid && split.length > 0
            ? `По ${formatMoney(amount / split.length, 'GEL')} на человека`
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
            Распределено {formatMoney(manualSum, 'GEL')}
            {amountValid ? ` из ${formatMoney(amount, 'GEL')}` : ''}
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
