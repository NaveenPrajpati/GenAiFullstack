import ScreenHeader from '@/components/layout/ScreenHeader';
import { useLearningStore } from '@/features/learning/store';
import type { Digest, LearningFocus, LearningStats, QuizResult } from '@/features/learning/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';

/**
 * The learning home: what needs attention today.
 *
 * Digests lead because they're time-sensitive, and because acknowledging one is
 * the only signal we get that it landed. The roadmap list lives a tap away at
 * /learning/roadmaps — browsing is the less common intent.
 */

function StatsRow({ stats }: { stats: LearningStats }) {
  if (stats.topics.total === 0) return null;
  const tiles: [string | number, string][] = [
    [`${stats.topics.completed}/${stats.topics.total}`, 'topics'],
    [stats.streak_days > 0 ? `🔥 ${stats.streak_days}` : '—', 'streak'],
    [stats.completed_this_week, 'this week'],
  ];
  if (stats.reviews_due > 0) tiles.push([stats.reviews_due, 'to review']);

  return (
    <View className="mx-4 mt-3 flex-row rounded-xl border border-gray-200 bg-white p-3">
      {tiles.map(([value, label]) => (
        <View key={label} className="flex-1 items-center">
          <Text className="text-base font-bold text-gray-900">{value}</Text>
          <Text className="text-[10px] text-gray-400">{label}</Text>
        </View>
      ))}
    </View>
  );
}

/** "in 6h" / "tomorrow 09:00" / "Fri 09:00" — however far out it is. */
function untilNext(iso: string): string {
  const at = new Date(iso);
  const hours = (at.getTime() - Date.now()) / 3_600_000;
  const clock = at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  if (hours <= 0) return 'any moment';
  if (hours < 1) return `in ${Math.max(Math.round(hours * 60), 1)} min`;
  if (hours < 12) return `in ${Math.round(hours)}h`;
  if (at.toDateString() === new Date(Date.now() + 86_400_000).toDateString())
    return `tomorrow ${clock}`;
  return `${at.toLocaleDateString(undefined, { weekday: 'short' })} ${clock}`;
}

/**
 * What the learner is on right now. Shown whether or not digests are waiting —
 * an empty home screen answers none of "what am I doing, and what happens next".
 */
function FocusCard({
  focus,
  onGenerate,
  generating,
}: {
  focus: LearningFocus;
  onGenerate: () => void;
  generating: boolean;
}) {
  const router = useRouter();
  if (!focus.roadmapId) {
    return (
      <View className="mx-4 mt-3 rounded-xl border border-dashed border-gray-300 bg-white p-5">
        <Text className="mb-1 text-base font-bold text-gray-900">No roadmap yet</Text>
        <Text className="mb-4 text-sm leading-relaxed text-gray-500">
          Ask the tutor what you want to learn and it&apos;ll build you one.
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/learning/roadmaps')}
          className="self-start rounded-lg bg-violet-600 px-4 py-2.5"
          activeOpacity={0.8}>
          <Text className="text-sm font-medium text-white">Get started</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Every blocked state says why, and what to do instead.
  const note: Record<string, string> = {
    cap_reached: `You have ${focus.unread} unread on this topic — clear those first.`,
    needs_review: 'You&apos;ve covered this topic. Pass its checkpoint to move on.',
    roadmap_complete: 'Every topic is done. Time for a new roadmap.',
    digests_off: 'Daily digests are switched off — you can still pull one now.',
  };

  return (
    <View className="mx-4 mt-3 rounded-xl border border-gray-200 bg-white p-4">
      <TouchableOpacity
        onPress={() => router.push(`/learning/${focus.roadmapId}`)}
        activeOpacity={0.7}>
        <Text className="text-base font-bold text-gray-900">{focus.roadmapTitle}</Text>
        {!!focus.topic && (
          <Text className="mt-0.5 text-sm text-gray-600">
            {focus.blocked_reason === 'needs_review' ? 'Ready for checkpoint: ' : 'Now on: '}
            <Text className="font-medium text-gray-900">{focus.topic.title}</Text>
          </Text>
        )}
      </TouchableOpacity>

      <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <View
          className="h-1.5 rounded-full bg-violet-500"
          style={{ width: `${focus.progress.percent}%` }}
        />
      </View>
      <Text className="mt-1 text-[11px] text-gray-400">
        {focus.progress.completed_count}/{focus.progress.total} topics · {focus.progress.percent}%
      </Text>

      <View className="mt-3 border-t border-gray-100 pt-3">
        <Text className="text-xs text-gray-500">
          {focus.next_at ? `Next digest ${untilNext(focus.next_at)}` : 'No digest scheduled'}
        </Text>
        {!!focus.blocked_reason && (
          <Text className="mt-0.5 text-[11px] text-gray-400">{note[focus.blocked_reason]}</Text>
        )}

        {focus.blocked_reason === 'needs_review' ? (
          <TouchableOpacity
            onPress={() => router.push(`/learning/${focus.roadmapId}`)}
            className="mt-2 items-center rounded-lg bg-amber-500 py-2.5"
            activeOpacity={0.8}>
            <Text className="text-xs font-semibold text-white">Take the checkpoint</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onGenerate}
            disabled={!focus.can_generate || generating}
            className={`mt-2 items-center rounded-lg py-2.5 ${
              focus.can_generate && !generating ? 'bg-violet-50' : 'bg-gray-100'
            }`}
            activeOpacity={0.8}>
            {generating ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" />
                <Text className="text-xs text-gray-500">Putting one together…</Text>
              </View>
            ) : (
              <Text
                className={`text-xs font-semibold ${
                  focus.can_generate ? 'text-violet-700' : 'text-gray-400'
                }`}>
                Generate digest now
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/**
 * One digest, with the two actions that move it along.
 *
 * From the second digest on a topic, marking is gated on a short recall check
 * over the earlier ones — which is what makes "mark" mean the learner read it
 * rather than swiped it away.
 */
function DigestCard({
  digest,
  failure,
  onMark,
  busy,
}: {
  digest: Digest;
  failure?: QuizResult;
  onMark: (answers: { question: number; answer: number }[], generateNext: boolean) => void;
  busy: boolean;
}) {
  const router = useRouter();
  const questions = digest.quiz ?? [];
  const [selected, setSelected] = useState<(number | null)[]>([]);

  useEffect(() => {
    setSelected(new Array(questions.length).fill(null));
  }, [digest._id, questions.length]);

  const answered = selected.filter((s) => s !== null).length;
  const ready = questions.length === 0 || answered === questions.length;
  const answers = selected
    .map((a, i) => (a !== null ? { question: i, answer: a } : null))
    .filter((x): x is { question: number; answer: number } => x !== null);

  return (
    <View className="mb-3 rounded-xl border border-gray-200 bg-white p-4">
      <View className="mb-1 flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-sm font-semibold text-gray-900">{digest.topicTitle}</Text>
          <Text className="text-[10px] text-gray-400">
            {digest.roadmapTitle ? `${digest.roadmapTitle} · ` : ''}
            {digest.sequence ? `#${digest.sequence} · ` : ''}
            {new Date(digest.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
        <View className="rounded-full bg-violet-100 px-2 py-0.5">
          <Text className="text-[10px] font-medium text-violet-700">New</Text>
        </View>
      </View>

      <View className="mt-2">
        {digest.bullets.map((b, i) => (
          <Text key={i} className="mb-1 text-xs leading-relaxed text-gray-700">
            • {b}
          </Text>
        ))}
      </View>

      {digest.resources.length > 0 && (
        <View className="mt-2 border-t border-gray-100 pt-2">
          {digest.resources.slice(0, 3).map((r, i) => (
            <TouchableOpacity
              key={i}
              disabled={!r.url}
              onPress={() => r.url && Linking.openURL(r.url).catch(() => {})}>
              <Text className="mb-0.5 text-[11px] text-blue-600 underline" numberOfLines={1}>
                {r.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {questions.length > 0 && (
        <View className="mt-3 rounded-lg bg-amber-50 p-3">
          <Text className="mb-2 text-[11px] font-semibold text-amber-700">
            Quick recall — from the earlier tips on this topic
          </Text>
          {questions.map((q, qIdx) => (
            <View key={qIdx} className="mb-2">
              <Text className="mb-1.5 text-xs font-medium text-gray-800">
                {qIdx + 1}. {q.question}
              </Text>
              {q.options.map((opt, optIdx) => {
                const isSel = selected[qIdx] === optIdx;
                return (
                  <TouchableOpacity
                    key={optIdx}
                    disabled={busy}
                    onPress={() =>
                      setSelected((prev) => {
                        const next = [...prev];
                        next[qIdx] = optIdx;
                        return next;
                      })
                    }
                    className={`mb-1 flex-row items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                      isSel ? 'border-amber-400 bg-white' : 'border-transparent bg-white/60'
                    }`}
                    activeOpacity={0.7}>
                    <View
                      className={`h-3 w-3 rounded-full border-2 ${
                        isSel ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
                      }`}
                    />
                    <Text className="flex-1 text-xs text-gray-700">{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          {!!failure && (
            <Text className="text-[11px] text-red-600">
              {failure.correct}/{failure.total} right — look back over the tips and try again.
            </Text>
          )}
        </View>
      )}

      {digest.coverage_complete && (
        <TouchableOpacity
          onPress={() => router.push(`/learning/${digest.roadmapId}`)}
          className="mt-3 rounded-lg bg-green-50 p-2.5"
          activeOpacity={0.8}>
          <Text className="text-[11px] font-medium text-green-800">
            ✓ That covers this topic — take the checkpoint to complete it →
          </Text>
        </TouchableOpacity>
      )}

      <View className="mt-3 flex-row gap-2">
        <TouchableOpacity
          onPress={() => onMark(answers, false)}
          disabled={busy || !ready}
          className={`flex-1 items-center rounded-lg py-2.5 ${
            busy || !ready ? 'bg-gray-200' : 'bg-green-600'
          }`}
          activeOpacity={0.8}>
          {busy ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text className={`text-xs font-semibold ${ready ? 'text-white' : 'text-gray-400'}`}>
              Mark
            </Text>
          )}
        </TouchableOpacity>
        {/* Generating costs a search and an LLM call, so it stays an explicit
            choice rather than something every acknowledgement triggers. */}
        <TouchableOpacity
          onPress={() => onMark(answers, true)}
          disabled={busy || !ready || digest.coverage_complete}
          className={`flex-1 items-center rounded-lg py-2.5 ${
            busy || !ready || digest.coverage_complete ? 'bg-gray-200' : 'bg-violet-600'
          }`}
          activeOpacity={0.8}>
          <Text
            className={`text-xs font-semibold ${
              busy || !ready || digest.coverage_complete ? 'text-gray-400' : 'text-white'
            }`}>
            Mark &amp; next
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function LearningHome() {
  const router = useRouter();
  const {
    unreadDigests,
    fetchUnreadDigests,
    markDigest,
    digestQuizFailures,
    stats,
    fetchStats,
    reviews,
    fetchReviews,
    focus,
    fetchFocus,
    generateNextDigest,
    generatingDigest,
  } = useLearningStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchUnreadDigests();
      fetchStats();
      fetchReviews();
      fetchFocus();
    }, [])
  );

  const handleGenerate = async (id: string) => {
    setError('');
    const digest = await generateNextDigest(id ?? undefined);
    if (!digest) setError(useLearningStore.getState().digestError);
    // Generating changes the backlog and may complete the topic's coverage.
    fetchFocus();
  };

  const handleMark = async (
    digest: Digest,
    answers: { question: number; answer: number }[],
    generateNext: boolean
  ) => {
    setBusy(digest._id);
    setError('');
    try {
      const result = await markDigest(digest._id, { answers, generateNext });
      if (generateNext && !result.generated) {
        setError("Nothing new to send yet — you're up to date on that topic.");
      }
      fetchStats();
    } catch (e: any) {
      setError(e?.message ?? 'Could not mark that digest.');
    } finally {
      setBusy(null);
    }
  };

  const caughtUp = unreadDigests.length === 0;

  return (
    <View className="flex-1 bg-gray-50">
      <ScreenHeader
        title="Today"
        subtitle={caughtUp ? "You're all caught up" : `${unreadDigests.length} to catch up on`}
        right={
          <>
            <TouchableOpacity
              onPress={() => router.push('/learning/roadmaps')}
              className="rounded-lg bg-gray-100 px-3 py-2">
              <Text className="text-xs font-medium text-gray-700">Roadmaps</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/learning/notes')}
              className="rounded-lg bg-gray-100 px-3 py-2">
              <Text className="text-xs font-medium text-gray-700">Notes</Text>
            </TouchableOpacity>
          </>
        }
      />

      {!!stats && <StatsRow stats={stats} />}
      {!!focus &&
        focus.roadmaps.map((item, ind) => (
          <FocusCard
            focus={item}
            onGenerate={() => handleGenerate(item.roadmapId)}
            generating={generatingDigest}
          />
        ))}

      {reviews.length > 0 && (
        <TouchableOpacity
          onPress={() => router.push(`/learning/${reviews[0].roadmapId}`)}
          className="mx-4 mt-3 flex-row items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3"
          activeOpacity={0.8}>
          <Text className="flex-1 text-xs text-amber-800" numberOfLines={1}>
            🔁 {reviews.length} {reviews.length === 1 ? 'topic' : 'topics'} due for review
          </Text>
          <Text className="text-amber-400">→</Text>
        </TouchableOpacity>
      )}

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {!!error && (
          <View className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <Text className="text-xs text-red-700">{error}</Text>
          </View>
        )}

        {unreadDigests.map((d) => (
          <DigestCard
            key={d._id}
            digest={d}
            failure={digestQuizFailures[d._id]}
            busy={busy === d._id}
            onMark={(answers, next) => handleMark(d, answers, next)}
          />
        ))}

        {/* No big empty state: the focus card above already says what's underway
            and when the next digest lands, which is the useful answer to an
            empty queue. */}
        {caughtUp && !!focus?.roadmapId && (
          <Text className="py-6 text-center text-xs text-gray-400">✨ Nothing to catch up on</Text>
        )}
      </ScrollView>
    </View>
  );
}
