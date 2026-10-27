import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Solar, SolarFont, SolarRadius, SolarSize, SolarSpace } from '@/constants/solar';

import { SolarText } from './solar-text';

type Props = TextInputProps & {
  label?: string;
  /** Текст справа внутри поля, например «₽» или «GEL». */
  suffix?: string;
};

export function TextField({ label, suffix, style, ...rest }: Props) {
  return (
    <View style={styles.wrapper}>
      {label && (
        <SolarText variant="captionStrong" secondary>
          {label}
        </SolarText>
      )}
      <View style={styles.field}>
        <TextInput
          placeholderTextColor={Solar.navySecondary}
          style={[styles.input, style]}
          accessibilityLabel={label}
          {...rest}
        />
        {suffix && <SolarText variant="bodyStrong" secondary>{suffix}</SolarText>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: SolarSpace.xs + 2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SolarSize.touch + 4,
    paddingHorizontal: SolarSpace.m,
    borderRadius: SolarRadius.button,
    backgroundColor: Solar.white,
    borderWidth: 1.5,
    borderColor: Solar.navyLine,
    gap: SolarSpace.s,
  },
  input: {
    flex: 1,
    fontFamily: SolarFont.medium,
    fontSize: 16,
    color: Solar.navy,
    paddingVertical: SolarSpace.s,
  },
});
