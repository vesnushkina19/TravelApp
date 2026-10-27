import { Link } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VisaBadge } from '@/components/visa-badge';
import { BottomTabInset, Spacing, VisaColors } from '@/constants/theme';
import { Countries, VisaCategoryLabels, type VisaCategory } from '@/data/countries';
import { useTheme } from '@/hooks/use-theme';

const categories = Object.keys(VisaCategoryLabels) as VisaCategory[];

export default function CountriesScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<VisaCategory | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = Countries.filter(
    (c) =>
      (!category || c.visa.category === category) &&
      (!q || c.name.toLowerCase().includes(q) || c.capital.toLowerCase().includes(q)),
  ).sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  return (
    <Screen title="Страны" scroll={false}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Поиск страны или столицы"
        placeholderTextColor={theme.textSecondary}
        style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />

      <ThemedView style={styles.chips}>
        {categories.map((cat) => {
          const active = category === cat;
          return (
            <Pressable
              key={cat}
              onPress={() => setCategory(active ? null : cat)}
              style={[
                styles.chip,
                { borderColor: VisaColors[cat] },
                active && { backgroundColor: VisaColors[cat] },
              ]}>
              <Text style={[styles.chipText, { color: active ? '#fff' : theme.text }]}>
                {VisaCategoryLabels[cat]}
              </Text>
            </Pressable>
          );
        })}
      </ThemedView>

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.code}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<ThemedText themeColor="textSecondary">Ничего не найдено</ThemedText>}
        renderItem={({ item }) => (
          <Link href={{ pathname: '/country/[code]', params: { code: item.code } }} asChild>
            <Pressable>
              <ThemedView type="backgroundElement" style={styles.row}>
                <Text style={styles.flag}>{item.flag}</Text>
                <ThemedView type="backgroundElement" style={styles.rowText}>
                  <ThemedText>{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.capital} · {item.currency.code}
                  </ThemedText>
                </ThemedView>
                <VisaBadge category={item.visa.category} />
              </ThemedView>
            </Pressable>
          </Link>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Spacing.three,
    fontSize: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  chipText: {
    fontSize: 13,
    fontWeight: 600,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  flag: {
    fontSize: 32,
  },
  rowText: {
    flex: 1,
  },
});
