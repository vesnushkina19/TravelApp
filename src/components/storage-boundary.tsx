import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Solar, SolarRadius, SolarSize, SolarSpace } from '@/constants/solar';
import type { StorageError, StorageStatus } from '@/store/app-storage';

import { ThemedText } from './themed-text';

/** Keep screens mounted, including their unsaved forms and independent Solar demo state. */
export function StorageBoundary({ status, error, onRetry, children }: {
  status: StorageStatus;
  error: StorageError | null;
  onRetry: () => void;
  children: ReactNode;
}) {
  const blocked = status !== 'ready';
  return (
    <View style={styles.fill}>
      <View
        style={styles.fill}
        pointerEvents={blocked ? 'none' : 'auto'}
        accessibilityElementsHidden={blocked}
        importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {blocked && (
        <View style={styles.overlay} accessibilityViewIsModal>
          <View style={styles.message}>
            {status === 'loading' ? (
              <>
                <ActivityIndicator color={Solar.orange} accessibilityLabel="Загрузка хранилища" />
                <ThemedText type="smallBold" style={styles.text}>Загружаем сохранённые данные…</ThemedText>
                <ThemedText type="small" style={styles.text}>Изменения будут доступны после загрузки.</ThemedText>
              </>
            ) : (
              <>
                <ThemedText type="smallBold" style={styles.text} accessibilityRole="alert">
                  {error?.message}
                </ThemedText>
                <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
                  <ThemedText type="smallBold" style={styles.text}>
                    {error?.kind === 'write' ? 'Повторить сохранение' : 'Повторить загрузку'}
                  </ThemedText>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: Solar.ice, padding: SolarSpace.l },
  message: { maxWidth: 500, width: '100%', gap: SolarSpace.m },
  text: { color: Solar.navy, textAlign: 'center' },
  button: { minHeight: SolarSize.touch, justifyContent: 'center', padding: SolarSpace.m, borderRadius: SolarRadius.button, backgroundColor: Solar.sky },
});
