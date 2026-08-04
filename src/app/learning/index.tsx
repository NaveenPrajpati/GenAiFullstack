import ScreenHeader from '@/components/layout/ScreenHeader';
import { useLearningStore } from '@/features/learning/store';
import type {
  BlockedReason,
  Digest,
  LearningStats,
  QuizResult,
  RoadmapFocus,
} from '@/features/learning/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';

/**
 * The learning home: what needs attention today.
 *
 * Digests lead because they're time-sensitive, and because acknowledging one is
 * the only signal we get that it landed. The roadmap list lives a tap away at
 * /learning/roadmaps — browsing is the less common intent.
 *
 * Everything scrolls in one list. A learner can have several roadmaps running,
 * so pinning their cards above the scroll view would eat the screen and leave
 * the digest queue in a sliver.
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

/** Nothing running: either there's no roadmap at all, or every one is parked. */
function NoActiveRoadmaps({ hasRoadmaps }: { hasRoadmaps: boolean }) {
  const router = useRouter();
  return (
    <View className="mb-3 rounded-2xl border border-dashed border-gray-300 bg-white p-5">
      <Text className="mb-1 text-base font-bold text-gray-900">
        {hasRoadmaps ? 'Nothing running' : 'No roadmap yet'}
      </Text>
      <Text className="mb-4 text-sm leading-relaxed text-gray-500">
        {hasRoadmaps
          ? 'Every roadmap is paused. Resume one to start getting digests again.'
          : "Ask the tutor what you want to learn and it'll build you one."}
      </Text>
      <TouchableOpacity
        onPress={() => router.push('/learning/roadmaps')}
        className="self-start rounded-lg bg-violet-600 px-4 py-2.5"
        activeOpacity={0.8}>
        <Text className="text-sm font-medium text-white">
          {hasRoadmaps ? 'Manage roadmaps' : 'Get started'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * One running roadmap: where the learner is on it, and the single action that
 * moves it forward. Shown whether or not digests are waiting — an empty home
 * screen answers none of "what am I doing, and what happens next".
 */
function FocusCard({
  focus,
  onGenerate,
  generating,
}: {
  focus: RoadmapFocus;
  onGenerate: () => void;
  generating: boolean;
}) {
  const router = useRouter();

  // Every blocked state says why, and what to do instead.
  const note: Record<BlockedReason, string> = {
    cap_reached: `${focus.unread} unread on this topic — clear those first.`,
    awaiting_quiz: 'Pass the recall check on an earlier digest to unlock the next one.',
    needs_review: "You've covered this topic. Pass its checkpoint to move on.",
    roadmap_complete: 'Every topic is done. Time for a new roadmap.',
    digests_off: 'Daily digests are off — you can still pull one now.',
    no_roadmap: '',
  };
  const review = focus.blocked_reason === 'needs_review';

  return (
    <View className="mb-3 overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <TouchableOpacity
        onPress={() => router.push(`/learning/${focus.roadmapId}`)}
        className="p-4 pb-3"
        activeOpacity={0.7}>
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 text-base font-bold text-gray-900" numberOfLines={1}>
            {focus.roadmapTitle}
          </Text>
          <Text className="mt-0.5 text-[11px] font-semibold text-violet-600">
            {focus.progress.percent}%
          </Text>
        </View>

        {!!focus.topic && (
          <View className="mt-1 flex-row items-center gap-1.5">
            <View
              className={`h-1.5 w-1.5 rounded-full ${review ? 'bg-amber-500' : 'bg-green-500'}`}
            />
            <Text className="flex-1 text-xs text-gray-500" numberOfLines={1}>
              {review ? 'Ready for checkpoint: ' : 'Now on: '}
              <Text className="font-medium text-gray-800">{focus.topic.title}</Text>
            </Text>
          </View>
        )}

        <View className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <View
            className={`h-1.5 rounded-full ${review ? 'bg-amber-400' : 'bg-violet-500'}`}
            style={{ width: `${focus.progress.percent}%` }}
          />
        </View>
        <Text className="mt-1.5 text-[11px] text-gray-400">
          {focus.progress.completed_count}/{focus.progress.total} topics
          {focus.unread > 0 ? ` · ${focus.unread} unread` : ''}
        </Text>
      </TouchableOpacity>

      {/* One action per card, and it's the one that moves this roadmap forward.
          Pausing and resuming live on the roadmap list, which is where the whole
          set is visible and a swap actually makes sense. */}
      <View className="flex-row items-center gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5">
        {review ? (
          <TouchableOpacity
            onPress={() => router.push(`/learning/${focus.roadmapId}`)}
            className="flex-1 items-center rounded-lg bg-amber-500 py-2"
            activeOpacity={0.8}>
            <Text className="text-xs font-semibold text-white">Take the checkpoint</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onGenerate}
            disabled={!focus.can_generate || generating}
            className={`flex-1 items-center rounded-lg py-2 ${
              focus.can_generate && !generating ? 'bg-violet-100' : 'bg-gray-100'
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
                Generate digest
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {!!focus.blocked_reason && !!note[focus.blocked_reason] && (
        <Text className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
          {note[focus.blocked_reason]}
        </Text>
      )}
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
  } = useLearningStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Which roadmap is generating, not just whether one is: with several cards on
  // screen, a shared flag spins all of them at once.
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadDigests();
      fetchStats();
      fetchReviews();
      fetchFocus();
    }, [])
  );

  // `topicId` is optional because a card's topic can legitimately be absent — a
  // finished roadmap has none, and the server falls back to whatever is underway.
  const handleGenerate = async (id: string, topicId?: string) => {
    setError('');
    setGeneratingFor(id);
    try {
      const digest = await generateNextDigest(id, topicId);
      if (!digest) setError(useLearningStore.getState().digestError);
      // Generating changes the backlog and may complete the topic's coverage.
      fetchFocus();
      fetchUnreadDigests();
    } finally {
      setGeneratingFor(null);
    }
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
  // /focus already returns exactly the active roadmaps, so it — not the stats
  // strip — is what "running" means here; the two are fetched separately and
  // one of them is always momentarily behind the other.
  const running = focus?.roadmaps.length ?? 0;
  const maxActive = stats?.roadmaps.max_active ?? running;
  const parked = stats?.roadmaps.paused ?? 0;

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

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {!!error && (
          <View className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <Text className="text-xs text-red-700">{error}</Text>
          </View>
        )}

        {!!focus && (
          <>
            {/* The schedule is one account-wide setting, so it's stated once
                here rather than repeated on every card. */}
            <View className="mb-2 flex-row items-baseline justify-between">
              <Text className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                {running > 0 ? `Running · ${running} of ${maxActive}` : 'Roadmaps'}
              </Text>
              <Text className="text-[11px] text-gray-400">
                {focus.next_at ? `Next digest ${untilNext(focus.next_at)}` : 'No digest scheduled'}
              </Text>
            </View>

            {focus.roadmaps.length === 0 ? (
              <NoActiveRoadmaps hasRoadmaps={(stats?.roadmaps.total ?? 0) > 0} />
            ) : (
              focus.roadmaps.map((item) => (
                <FocusCard
                  key={item.roadmapId}
                  focus={item}
                  onGenerate={() => handleGenerate(item.roadmapId, item.topic?.id)}
                  generating={generatingFor === item.roadmapId}
                />
              ))
            )}

            {/* A free slot is only worth mentioning once there's something to
                put in it. */}
            {running < maxActive && parked > 0 && (
              <TouchableOpacity
                onPress={() => router.push('/learning/roadmaps')}
                className="mb-3 flex-row items-center justify-between rounded-xl border border-dashed border-violet-200 bg-violet-50 px-3 py-2.5"
                activeOpacity={0.8}>
                <Text className="flex-1 text-xs text-violet-700" numberOfLines={1}>
                  {maxActive - running === 1 ? '1 free slot' : `${maxActive - running} free slots`}{' '}
                  — resume a paused roadmap
                </Text>
                <Text className="text-violet-400">→</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {reviews.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push(`/learning/${reviews[0].roadmapId}`)}
            className="mb-3 flex-row items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3"
            activeOpacity={0.8}>
            <Text className="flex-1 text-xs text-amber-800" numberOfLines={1}>
              🔁 {reviews.length} {reviews.length === 1 ? 'topic' : 'topics'} due for review
            </Text>
            <Text className="text-amber-400">→</Text>
          </TouchableOpacity>
        )}

        {!caughtUp && (
          <Text className="mt-1 mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
            To catch up on
          </Text>
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

        {/* No big empty state: the cards above already say what's underway and
            when the next digest lands, which is the useful answer to an empty
            queue. */}
        {caughtUp && running > 0 && (
          <Text className="py-6 text-center text-xs text-gray-400">✨ Nothing to catch up on</Text>
        )}
      </ScrollView>
    </View>
  );
}
