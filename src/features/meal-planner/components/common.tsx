/** Small shared presentational bits used across Meal Planner screens. */
import { Text, TouchableOpacity, View } from 'react-native';

/** A grey placeholder block for loading skeletons. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <View className={`rounded-lg bg-gray-200 ${className}`} />;
}

/** A few stacked card skeletons. */
export function CardSkeletons({ count = 3 }: { count?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} className="rounded-xl border border-gray-200 bg-white p-4">
          <Skeleton className="mb-2 h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </View>
      ))}
    </View>
  );
}

/** Inline error card with a Retry action (mirrors the app's error pattern). */
export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
      <Text className="mb-2 text-sm text-red-700">{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} accessibilityRole="button">
          <Text className="text-sm font-medium text-red-600">Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Centered empty state. */
export function EmptyState({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="items-center rounded-xl border border-dashed border-gray-300 bg-white p-10">
      <Text className="mb-2 text-4xl">{emoji}</Text>
      <Text className="text-base font-semibold text-gray-900">{title}</Text>
      {!!subtitle && <Text className="mt-1 text-center text-sm text-gray-500">{subtitle}</Text>}
    </View>
  );
}
