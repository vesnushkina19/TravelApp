import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VisaBadge } from '@/components/visa-badge';
import { Spacing, VisaColors } from '@/constants/theme';
import { getCountry } from '@/data/countries';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/** Разделы карточки, которые наполним на этапах 2–3. */
const upcomingSections = [
  'Когда сезон',
  'Валюта: с чем лучше ехать для обмена',
  'Культура: что любят и что принято',
  'Национальная кухня и одежда',
  'Маст-хэв места и как добраться',
  'Транспорт и аренда',
  'Где поесть: рестораны, кафе, уличная еда',
];

export default function CountryScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const country = getCountry(code);
  const theme = useTheme();
  const { visited, toggleVisited } = useAppStore();

  if (!country) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Страна не найдена</ThemedText>
      </ThemedView>
    );
  }

  const isVisited = visited.includes(country.code);
  const { visa } = country;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: country.name }} />

      <ThemedView style={styles.hero}>
        <Text style={styles.flag}>{country.flag}</Text>
        <ThemedText type="subtitle">{country.name}</ThemedText>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <InfoRow label="Столица" value={country.capital} />
        <InfoRow label="Валюта" value={`${country.currency.name} (${country.currency.code})`} />
        <InfoRow label="Регион" value={country.region} />
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Виза для граждан РФ</ThemedText>
        <VisaBadge category={visa.category} />
        {visa.stayDays && <ThemedText type="small">До {visa.stayDays} дней</ThemedText>}
        {visa.note && <ThemedText type="small">{visa.note}</ThemedText>}
        <ThemedText type="small" themeColor="textSecondary">
          {visa.verifiedAt ? `Проверено ${visa.verifiedAt}` : '⚠️ Демо-данные, не проверено'}
        </ThemedText>
        {visa.sourceUrl && (
          <ExternalLink href={visa.sourceUrl}>
            <ThemedText type="linkPrimary">Источник</ThemedText>
          </ExternalLink>
        )}
      </ThemedView>

      <ThemedView style={styles.actions}>
        <Pressable
          onPress={() => toggleVisited(country.code)}
          style={[
            styles.button,
            { backgroundColor: isVisited ? VisaColors['visa-free'] : theme.backgroundSelected },
          ]}>
          <Text style={[styles.buttonText, { color: isVisited ? '#fff' : theme.text }]}>
            {isVisited ? '✓ Уже была здесь' : 'Отметить как посещённую'}
          </Text>
        </Pressable>

        <Link href={{ pathname: '/trip/new', params: { country: country.code } }} asChild>
          <Pressable style={StyleSheet.flatten([styles.button, { backgroundColor: theme.text }])}>
            <Text style={[styles.buttonText, { color: theme.background }]}>
              Запланировать поездку
            </Text>
          </Pressable>
        </Link>
      </ThemedView>

      {upcomingSections.map((title) => (
        <ThemedView key={title} type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Скоро
          </ThemedText>
        </ThemedView>
      ))}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.infoRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.infoValue}>
        {value}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  flag: {
    fontSize: 72,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  infoValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  actions: {
    gap: Spacing.two,
  },
  button: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 600,
  },
});
