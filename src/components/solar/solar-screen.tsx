import { type ReactNode, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Solar, SolarSpace } from '@/constants/solar';

type Props = {
  children: ReactNode;
  ref?: Ref<ScrollViewInstance>;
};

/** Прокручиваемый экран Solar: фон Ice, боковые отступы 16, нижняя safe area. */
export function SolarScreen({ children, ref }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <ScrollView
        ref={ref}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SolarSpace.xl }]}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Solar.ice,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SolarSpace.m,
    paddingTop: SolarSpace.s,
    gap: SolarSpace.m,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
});
