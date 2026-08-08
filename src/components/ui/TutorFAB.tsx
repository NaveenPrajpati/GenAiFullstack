import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Fixes: FAB overlapping content/bottom tab bar. Positioned at
// tab-bar-height + 16px gutter + the device's bottom safe-area inset, so it
// never sits on top of the tab bar or the last card, on any device.
const TAB_BAR_HEIGHT = 60;
const GUTTER = 16;

export function TutorFAB({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="absolute right-4 h-14 w-14 items-center justify-center rounded-full bg-indigo-600 shadow-lg dark:bg-cyan-400"
      style={{ bottom: TAB_BAR_HEIGHT + GUTTER + insets.bottom }}>
      <View className="h-6 w-6 rounded-full bg-white/90 dark:bg-slate-950/80" />
    </TouchableOpacity>
  );
}
