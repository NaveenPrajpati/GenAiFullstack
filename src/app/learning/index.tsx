import { Badge, SectionLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, DashedCard } from '@/components/ui/Card';
import { PageBody } from '@/components/ui/Page';
import { ProgressBar } from '@/components/ui/ProgressBar';
import ScreenHeader from '@/components/ui/ScreenHeader';
import SectionNav, { useWideNav } from '@/components/ui/SectionNav';
import { StatsGrid, type Stat } from '@/components/ui/StatTile';
import { useColors } from '@/components/ui/theme';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useLearningStore } from '@/features/learning/store';
import type {
  BlockedReason,
  Digest,
  LearningStats,
  MasterySummary,
  QuizResult,
  RoadmapFocus,
} from '@/features/learning/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TREND_MARK: Record<MasterySummary['trend'], string> = {
  improving: '↑',
  slipping: '↓',
  steady: '→',
  new: '',
};

/** The four (sometimes five) numbers at the top: 2×2 on a phone, one row wider. */
function statTiles(stats: LearningStats): Stat[] {
  if (stats.topics.total === 0) return [];
  const { mastery } = stats;

  const tiles: Stat[] = [
    { value: `${stats.topics.completed}/${stats.topics.total}`, label: 'topics' },
    {
      value: stats.streak_days > 0 ? `🔥 ${stats.streak_days}` : '—',
      label: 'streak',
      tone: stats.streak_days > 0 ? 'streak' : 'default',
    },
    { value: stats.completed_this_week, label: 'this week' },
  ];

  // Mastery leads the right-hand side once anything has been graded: it answers
  // "how well do I know this", which none of the counts above do. Null is not
  // zero — nothing graded yet means the tile is left out entirely.
  if (mastery?.score !== null && mastery?.score !== undefined) {
    tiles.push({
      value: `${mastery.score}%${TREND_MARK[mastery.trend]}`,
      label: 'mastery',
      tone: mastery.trend === 'slipping' ? 'warning' : 'success',
    });
  }
  if (stats.reviews_due > 0) tiles.push({ value: stats.reviews_due, label: 'to review' });

  return tiles;
}

/** The topics holding the mastery number down, and a way into them. Sits with
 *  the reviews prompt because it answers the same question — what to do next —
 *  from the other direction: not what's due, but what isn't sticking. */
function WeakestTopics({ mastery }: { mastery: MasterySummary }) {
  const router = useRouter();
  if (mastery.weakest.length === 0 || mastery.score === null) return null;
  // Everything above this is holding fine; naming a "weakest" topic then would
  // invent a problem out of the bottom of a healthy spread.
  const shaky = mastery.weakest.filter((t) => t.mastery < 70);
  if (shaky.length === 0) return null;

  return (
    <Card className="mb-3">
      <SectionLabel>Not sticking yet</SectionLabel>
      {shaky.map((t) => (
        <TouchableOpacity
          key={`${t.roadmapId}:${t.topicId}`}
          onPress={() => router.push(`/learning/${t.roadmapId}`)}
          className="mb-1.5 flex-row items-center justify-between gap-2"
          activeOpacity={0.7}>
          <View className="flex-1">
            <Text className="text-ink text-[15px] font-medium" numberOfLines={1}>
              {t.title}
            </Text>
            <Text className="text-ink-faint text-[11px]" numberOfLines={1}>
              {t.overdue_days > 0
                ? `review ${t.overdue_days}d overdue`
                : `${t.attempts} attempt${t.attempts === 1 ? '' : 's'}`}
              {t.trend === 'slipping' ? ' · slipping' : ''}
            </Text>
          </View>
          <Text className="text-warning text-[13px] font-bold">{t.mastery}%</Text>
        </TouchableOpacity>
      ))}
    </Card>
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
    <DashedCard className="mb-3 p-5">
      <Text className="text-ink mb-1 text-[20px] font-bold">
        {hasRoadmaps ? 'Nothing running' : 'No roadmap yet'}
      </Text>
      <Text className="text-ink-soft mb-4 text-[15px] leading-relaxed">
        {hasRoadmaps
          ? 'Every roadmap is paused. Resume one to start getting digests again.'
          : "Ask the tutor what you want to learn and it'll build you one."}
      </Text>
      <Button
        label={hasRoadmaps ? 'Manage roadmaps' : 'Get started'}
        onPress={() => router.push('/learning/roadmaps')}
      />
    </DashedCard>
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
  nextAt,
}: {
  focus: RoadmapFocus;
  onGenerate: () => void;
  generating: boolean;
  /** Only passed when this is the only running roadmap — see the list below. */
  nextAt?: string | null;
}) {
  const router = useRouter();

  // Every blocked state says why, and what to do instead.
  const note: Record<BlockedReason, string> = {
    cap_reached: `${focus.unread} unread on this topic — clear those first.`,
    awaiting_quiz: 'Pass the recall check on an earlier digest to unlock the next one.',
    needs_revision: "That checkpoint didn't pass — go over the revision tips, then retry.",
    needs_review: "You've covered this topic. Pass its checkpoint to move on.",
    roadmap_complete: 'Every topic is done. Time for a new roadmap.',
    digests_off: 'Daily digests are off — you can still pull one now.',
    no_roadmap: '',
  };
  const review = focus.blocked_reason === 'needs_review';
  // A failed checkpoint owes revision before a retry, so the action here is to
  // fetch those tips — offering "Take the checkpoint" would just be refused.
  const revising = focus.blocked_reason === 'needs_revision';

  return (
    <Card className="mb-3">
      <TouchableOpacity
        onPress={() => router.push(`/learning/${focus.roadmapId}`)}
        activeOpacity={0.7}>
        <View className="flex-row items-start justify-between gap-3">
          <Text className="text-ink flex-1 text-[20px] font-bold" numberOfLines={2}>
            {focus.roadmapTitle}
          </Text>
          {/* Shrinks rather than pushes: a long topic title truncates inside the
              badge instead of driving the roadmap title off the card. */}
          {!!focus.topic && (
            <View className="max-w-[55%] shrink">
              <Badge
                square
                tone={revising ? 'danger' : review ? 'warning' : 'success'}
                label={`${revising ? 'Revising' : review ? 'Checkpoint' : 'Now on'}: ${focus.topic.title}`}
              />
            </View>
          )}
        </View>

        <Text className="text-ink-soft mt-1 text-[13px]">
          {focus.progress.completed_count}/{focus.progress.total} topics
          {focus.unread > 0 ? ` · ${focus.unread} unread` : ''}
          {` · ${focus.progress.percent}%`}
        </Text>

        <View className="mt-3">
          <ProgressBar pct={focus.progress.percent} tone={review ? 'warning' : 'primary'} />
        </View>
      </TouchableOpacity>

      {/* One action per card, and it's the one that moves this roadmap forward.
          Pausing and resuming live on the roadmap list, which is where the whole
          set is visible and a swap actually makes sense. */}
      <View className="mt-3 flex-row items-center justify-between gap-3">
        {review ? (
          <Button
            label="Take the checkpoint"
            onPress={() => router.push(`/learning/${focus.roadmapId}`)}
          />
        ) : (
          <Button
            label={
              revising
                ? focus.can_generate
                  ? 'Get revision tips'
                  : 'Revision tips waiting'
                : 'Continue learning'
            }
            onPress={onGenerate}
            disabled={!focus.can_generate}
            loading={generating}
            loadingLabel="Putting one together…"
          />
        )}
        {!!nextAt && (
          <Text className="text-ink-faint shrink text-right text-[13px]" numberOfLines={1}>
            Next digest {untilNext(nextAt)}
          </Text>
        )}
      </View>

      {!!focus.blocked_reason && !!note[focus.blocked_reason] && (
        <Text className="border-line text-ink-faint mt-3 border-t pt-2.5 text-[13px]">
          {note[focus.blocked_reason]}
        </Text>
      )}
    </Card>
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
  // Sources are collapsed by default: they're a side door out of the digest,
  // not the thing being read.
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    setSelected(new Array(questions.length).fill(null));
  }, [digest._id, questions.length]);

  const answered = selected.filter((s) => s !== null).length;
  const ready = questions.length === 0 || answered === questions.length;
  const answers = selected
    .map((a, i) => (a !== null ? { question: i, answer: a } : null))
    .filter((x): x is { question: number; answer: number } => x !== null);

  const sources = digest.resources.filter((r) => !!r.url);

  return (
    <Card className="mb-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-ink text-[17px] font-bold">{digest.topicTitle}</Text>
          <Text className="text-ink-faint mt-0.5 text-[13px]">
            {digest.roadmapTitle ? `${digest.roadmapTitle} · ` : ''}
            {digest.sequence ? `Digest #${digest.sequence} · ` : ''}
            {new Date(digest.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
        <Badge label={digest.kind === 'revision' ? 'REVISION' : 'NEW'} tone="primary" square />
      </View>

      <View className="mt-3 gap-1.5">
        {digest.bullets.map((b, i) => (
          <View key={i} className="flex-row gap-2">
            <Text className="text-ink-faint text-[15px] leading-relaxed">•</Text>
            <Text className="text-ink-soft flex-1 text-[15px] leading-relaxed">{b}</Text>
          </View>
        ))}
      </View>

      {sources.length > 0 && (
        <View className="mt-3">
          <TouchableOpacity onPress={() => setShowSources((v) => !v)} activeOpacity={0.7}>
            <Text className="text-primary text-[13px] font-semibold">
              {sources.length} source{sources.length === 1 ? '' : 's'} {showSources ? '▾' : '↗'}
            </Text>
          </TouchableOpacity>
          {showSources && (
            <View className="mt-1.5 gap-1">
              {sources.map((r, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => Linking.openURL(r.url).catch(() => {})}
                  activeOpacity={0.7}>
                  <Text className="text-primary text-[13px] underline" numberOfLines={1}>
                    {r.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {questions.length > 0 && (
        <View className="border-line mt-3 border-t pt-3">
          <SectionLabel>Quick check</SectionLabel>
          {questions.map((q, qIdx) => (
            <View key={qIdx} className="mb-2">
              <Text className="text-ink mb-2 text-[15px] font-medium">
                {questions.length > 1 ? `${qIdx + 1}. ` : ''}
                {q.question}
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
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSel }}
                    className={`mb-1.5 flex-row items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                      isSel ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
                    }`}
                    activeOpacity={0.7}>
                    <View
                      className={`h-4 w-4 items-center justify-center rounded-full border-2 ${
                        isSel ? 'border-primary' : 'border-line'
                      }`}>
                      {isSel && <View className="bg-primary h-2 w-2 rounded-full" />}
                    </View>
                    <Text className="text-ink flex-1 text-[15px]">{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          {!!failure && (
            <Text className="text-danger text-[13px]">
              {failure.correct}/{failure.total} right — look back over the tips and try again.
            </Text>
          )}
        </View>
      )}

      {digest.coverage_complete && (
        <TouchableOpacity
          onPress={() => router.push(`/learning/${digest.roadmapId}`)}
          className="bg-success-soft mt-3 rounded-xl p-3"
          activeOpacity={0.8}>
          <Text className="text-success text-[13px] font-semibold">
            ✓ That covers this topic — take the checkpoint to complete it →
          </Text>
        </TouchableOpacity>
      )}

      <View className="mt-4 flex-row gap-2.5">
        <Button
          label="Mark"
          variant="secondary"
          onPress={() => onMark(answers, false)}
          disabled={!ready}
          loading={busy}
          full
        />
        {/* Generating costs a search and an LLM call, so it stays an explicit
            choice rather than something every acknowledgement triggers. */}
        <Button
          label="Mark & next"
          onPress={() => onMark(answers, true)}
          disabled={busy || !ready || digest.coverage_complete}
          full
        />
      </View>
    </Card>
  );
}

/** Nothing waiting — said as an achievement, with the way back in. */
function CaughtUp({ hasRoadmaps }: { hasRoadmaps: boolean }) {
  const router = useRouter();
  return (
    <Card className="items-center px-6 py-8">
      <Text className="text-[28px]">🎉</Text>
      <Text className="text-ink mt-2 text-[20px] font-bold">You&apos;re all caught up</Text>
      <Text className="text-ink-soft mt-1 mb-4 text-center text-[15px] leading-relaxed">
        {hasRoadmaps
          ? 'No digests waiting. Check back tomorrow, or explore a roadmap.'
          : 'Start a roadmap and your first digest will land here.'}
      </Text>
      <Button
        label="Browse roadmaps"
        variant={hasRoadmaps ? 'secondary' : 'primary'}
        onPress={() => router.push('/learning/roadmaps')}
      />
    </Card>
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
  const colors = useColors();
  const wide = useWideNav();

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
  const tiles = stats ? statTiles(stats) : [];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View className="bg-bg flex-1">
        <ScreenHeader
          title="Today"
          subtitle={caughtUp ? "You're all caught up" : `${unreadDigests.length} to catch up on`}
          // The sidebar carries its own drawer opener, so on wide screens this
          // would be the second button on screen doing the same thing.
          showMenu={!wide}
          actions={<ThemeToggle />}>
          <SectionNav />
        </ScreenHeader>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          <PageBody className="pt-3">
            {tiles.length > 0 && (
              <View className="mb-4">
                <StatsGrid stats={tiles} />
              </View>
            )}

            {!!error && (
              <View className="border-danger bg-danger-soft mb-3 rounded-xl border p-3">
                <Text className="text-danger text-[13px]">{error}</Text>
              </View>
            )}

            {!!focus && (
              <>
                {/* The schedule is one account-wide setting, so with several
                    roadmaps running it's stated once here rather than repeated
                    on each card; with one, it belongs beside that card's action. */}
                {running !== 1 && (
                  <View className="mb-2 flex-row items-baseline justify-between gap-2">
                    <SectionLabel>
                      {running > 0 ? `Running · ${running} of ${maxActive}` : 'Roadmaps'}
                    </SectionLabel>
                    <Text className="text-ink-faint text-[11px]">
                      {focus.next_at
                        ? `Next digest ${untilNext(focus.next_at)}`
                        : 'No digest scheduled'}
                    </Text>
                  </View>
                )}

                {focus.roadmaps.length === 0 ? (
                  <NoActiveRoadmaps hasRoadmaps={(stats?.roadmaps.total ?? 0) > 0} />
                ) : (
                  focus.roadmaps.map((item) => (
                    <FocusCard
                      key={item.roadmapId}
                      focus={item}
                      nextAt={running === 1 ? focus.next_at : null}
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
                    className="border-primary bg-primary-soft mb-3 flex-row items-center justify-between gap-2 rounded-xl border-[1.5px] border-dashed px-3.5 py-3"
                    activeOpacity={0.8}>
                    <Text className="text-primary flex-1 text-[13px] font-medium" numberOfLines={1}>
                      {maxActive - running === 1
                        ? '1 free slot'
                        : `${maxActive - running} free slots`}{' '}
                      — resume a paused roadmap
                    </Text>
                    <Text className="text-primary text-[13px]">→</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {reviews.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push(`/learning/${reviews[0].roadmapId}`)}
                className="border-warning bg-warning-soft mb-3 flex-row items-center justify-between gap-2 rounded-xl border px-3.5 py-3"
                activeOpacity={0.8}>
                <Text className="text-warning flex-1 text-[13px] font-medium" numberOfLines={1}>
                  🔁 {reviews.length} {reviews.length === 1 ? 'topic' : 'topics'} due for review
                </Text>
                <Text className="text-warning text-[13px]">→</Text>
              </TouchableOpacity>
            )}

            {!!stats?.mastery && <WeakestTopics mastery={stats.mastery} />}

            {!caughtUp && <SectionLabel>Today&apos;s digest</SectionLabel>}

            {unreadDigests.map((d) => (
              <DigestCard
                key={d._id}
                digest={d}
                failure={digestQuizFailures[d._id]}
                busy={busy === d._id}
                onMark={(answers, next) => handleMark(d, answers, next)}
              />
            ))}

            {caughtUp && running > 0 && <CaughtUp hasRoadmaps />}
          </PageBody>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
