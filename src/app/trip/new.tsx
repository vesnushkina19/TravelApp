import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { Countries } from '@/data/countries';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string) {
  return DATE_RE.test(value) && !Number.isNaN(new Date(value).getTime());
}

// TODO: заменить текстовые поля дат на нормальный календарь-пикер
export default function NewTripScreen() {
  const params = useLocalSearchParams<{ country?: string }>();
  const theme = useTheme();
  const { addTrip } = useAppStore();

  const [countryCode, setCountryCode] = useState(params.country ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }];

  const save = () => {
    if (!countryCode) return setError('Выбери страну');
    if (!isValidDate(startDate) || !isValidDate(endDate))
      return setError('Даты в формате ГГГГ-ММ-ДД, например 2026-12-01');
    if (endDate < startDate) return setError('Дата окончания раньше даты начала');

    addTrip({ countryCode, startDate, endDate, note: note.trim() || undefined });
    router.back();
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <ThemedText type="smallBold">Страна</ThemedText>
      <ThemedView style={styles.countries}>
        {Countries.map((c) => {
          const active = c.code === countryCode;
          return (
            <Pressable
              key={c.code}
              onPress={() => setCountryCode(c.code)}
              style={[
                styles.countryChip,
                { backgroundColor: active ? theme.text : theme.backgroundElement },
              ]}>
              <Text style={{ color: active ? theme.background : theme.text }}>
                {c.flag} {c.name}
              </Text>
            </Pressable>
          );
        })}
      </ThemedView>

      <ThemedText type="smallBold">Даты</ThemedText>
      <TextInput
        value={startDate}
        onChangeText={setStartDate}
        placeholder="Начало: 2026-12-01"
        placeholderTextColor={theme.textSecondary}
        style={inputStyle}
      />
      <TextInput
        value={endDate}
        onChangeText={setEndDate}
        placeholder="Конец: 2026-12-14"
        placeholderTextColor={theme.textSecondary}
        style={inputStyle}
      />

      <ThemedText type="smallBold">Заметка</ThemedText>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Например: билеты куплены"
        placeholderTextColor={theme.textSecondary}
        style={inputStyle}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable onPress={save} style={[styles.save, { backgroundColor: theme.text }]}>
        <Text style={[styles.saveText, { color: theme.background }]}>Сохранить</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  countries: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  countryChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Spacing.three,
    fontSize: 16,
  },
  error: {
    color: '#D64545',
  },
  save: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 16,
    fontWeight: 600,
  },
});
