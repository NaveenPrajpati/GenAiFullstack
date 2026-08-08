import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md';

// The ONE hierarchy used everywhere: primary (solid accent), secondary
// (outline), ghost (text link), destructive (soft danger fill). Nothing else
// counts as a "primary" button — that is what keeps the old orange/green/purple
// mix from coming back.
const VARIANT: Record<Variant, { box: string; text: string; spinner: 'onPrimary' | 'ink' }> = {
  primary: { box: 'bg-primary', text: 'text-on-primary', spinner: 'onPrimary' },
  secondary: { box: 'bg-surface border border-line', text: 'text-ink', spinner: 'ink' },
  ghost: { box: 'bg-transparent', text: 'text-primary', spinner: 'ink' },
  destructive: { box: 'bg-danger-soft', text: 'text-danger', spinner: 'ink' },
};

const SIZE: Record<Size, { box: string; text: string }> = {
  sm: { box: 'px-3.5 py-2 rounded-lg', text: 'text-[13px]' },
  md: { box: 'px-5 py-2.5 rounded-xl', text: 'text-[15px]' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  loadingLabel,
  full = false,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  /** Shown beside the spinner. Without it a busy button just goes blank. */
  loadingLabel?: string;
  /** Stretch to the width of the row — for the one action a card is about. */
  full?: boolean;
}) {
  const v = VARIANT[variant];
  const s = SIZE[size];
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      className={`flex-row items-center justify-center gap-2 ${v.box} ${s.box} ${
        full ? 'flex-1' : 'self-start'
      } ${disabled && !loading ? 'opacity-40' : ''}`}>
      {loading ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator
            size="small"
            color={v.spinner === 'onPrimary' ? colors.onPrimary : colors.inkSoft}
          />
          {!!loadingLabel && (
            <Text className={`font-semibold ${v.text} ${s.text}`}>{loadingLabel}</Text>
          )}
        </View>
      ) : (
        <Text className={`font-bold ${v.text} ${s.text}`} numberOfLines={1}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
