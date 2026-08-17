import { Text, View } from 'react-native';

export type Stat = {
  value: string | number;
  label: string;
  tone?: 'default' | 'warning' | 'success' | 'streak';
};

const VALUE_TONE = {
  default: 'text-ink',
  warning: 'text-warning',
  success: 'text-success',
  streak: 'text-streak',
} as const;

export function StatTile({ value, label, tone = 'default' }: Stat) {
  return (
    // No `h-full`: `height: 100%` is a no-op on web against an auto-height
    // parent, but Yoga resolves it against the available height, so on device
    // each tile grew to fill the screen. Tiles on a row already come out equal
    // height from the wrapper's default `align-items: stretch`.
    <View className="border-line bg-surface grow items-center justify-center rounded-xl border px-2 py-3">
      <Text className={`text-[17px] font-extrabold ${VALUE_TONE[tone]}`} numberOfLines={1}>
        {value}
      </Text>
      <Text className="text-ink-faint mt-0.5 text-[13px]" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * 2×2 on a phone, one row once there's width for it.
 *
 * The mechanism is `basis` + wrap, not fixed percentages: at `basis-[47%]` two
 * tiles plus the gap are the most that fit, so it breaks after the second, and
 * `md:basis-0` lets all of them share one line. Percentage widths got this
 * wrong on web, where the earlier `native:flex-wrap` never applied and the tiles
 * silently overflowed the row.
 */
export function StatsGrid({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-2.5">
      {stats.map((s) => (
        <View key={s.label} className="min-h-16 flex-1 basis-[47%] md:basis-0">
          <StatTile {...s} />
        </View>
      ))}
    </View>
  );
}
