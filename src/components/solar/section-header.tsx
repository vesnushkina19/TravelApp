import { Pressable, StyleSheet, View } from 'react-native';

import { Solar, SolarSize, SolarSpace } from '@/constants/solar';

import { SolarText } from './solar-text';

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <SolarText variant="heading">{title}</SolarText>
        {subtitle && (
          <SolarText variant="caption" secondary>
            {subtitle}
          </SolarText>
        )}
      </View>
      {actionLabel && (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.action} hitSlop={8}>
          <SolarText variant="captionStrong" color={Solar.orange}>
            {actionLabel}
          </SolarText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SolarSpace.s,
  },
  text: {
    flex: 1,
  },
  action: {
    minHeight: SolarSize.touch,
    justifyContent: 'center',
  },
});
