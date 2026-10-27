import { Pressable, StyleSheet, View } from 'react-native';

import { Solar, SolarRadius, SolarSize, SolarSpace } from '@/constants/solar';

import { SolarText } from './solar-text';

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.active]}>
            <SolarText variant={active ? 'captionStrong' : 'caption'} numberOfLines={1}>
              {o.label}
            </SolarText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: Solar.ice,
    borderRadius: SolarRadius.button,
    padding: SolarSpace.xs,
    gap: SolarSpace.xs,
  },
  segment: {
    flex: 1,
    minHeight: SolarSize.touch - SolarSpace.xs,
    borderRadius: SolarRadius.button - SolarSpace.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SolarSpace.s,
  },
  active: {
    backgroundColor: Solar.white,
    shadowColor: Solar.navy,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
