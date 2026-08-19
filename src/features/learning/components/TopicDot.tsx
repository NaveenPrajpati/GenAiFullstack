/**
 * The rail down the left of the topic list: one dot per topic, joined by a line.
 *
 * The dot is also the control, which is why it carries a hit slop far larger than
 * it looks — at 20px across it was easy to miss entirely, and that made the
 * tracker look like it had no way to record anything.
 *
 * It is a `button`, not a `checkbox`: only one of the five things it can do is
 * ticking anything off. The state it reports lives in the label instead, where it
 * can name what is actually about to happen — see `topicAction`.
 */
import { Text, TouchableOpacity, View } from 'react-native';

export function TopicDot({
  done,
  ready,
  started,
  last,
  label,
  hint,
  onPress,
}: {
  done: boolean;
  ready: boolean;
  started: boolean;
  /** Suppresses the connecting line, so the rail stops at the last topic instead
   *  of trailing off under the next stage heading. */
  last: boolean;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const ring = done
    ? 'border-success bg-success'
    : ready
      ? 'border-warning bg-warning'
      : started
        ? 'border-primary bg-primary'
        : 'border-line bg-surface';

  return (
    <View className="w-7 items-center">
      <TouchableOpacity
        onPress={onPress}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        className={`mt-1.5 h-4 w-4 items-center justify-center rounded-full border-2 ${ring}`}>
        {done && <Text className="text-on-primary text-[9px] font-bold">✓</Text>}
      </TouchableOpacity>
      {!last && <View className="bg-line w-px flex-1" />}
    </View>
  );
}
