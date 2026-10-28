import {
  Onest_400Regular,
  Onest_500Medium,
  Onest_600SemiBold,
  Onest_700Bold,
  useFonts,
} from '@expo-google-fonts/onest';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { SolarTripProvider } from '@/store/solar-store';

import { Solar, SolarFont } from '@/constants/solar';

/** Прототипы в дизайн-системе Solar. Отдельный стек, не влияет на основную навигацию. */
export default function DemoLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Onest_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: Solar.ice, justifyContent: 'center' }}>
        <ActivityIndicator color={Solar.orange} />
      </View>
    );
  }

  return (
    <SolarTripProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Solar.ice },
          headerShadowVisible: false,
          headerTintColor: Solar.navy,
          headerTitleStyle: { fontFamily: SolarFont.semibold, color: Solar.navy },
          headerBackTitle: 'Назад',
          contentStyle: { backgroundColor: Solar.ice },
        }}>
        <Stack.Screen name="index" options={{ title: 'Прототипы Solar' }} />
        <Stack.Screen name="discover" options={{ title: '' }} />
        <Stack.Screen name="trip" options={{ title: '' }} />
        <Stack.Screen name="expenses" options={{ title: '' }} />
      </Stack>
    </SolarTripProvider>
  );
}
