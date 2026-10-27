import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Solar, SolarRadius, SolarSize, SolarSpace } from '@/constants/solar';

import { SolarText } from './solar-text';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  /** Компактная кнопка (44 px) — для действий внутри карточек. */
  compact?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const backgrounds: Record<Variant, string> = {
  primary: Solar.orange,
  secondary: Solar.sky,
  ghost: 'transparent',
};

export function AppButton({ title, onPress, variant = 'primary', compact, disabled, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: backgrounds[variant],
          height: compact ? SolarSize.touch : SolarSize.buttonHeight,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        variant === 'ghost' && styles.ghost,
        style,
      ]}>
      <SolarText variant={compact ? 'captionStrong' : 'bodyStrong'} numberOfLines={1}>
        {title}
      </SolarText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: SolarRadius.button,
    paddingHorizontal: SolarSpace.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    borderWidth: 1.5,
    borderColor: Solar.navyLine,
  },
});
