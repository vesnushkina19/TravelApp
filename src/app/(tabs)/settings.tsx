import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, VisaColors } from '@/constants/theme';
import { useAppStore } from '@/store/app-store';

export default function SettingsScreen() {
  const { citizenship, visited, trips, resetAll } = useAppStore();
  const [confirming, setConfirming] = useState(false);

  return (
    <Screen title="Профиль">
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          Гражданство
        </ThemedText>
        {/* Пока только РФ — выбор гражданства добавим позже */}
        <ThemedText>{citizenship === 'RU' ? '🇷🇺 Россия' : citizenship}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          От гражданства зависит визовый режим стран
        </ThemedText>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small">Посещено стран: {visited.length}</ThemedText>
        <ThemedText type="small">Запланировано поездок: {trips.length}</ThemedText>
      </ThemedView>

      <Pressable
        onPress={() => {
          if (confirming) {
            resetAll();
            setConfirming(false);
          } else {
            setConfirming(true);
          }
        }}
        style={[styles.danger, { borderColor: VisaColors['visa-required'] }]}>
        <Text style={[styles.dangerText, { color: VisaColors['visa-required'] }]}>
          {confirming ? 'Точно удалить? Нажми ещё раз' : 'Сбросить все данные'}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  danger: {
    borderWidth: 1.5,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  dangerText: {
    fontSize: 16,
    fontWeight: 600,
  },
});
