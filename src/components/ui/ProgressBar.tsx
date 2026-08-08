import { View } from 'react-native';

export function ProgressBar({
  pct,
  tone = 'primary',
}: {
  pct: number;
  tone?: 'primary' | 'success' | 'warning';
}) {
  const fill = tone === 'success' ? 'bg-success' : tone === 'warning' ? 'bg-warning' : 'bg-primary';
  return (
    <View className="bg-line h-2 overflow-hidden rounded-full">
      <View
        className={`h-full rounded-full ${fill}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </View>
  );
}
