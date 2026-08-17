import { Text, View } from 'react-native';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'streak';

// Written out rather than derived from `text` at runtime: Tailwind only emits
// class names it can see in the source, so a built-up `bg-${…}` string compiles
// to nothing.
const TONE: Record<Tone, { bg: string; text: string; dot: string }> = {
  neutral: { bg: 'bg-surface-alt', text: 'text-ink-soft', dot: 'bg-ink-soft' },
  primary: { bg: 'bg-primary-soft', text: 'text-primary', dot: 'bg-primary' },
  success: { bg: 'bg-success-soft', text: 'text-success', dot: 'bg-success' },
  warning: { bg: 'bg-warning-soft', text: 'text-warning', dot: 'bg-warning' },
  danger: { bg: 'bg-danger-soft', text: 'text-danger', dot: 'bg-danger' },
  streak: { bg: 'bg-streak-soft', text: 'text-streak', dot: 'bg-streak' },
};

/**
 * `square` (rounded rect) for status — "Now on: Gradient Descent", "New".
 * The default pill is for tags: Foundations, Intermediate, …
 */
export function Badge({
  label,
  tone = 'neutral',
  square = false,
  dot = false,
}: {
  label: string;
  tone?: Tone;
  square?: boolean;
  /** A leading dot, for badges that report live state rather than a category. */
  dot?: boolean;
}) {
  const t = TONE[tone];
  return (
    <View
      className={`${t.bg} ${square ? 'rounded-md' : 'rounded-full'} flex-row items-center gap-1.5 self-start px-2.5 py-1`}>
      {dot && <View className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />}
      <Text className={`text-[12px] font-bold ${t.text}`} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The 12/700 uppercase caption that opens a section ("TODAY'S DIGEST").
 *
 * 12 rather than the 13 the body copy uses, and rather than the 11 this and the
 * badge above it started at: these two are the only type in the app allowed
 * under 13, because a caption and a one-word tag are read as landmarks rather
 * than as prose. Anything carrying a fact — a count, a duration, a status —
 * belongs at 13 even when it looks like a caption.
 */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-ink-faint mb-2 text-[12px] font-bold tracking-wider uppercase">
      {children}
    </Text>
  );
}
