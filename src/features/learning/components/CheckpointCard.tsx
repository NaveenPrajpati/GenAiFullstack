/**
 * The active-recall check that gates completing a topic.
 *
 * Rendered inline inside the expanded topic card rather than on its own screen:
 * the point is that answering questions is part of working through a topic, not
 * a detour away from it. The same component handles a first attempt and a
 * spaced-repetition review — only the framing changes.
 */
import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useColors } from '@/components/ui/theme';
import type { Checkpoint, CheckpointOutcome } from '../types';

export function CheckpointCard({
  checkpoint,
  outcome,
  loading,
  error,
  onSubmit,
  onRetry,
  onClose,
}: {
  checkpoint: Checkpoint;
  outcome: CheckpointOutcome | null;
  loading: boolean;
  error: string;
  onSubmit: (answers: { question: number; answer: number }[]) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  /** Picks by question index. A map rather than an array sized to the questions,
   *  so a new set needs nothing initialised before it can be answered. */
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [pickedFor, setPickedFor] = useState<string | null>(null);
  const colors = useColors();

  // Clearing the picks for a new set is state adjusted during render rather than
  // in an effect. An effect runs *after* the paint, so a regenerated attempt
  // showed the previous set's selections against the new questions for a frame
  // before wiping them — and on a retry those two sets look alike enough that
  // the flash reads as the old answers having been kept.
  if (checkpoint.quizId !== pickedFor) {
    setPickedFor(checkpoint.quizId);
    setSelected({});
  }

  const answers = checkpoint.questions
    .map((_, i) => (selected[i] !== undefined ? { question: i, answer: selected[i] } : null))
    .filter((x): x is { question: number; answer: number } => x !== null);
  const answered = answers.length;
  const allAnswered = answered === checkpoint.questions.length;

  if (outcome) return <CheckpointResult outcome={outcome} onRetry={onRetry} onClose={onClose} />;

  return (
    <View className="border-warning bg-warning-soft mt-3 rounded-xl border p-4">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-warning text-xs font-semibold">
          {checkpoint.is_review ? '🔁 Review checkpoint' : '✍️ Checkpoint'}
        </Text>
        <Text className="text-warning text-xs">
          {answered}/{checkpoint.questions.length}
        </Text>
      </View>
      <Text className="text-ink-soft mb-3 text-xs">
        {checkpoint.is_review
          ? 'You finished this a while back — see if it stuck.'
          : `Score ${checkpoint.pass_score}% or more to complete this topic.`}
      </Text>

      {/* What a failure costs, before they answer. Attempts are capped per day,
          and finding that out by hitting the wall mid-session is the worst time
          to learn it. Only shown once one has been used — "3 tries left" on a
          first attempt reads as a warning where none is needed. */}
      {typeof checkpoint.attempts_today === 'number' &&
        typeof checkpoint.attempt_limit === 'number' &&
        checkpoint.attempts_today > 0 && (
          <Text className="text-ink-faint mb-2 text-[13px]">
            {Math.max(checkpoint.attempt_limit - checkpoint.attempts_today, 0)} of{' '}
            {checkpoint.attempt_limit} attempts left today
          </Text>
        )}

      {checkpoint.questions.map((q, qIdx) => (
        <View key={qIdx} className="bg-surface mb-3 rounded-lg p-3">
          <Text className="text-ink mb-2 text-sm font-medium">
            {qIdx + 1}. {q.question}
          </Text>
          {/* Same markup and the same roles as the recall check in `DigestCard`.
              They are one interaction wearing two visual treatments, and for a
              while only one of them said so — these options announced
              themselves as plain text with no indication that they were
              selectable, let alone which was selected. */}
          <View accessibilityRole="radiogroup" accessibilityLabel={q.question}>
            {q.options.map((opt, optIdx) => {
              const isSel = selected[qIdx] === optIdx;
              return (
                <TouchableOpacity
                  key={optIdx}
                  disabled={loading}
                  onPress={() => setSelected((prev) => ({ ...prev, [qIdx]: optIdx }))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSel }}
                  className={`mb-1.5 flex-row items-center gap-2 rounded-lg border px-3 py-2 ${
                    isSel ? 'border-warning bg-warning-soft' : 'border-line bg-surface-alt'
                  }`}
                  activeOpacity={0.7}>
                  <View
                    className={`h-3.5 w-3.5 rounded-full border-2 ${
                      isSel ? 'border-warning bg-warning' : 'border-line'
                    }`}
                  />
                  <Text
                    className={`flex-1 text-[13px] ${
                      isSel ? 'text-warning font-medium' : 'text-ink-soft'
                    }`}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {!!error && <Text className="text-danger mb-2 text-xs">{error}</Text>}

      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => onSubmit(answers)}
          disabled={!allAnswered || loading}
          className={`flex-1 items-center rounded-lg py-2.5 ${
            allAnswered && !loading ? 'bg-warning' : 'bg-surface-alt'
          }`}
          activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text className="text-on-primary text-sm font-semibold">
              {allAnswered ? 'Submit' : `Answer all ${checkpoint.questions.length}`}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onClose}
          disabled={loading}
          className="bg-surface-alt items-center rounded-lg px-4 py-2.5"
          activeOpacity={0.8}>
          <Text className="text-ink-soft text-sm font-medium">Later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CheckpointResult({
  outcome,
  onRetry,
  onClose,
}: {
  outcome: CheckpointOutcome;
  onRetry: () => void;
  onClose: () => void;
}) {
  const passed = outcome.passed;
  const nextReview = outcome.next_review_at
    ? new Date(outcome.next_review_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <View
      className={`mt-3 rounded-xl border p-4 ${
        passed ? 'border-success bg-success-soft' : 'border-warning bg-warning-soft'
      }`}>
      <Text className={`mb-1 text-sm font-bold ${passed ? 'text-success' : 'text-warning'}`}>
        {passed
          ? outcome.was_review
            ? '✓ Still got it'
            : '✓ Topic complete'
          : `Not quite — ${outcome.score}%`}
      </Text>
      <Text className="text-ink-soft mb-3 text-xs">
        {outcome.correct}/{outcome.total} correct · {outcome.pass_score}% to pass
        {nextReview ? ` · next review ${nextReview}` : ''}
      </Text>

      {/* Completing a topic hands the slot — and its daily tips — to the next one. */}
      {!!outcome.advanced_to && (
        <Text className="text-success mb-3 text-xs font-medium">
          ▶ Now on: {outcome.advanced_to.title}
        </Text>
      )}

      {/* A failed review keeps the topic completed — say so, or losing the tick
          would look like a bug. */}
      {!passed && outcome.was_review && (
        <Text className="text-ink-soft mb-3 text-xs">
          This stays complete — we&apos;ll just bring it back sooner.
        </Text>
      )}

      {/* On a pass the answers come back and are worth showing. On a failure the
          server sends the outcome and a hint instead — enough to know what to go
          over, not enough to copy down and re-enter. */}
      {outcome.review.length > 0 && (
        <View className="bg-surface mb-3 rounded-lg p-3">
          <Text className="text-ink-faint mb-1 text-xs font-semibold">
            {passed ? 'Worth another look' : 'Go over these before retrying'}
          </Text>
          {outcome.review.map((r, i) => (
            <View key={i} className="mb-1.5">
              <Text className="text-ink-soft text-xs">
                • Q{r.question + 1}
                {r.outcome ? ` — ${r.outcome}` : r.correctOption ? ` — ${r.correctOption}` : ''}
              </Text>
              {!!r.hint && (
                <Text className="text-ink-faint ml-3 text-[13px] leading-relaxed">{r.hint}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View className="flex-row gap-2">
        {!passed && (
          <TouchableOpacity
            onPress={onRetry}
            className="bg-warning flex-1 items-center rounded-lg py-2.5"
            activeOpacity={0.8}>
            <Text className="text-on-primary text-sm font-semibold">Try again</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onClose}
          className={`flex-1 items-center rounded-lg py-2.5 ${
            passed ? 'bg-success' : 'bg-surface-alt'
          }`}
          activeOpacity={0.8}>
          <Text className={`text-sm font-semibold ${passed ? 'text-on-primary' : 'text-ink-soft'}`}>
            {passed ? 'Continue' : 'Close'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
