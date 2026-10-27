import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { Countries, getCountry } from '@/data/countries';
import { useAppStore } from '@/store/app-store';

export default function MapScreen() {
  const { visited } = useAppStore();
  const visitedCountries = visited.map(getCountry).filter((c) => c !== undefined);

  return (
    <Screen title="Карта мира">
      {/* TODO: SVG-карта мира с закрашенными посещёнными странами */}
      <ThemedView type="backgroundElement" style={styles.mapPlaceholder}>
        <Text style={styles.globe}>🗺️</Text>
        <ThemedText type="small" themeColor="textSecondary">
          Здесь будет карта, где посещённые страны закрашиваются
        </ThemedText>
      </ThemedView>

      <ThemedText type="smallBold">
        Посещено: {visitedCountries.length} из {Countries.length}
      </ThemedText>

      {visitedCountries.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Открой страну во вкладке «Страны» и отметь её как посещённую.
        </ThemedText>
      ) : (
        <ThemedView style={styles.flags}>
          {visitedCountries.map((c) => (
            <Link
              key={c.code}
              href={{ pathname: '/country/[code]', params: { code: c.code } }}
              asChild>
              <Pressable>
                <ThemedView type="backgroundElement" style={styles.flagChip}>
                  <Text>{c.flag}</Text>
                  <ThemedText type="small">{c.name}</ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          ))}
        </ThemedView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapPlaceholder: {
    aspectRatio: 2,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  globe: {
    fontSize: 48,
  },
  flags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  flagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
  },
});
