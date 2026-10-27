import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getCountry } from '@/data/countries';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore, type Trip } from '@/store/app-store';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TripsScreen() {
  const theme = useTheme();
  const { trips, removeTrip } = useAppStore();
  const today = new Date().toISOString().slice(0, 10);

  const sorted = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const upcoming = sorted.filter((t) => t.endDate >= today);
  const past = sorted.filter((t) => t.endDate < today).reverse();

  return (
    <Screen title="Поездки">
      {/* TODO: календарь-вид месяца с отмеченными поездками */}
      <Link href="/trip/new" asChild>
        <Pressable style={StyleSheet.flatten([styles.addButton, { backgroundColor: theme.text }])}>
          <Text style={[styles.addButtonText, { color: theme.background }]}>+ Новая поездка</Text>
        </Pressable>
      </Link>

      <TripSection title="Предстоящие" trips={upcoming} onRemove={removeTrip} />
      <TripSection title="Прошедшие" trips={past} onRemove={removeTrip} />
    </Screen>
  );
}

function TripSection({
  title,
  trips,
  onRemove,
}: {
  title: string;
  trips: Trip[];
  onRemove: (id: string) => void;
}) {
  return (
    <ThemedView style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {trips.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Пока пусто
        </ThemedText>
      ) : (
        trips.map((trip) => {
          const country = getCountry(trip.countryCode);
          return (
            <ThemedView key={trip.id} type="backgroundElement" style={styles.trip}>
              <Text style={styles.flag}>{country?.flag}</Text>
              <ThemedView type="backgroundElement" style={styles.tripText}>
                <ThemedText>{country?.name ?? trip.countryCode}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
                </ThemedText>
                {trip.note ? <ThemedText type="small">{trip.note}</ThemedText> : null}
              </ThemedView>
              <Pressable onPress={() => onRemove(trip.id)} hitSlop={8}>
                <ThemedText themeColor="textSecondary">✕</ThemedText>
              </Pressable>
            </ThemedView>
          );
        })
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  addButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 600,
  },
  section: {
    gap: Spacing.two,
  },
  trip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  flag: {
    fontSize: 28,
  },
  tripText: {
    flex: 1,
  },
});
