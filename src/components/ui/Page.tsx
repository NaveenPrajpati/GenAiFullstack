import { View, type ViewProps } from 'react-native';

/**
 * The column every screen's content lives in.
 *
 * Phones get the full width minus a 16px gutter; past that the column stops
 * growing and centres, because a digest read across 1400px of monitor is a
 * worse experience than one read across 1100. Header and body both use it, so
 * their left edges line up at every width.
 */
export function PageBody({ className = '', ...props }: ViewProps & { className?: string }) {
  return (
    <View className={`w-full max-w-[1120px] self-center px-4 md:px-6 ${className}`} {...props} />
  );
}
