/**
 * Why a checkpoint wouldn't open. Three refusals reach here — revision owed,
 * cooldown, and the daily cap — and each wants a different next move, so none of
 * them is served by a bare error string.
 */
import { Button } from '@/components/ui/Button';
import { Text, View } from 'react-native';

import type { CheckpointBlocked } from '../types';

export function CheckpointBlockedCard({
  blocked,
  busy,
  onRevise,
  onDismiss,
}: {
  blocked: CheckpointBlocked;
  busy: boolean;
  onRevise: () => void;
  onDismiss: () => void;
}) {
  const revision = blocked.blocked_reason === 'needs_revision';
  return (
    <View className="border-warning bg-warning-soft mt-3 rounded-xl border p-4">
      <Text className="text-warning text-[15px] font-bold">
        {revision ? 'Revision first' : 'Not just yet'}
      </Text>
      <Text className="text-ink-soft mt-1 text-[15px] leading-relaxed">{blocked.message}</Text>

      {/* The questions that failed it. Naming them turns "go revise" into
          something the learner can actually act on. */}
      {!!blocked.weak_points?.length && (
        <View className="mt-2.5">
          {blocked.weak_points.map((w, i) => (
            <Text key={i} className="text-ink-soft mt-0.5 text-[13px] leading-relaxed">
              • {w}
            </Text>
          ))}
        </View>
      )}

      {typeof blocked.attempts_today === 'number' && typeof blocked.limit === 'number' && (
        <Text className="text-ink-faint mt-2 text-[13px]">
          {blocked.attempts_today} of {blocked.limit} attempts used today
        </Text>
      )}

      <View className="mt-3 flex-row gap-2">
        {revision && (
          <Button
            label="Get revision tips"
            size="sm"
            full
            loading={busy}
            loadingLabel="Writing them…"
            onPress={onRevise}
          />
        )}
        <Button label="OK" variant="secondary" size="sm" onPress={onDismiss} />
      </View>
    </View>
  );
}
