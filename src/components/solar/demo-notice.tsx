import { StyleSheet, View } from 'react-native';

import { Solar, SolarRadius, SolarSpace } from '@/constants/solar';

import { SolarText } from './solar-text';

/** Плашка «демо-данные» — обязательна везде, где показаны тестовые цены, визы и курсы. */
export function DemoNotice({ text }: { text: string }) {
  return (
    <View style={styles.box} accessibilityRole="alert">
      <SolarText variant="captionStrong">ДЕМО</SolarText>
      <SolarText variant="caption" style={styles.text}>
        {text}
      </SolarText>
    </View>
  );
}

/** Маленькая метка «тест» рядом с конкретным значением. */
export function DemoTag() {
  return (
    <View style={styles.tag}>
      <SolarText variant="caption" style={styles.tagText}>
        тест
      </SolarText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: SolarSpace.s,
    alignItems: 'flex-start',
    backgroundColor: Solar.white,
    borderRadius: SolarRadius.button,
    borderWidth: 1.5,
    borderColor: Solar.orange,
    borderStyle: 'dashed',
    padding: SolarSpace.s + SolarSpace.xs,
  },
  text: {
    flex: 1,
  },
  tag: {
    borderRadius: SolarRadius.pill,
    borderWidth: 1,
    borderColor: Solar.navySecondary,
    paddingHorizontal: 6,
    alignSelf: 'center',
  },
  tagText: {
    fontSize: 11,
    lineHeight: 15,
  },
});
