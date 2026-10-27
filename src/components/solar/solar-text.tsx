import { StyleSheet, Text, type TextProps } from 'react-native';

import { Solar, SolarFont } from '@/constants/solar';

type Variant = 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'captionStrong';

export type SolarTextProps = TextProps & {
  variant?: Variant;
  /** true — второстепенный цвет текста. */
  secondary?: boolean;
  color?: string;
};

export function SolarText({ variant = 'body', secondary, color, style, ...rest }: SolarTextProps) {
  return (
    <Text
      style={[
        styles[variant],
        { color: color ?? (secondary ? Solar.navySecondary : Solar.navy) },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: SolarFont.bold, fontSize: 28, lineHeight: 34 },
  heading: { fontFamily: SolarFont.semibold, fontSize: 19, lineHeight: 24 },
  body: { fontFamily: SolarFont.regular, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: SolarFont.semibold, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: SolarFont.regular, fontSize: 13, lineHeight: 18 },
  captionStrong: { fontFamily: SolarFont.semibold, fontSize: 13, lineHeight: 18 },
});
