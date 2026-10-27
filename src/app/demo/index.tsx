import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/solar/app-card';
import { DemoNotice } from '@/components/solar/demo-notice';
import { SolarScreen } from '@/components/solar/solar-screen';
import { SolarText } from '@/components/solar/solar-text';
import { Solar, SolarSpace } from '@/constants/solar';

const prototypes: { href: Href; icon: string; title: string; text: string }[] = [
  { href: '/demo/discover', icon: '🧭', title: 'Куда поехать?', text: 'Подбор направления по сезону, бюджету и интересам' },
  { href: '/demo/trip', icon: '👥', title: 'Совместная поездка', text: 'Маршрут, участники и документы поездки в Грузию' },
  { href: '/demo/expenses', icon: '💸', title: 'Расходы компании', text: 'Траты в GEL, пересчёт в рубли и кто кому должен' },
];

export default function DemoIndexScreen() {
  return (
    <SolarScreen>
      <SolarText variant="caption" secondary>
        Экраны для дизайн-ревью. Основное приложение они не затрагивают.
      </SolarText>
      <DemoNotice text="Все цены, визы и курсы на этих экранах тестовые." />
      {prototypes.map((p) => (
        <Pressable key={p.title} accessibilityRole="link" onPress={() => router.push(p.href)}>
          {({ pressed }) => (
            <AppCard style={[styles.card, pressed && styles.pressed]}>
              <View style={styles.icon}>
                <Text style={styles.emoji}>{p.icon}</Text>
              </View>
              <View style={styles.text}>
                <SolarText variant="bodyStrong">{p.title}</SolarText>
                <SolarText variant="caption" secondary>
                  {p.text}
                </SolarText>
              </View>
              <SolarText variant="heading" color={Solar.orange}>
                ›
              </SolarText>
            </AppCard>
          )}
        </Pressable>
      ))}
    </SolarScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SolarSpace.m,
  },
  pressed: {
    opacity: 0.8,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Solar.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 26,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
