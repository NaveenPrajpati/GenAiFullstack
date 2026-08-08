import { MoonIcon, SunIcon } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';
import { useColors, useTheme } from './theme';

/** Switches Direction A (Clarity) ⇄ Direction B (Deep Focus). */
export function ThemeToggle() {
  const scheme = useTheme((s) => s.scheme);
  const toggle = useTheme((s) => s.toggle);
  const colors = useColors();
  const isDark = scheme === 'dark';

  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="bg-surface-alt h-10 w-10 items-center justify-center rounded-full">
      {isDark ? (
        <SunIcon size={18} color={colors.ink} />
      ) : (
        <MoonIcon size={18} color={colors.ink} />
      )}
    </TouchableOpacity>
  );
}
