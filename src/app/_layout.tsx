import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AppStoreProvider } from '@/store/app-store';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppStoreProvider>
        <Stack screenOptions={{ headerBackTitle: 'Назад' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="country/[code]" options={{ title: '' }} />
          <Stack.Screen
            name="trip/new"
            options={{ title: 'Новая поездка', presentation: 'modal' }}
          />
        </Stack>
      </AppStoreProvider>
    </ThemeProvider>
  );
}
