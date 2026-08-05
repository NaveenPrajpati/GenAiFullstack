/**
 * The active-recall check that gates completing a topic.
 *
 * Rendered inline inside the expanded topic card rather than on its own screen:
 * the point is that answering questions is part of working through a topic, not
 * a detour away from it. The same component handles a first attempt and a
 * spaced-repetition review — only the framing changes.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

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
  const [selected, setSelected] = useState<(number | null)[]>([]);

  useEffect(() => {
    setSelected(new Array(checkpoint.questions.length).fill(null));
  }, [checkpoint.quizId]);

  const answered = selected.filter((s) => s !== null).length;
  const allAnswered = answered === checkpoint.questions.length;

  if (outcome) return <CheckpointResult outcome={outcome} onRetry={onRetry} onClose={onClose} />;

  return (
    <View className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-amber-700">
          {checkpoint.is_review ? '🔁 Review checkpoint' : '✍️ Checkpoint'}
        </Text>
        <Text className="text-xs text-amber-600">
          {answered}/{checkpoint.questions.length}
        </Text>
      </View>
      <Text className="mb-3 text-xs text-gray-600">
        {checkpoint.is_review
          ? 'You finished this a while back — see if it stuck.'
          : `Score ${checkpoint.pass_score}% or more to complete this topic.`}
      </Text>

      {checkpoint.questions.map((q, qIdx) => (
        <View key={qIdx} className="mb-3 rounded-lg bg-white p-3">
          <Text className="mb-2 text-sm font-medium text-gray-900">
            {qIdx + 1}. {q.question}
          </Text>
          {q.options.map((opt, optIdx) => {
            const isSel = selected[qIdx] === optIdx;
            return (
              <TouchableOpacity
                key={optIdx}
                disabled={loading}
                onPress={() =>
                  setSelected((prev) => {
                    const next = [...prev];
                    next[qIdx] = optIdx;
                    return next;
                  })
                }
                className={`mb-1.5 flex-row items-center gap-2 rounded-lg border px-3 py-2 ${
                  isSel ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-gray-50'
                }`}
                activeOpacity={0.7}>
                <View
                  className={`h-3.5 w-3.5 rounded-full border-2 ${
                    isSel ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
                  }`}
                />
                <Text
                  className={`flex-1 text-xs ${
                    isSel ? 'font-medium text-amber-900' : 'text-gray-700'
                  }`}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {!!error && <Text className="mb-2 text-xs text-red-600">{error}</Text>}

      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() =>
            onSubmit(
              selected
                .map((a, i) => (a !== null ? { question: i, answer: a } : null))
                .filter((x): x is { question: number; answer: number } => x !== null)
            )
          }
          disabled={!allAnswered || loading}
          className={`flex-1 items-center rounded-lg py-2.5 ${
            allAnswered && !loading ? 'bg-amber-500' : 'bg-gray-300'
          }`}
          activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-sm font-semibold text-white">
              {allAnswered ? 'Submit' : `Answer all ${checkpoint.questions.length}`}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onClose}
          disabled={loading}
          className="items-center rounded-lg bg-gray-200 px-4 py-2.5"
          activeOpacity={0.8}>
          <Text className="text-sm font-medium text-gray-700">Later</Text>
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
        passed ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
      }`}>
      <Text className={`mb-1 text-sm font-bold ${passed ? 'text-green-800' : 'text-orange-800'}`}>
        {passed
          ? outcome.was_review
            ? '✓ Still got it'
            : '✓ Topic complete'
          : `Not quite — ${outcome.score}%`}
      </Text>
      <Text className="mb-3 text-xs text-gray-600">
        {outcome.correct}/{outcome.total} correct · {outcome.pass_score}% to pass
        {nextReview ? ` · next review ${nextReview}` : ''}
      </Text>

      {/* Completing a topic hands the slot — and its daily tips — to the next one. */}
      {!!outcome.advanced_to && (
        <Text className="mb-3 text-xs font-medium text-green-800">
          ▶ Now on: {outcome.advanced_to.title}
        </Text>
      )}

      {/* A failed review keeps the topic completed — say so, or losing the tick
          would look like a bug. */}
      {!passed && outcome.was_review && (
        <Text className="mb-3 text-xs text-gray-600">
          This stays complete — we&apos;ll just bring it back sooner.
        </Text>
      )}

      {/* On a pass the answers come back and are worth showing. On a failure the
          server sends the outcome and a hint instead — enough to know what to go
          over, not enough to copy down and re-enter. */}
      {outcome.review.length > 0 && (
        <View className="mb-3 rounded-lg bg-white p-3">
          <Text className="mb-1 text-xs font-semibold text-gray-500">
            {passed ? 'Worth another look' : 'Go over these before retrying'}
          </Text>
          {outcome.review.map((r, i) => (
            <View key={i} className="mb-1.5">
              <Text className="text-xs text-gray-700">
                • Q{r.question + 1}
                {r.outcome ? ` — ${r.outcome}` : r.correctOption ? ` — ${r.correctOption}` : ''}
              </Text>
              {!!r.hint && (
                <Text className="ml-3 text-[11px] leading-relaxed text-gray-500">{r.hint}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View className="flex-row gap-2">
        {!passed && (
          <TouchableOpacity
            onPress={onRetry}
            className="flex-1 items-center rounded-lg bg-orange-500 py-2.5"
            activeOpacity={0.8}>
            <Text className="text-sm font-semibold text-white">Try again</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onClose}
          className={`flex-1 items-center rounded-lg py-2.5 ${
            passed ? 'bg-green-600' : 'bg-gray-200'
          }`}
          activeOpacity={0.8}>
          <Text className={`text-sm font-semibold ${passed ? 'text-white' : 'text-gray-700'}`}>
            {passed ? 'Continue' : 'Close'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
