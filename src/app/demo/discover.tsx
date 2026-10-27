import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import { AppButton } from '@/components/solar/app-button';
import { AppCard } from '@/components/solar/app-card';
import { CountryCard } from '@/components/solar/country-card';
import { DemoNotice } from '@/components/solar/demo-notice';
import { FilterChip } from '@/components/solar/filter-chip';
import { SectionHeader } from '@/components/solar/section-header';
import { SegmentedControl } from '@/components/solar/segmented-control';
import { SolarScreen } from '@/components/solar/solar-screen';
import { SolarText } from '@/components/solar/solar-text';
import { TextField } from '@/components/solar/text-field';
import { Solar, SolarRadius, SolarSize, SolarSpace } from '@/constants/solar';
import {
  DemoDestinations,
  MONTHS,
  MONTHS_SHORT,
  PreferenceLabels,
  SeasonLabels,
  type Preference,
} from '@/data/demo/destinations';

const DURATIONS = [5, 7, 10, 14, 21];
const preferences = Object.keys(PreferenceLabels) as Preference[];
type BudgetMode = 'person' | 'group';

export default function DiscoverScreen() {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const resultsY = useRef(0);

  const [month, setMonth] = useState(4);
  const [days, setDays] = useState(7);
  const [budget, setBudget] = useState('150000');
  const [budgetMode, setBudgetMode] = useState<BudgetMode>('person');
  const [travelers, setTravelers] = useState(2);
  const [city, setCity] = useState('Москва');
  /** Пустой набор = «Любой». */
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [searched, setSearched] = useState(false);

  const togglePref = (p: Preference) =>
    setPrefs((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const budgetNumber = Number(budget) || 0;
  const perPersonBudget = budgetMode === 'person' ? budgetNumber : budgetNumber / travelers;

  const results = DemoDestinations.map((d) => ({
    ...d,
    season: d.seasonByMonth[month],
    costPerPerson: d.dailyRub * days + d.flightRub,
  }))
    .filter((d) => d.season >= 3 && (prefs.length === 0 || d.tags.some((t) => prefs.includes(t))))
    .sort((a, b) => {
      const aFits = a.costPerPerson <= perPersonBudget ? 0 : 1;
      const bFits = b.costPerPerson <= perPersonBudget ? 0 : 1;
      return aFits - bFits || b.season - a.season || a.costPerPerson - b.costPerPerson;
    });

  const search = () => {
    setSearched(true);
    // Ждём, пока результаты отрисуются и контент станет длиннее
    setTimeout(() => scrollRef.current?.scrollTo({ y: resultsY.current - SolarSpace.s, animated: true }), 150);
  };

  return (
    <SolarScreen ref={scrollRef}>
      <View style={styles.header}>
        <SolarText variant="title">Куда отправимся?</SolarText>
        <SolarText secondary>Подберём страну под сезон, бюджет и ваши интересы</SolarText>
      </View>

      <AppCard>
        <SolarText variant="bodyStrong">Когда и надолго</SolarText>
        <SolarText variant="captionStrong" secondary>
          Месяц
        </SolarText>
        <View style={styles.grid}>
          {MONTHS_SHORT.map((m, i) => (
            <View key={m} style={styles.gridCell}>
              <FilterChip label={m} selected={i === month} onPress={() => setMonth(i)} />
            </View>
          ))}
        </View>
        <SolarText variant="captionStrong" secondary>
          Дней
        </SolarText>
        <View style={styles.grid}>
          {DURATIONS.map((d) => (
            <View key={d} style={styles.durationCell}>
              <FilterChip label={String(d)} selected={d === days} onPress={() => setDays(d)} />
            </View>
          ))}
        </View>
      </AppCard>

      <AppCard>
        <SolarText variant="bodyStrong">Бюджет и компания</SolarText>
        <TextField
          label="Бюджет"
          value={budgetNumber ? budgetNumber.toLocaleString('ru-RU') : ''}
          onChangeText={(t) => setBudget(t.replace(/\D/g, '').slice(0, 9))}
          keyboardType="number-pad"
          placeholder="Например, 150 000"
          suffix="₽"
        />
        <SegmentedControl
          options={[
            { value: 'person', label: 'На человека' },
            { value: 'group', label: 'На всю компанию' },
          ]}
          value={budgetMode}
          onChange={setBudgetMode}
        />
        <View style={styles.twoCols}>
          <View style={styles.col}>
            <SolarText variant="captionStrong" secondary>
              Путешественники
            </SolarText>
            <Stepper value={travelers} min={1} max={20} onChange={setTravelers} />
          </View>
          <View style={styles.col}>
            <TextField label="Откуда" value={city} onChangeText={setCity} placeholder="Город" />
          </View>
        </View>
      </AppCard>

      <AppCard>
        <SolarText variant="bodyStrong">Что хочется</SolarText>
        <View style={styles.chipsWrap}>
          <FilterChip label="Любой" selected={prefs.length === 0} onPress={() => setPrefs([])} />
          {preferences.map((p) => (
            <FilterChip
              key={p}
              label={PreferenceLabels[p]}
              selected={prefs.includes(p)}
              onPress={() => togglePref(p)}
            />
          ))}
        </View>
      </AppCard>

      <AppButton title="Найти направления" onPress={search} />

      <View
        style={styles.results}
        onLayout={(e) => {
          resultsY.current = e.nativeEvent.layout.y;
        }}>
        {searched ? (
          <>
            <SectionHeader
              title="Подходящие направления"
              subtitle={`${MONTHS[month]} · ${days} дней · ${travelers} чел. · из г. ${city || '—'}`}
            />
            <DemoNotice text="Цены, сезонность и визовые статусы тестовые и не отражают актуальную ситуацию." />
            {results.length === 0 ? (
              <AppCard tone="sky" style={styles.empty}>
                <Text style={styles.emptyEmoji}>🧳</Text>
                <SolarText variant="bodyStrong">Ничего не нашлось</SolarText>
                <SolarText variant="caption" secondary style={styles.center}>
                  Попробуйте другой месяц или выберите «Любой» в интересах
                </SolarText>
              </AppCard>
            ) : (
              results.map((d) => (
                <CountryCard
                  key={d.id}
                  name={d.name}
                  flag={d.flag}
                  seasonScore={d.season}
                  seasonLabel={SeasonLabels[d.season]}
                  budgetRub={d.costPerPerson}
                  budgetCaption="на человека"
                  overBudget={d.costPerPerson > perPersonBudget}
                  visa={d.visa}
                  reason={d.reason}
                />
              ))
            )}
          </>
        ) : (
          <AppCard tone="sky" style={styles.empty}>
            <Text style={styles.emptyEmoji}>🧭</Text>
            <SolarText variant="caption" secondary style={styles.center}>
              Укажите параметры и нажмите «Найти направления» — здесь появятся подходящие страны
            </SolarText>
          </AppCard>
        )}
      </View>
    </SolarScreen>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <StepButton label="−" disabled={value <= min} onPress={() => onChange(value - 1)} />
      <SolarText variant="bodyStrong" style={styles.stepValue} accessibilityLiveRegion="polite">
        {value}
      </SolarText>
      <StepButton label="+" disabled={value >= max} onPress={() => onChange(value + 1)} />
    </View>
  );
}

function StepButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Добавить' : 'Убрать'}
      disabled={disabled}
      onPress={onPress}
      style={[styles.stepButton, disabled && styles.disabled]}>
      <SolarText variant="heading">{label}</SolarText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: SolarSpace.xs,
    marginBottom: SolarSpace.s,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SolarSpace.xs,
    rowGap: SolarSpace.s,
  },
  gridCell: {
    width: '25%',
    paddingHorizontal: SolarSpace.xs / 2,
  },
  durationCell: {
    width: '20%',
    paddingHorizontal: SolarSpace.xs / 2,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SolarSpace.s,
  },
  twoCols: {
    flexDirection: 'row',
    gap: SolarSpace.m - 4,
    alignItems: 'flex-end',
  },
  col: {
    flex: 1,
    gap: SolarSpace.xs + 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: SolarSize.touch + 4,
    borderRadius: SolarRadius.button,
    borderWidth: 1.5,
    borderColor: Solar.navyLine,
    paddingHorizontal: 2,
  },
  stepButton: {
    width: SolarSize.touch,
    height: SolarSize.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    minWidth: 24,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.3,
  },
  results: {
    gap: SolarSpace.m,
    marginTop: SolarSpace.s,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: SolarSpace.l,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  center: {
    textAlign: 'center',
  },
});
