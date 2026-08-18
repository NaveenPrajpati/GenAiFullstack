import { Badge, SectionLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, DashedCard } from '@/components/ui/Card';
import DigestCard from '@/components/ui/cards/DigestCard';
import { PageBody } from '@/components/ui/Page';
import { ProgressBar } from '@/components/ui/ProgressBar';
import ScreenHeader from '@/components/ui/ScreenHeader';
import SectionNav, { useWideNav } from '@/components/ui/SectionNav';
import { StatsGrid, type Stat } from '@/components/ui/StatTile';
import { useColors } from '@/components/ui/theme';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { BriefingCard, useBriefingAction } from '@/features/learning/components/Briefing';
import { useLearningStore } from '@/features/learning/store';
import type {
  BlockedReason,
  Digest,
  LearningStats,
  MasterySummary,
  RoadmapFocus,
} from '@/features/learning/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
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
      // The denominator is part of the number. Mastery is the mean over topics
      // that have been *graded*, not over the roadmap — so two passed
      // checkpoints out of twenty-one topics reads 99%, and beside a "2/21
      // topics" tile that looks like a claim on the whole subject. Naming what
      // it was measured over is the difference between a strong number and a
      // misleading one. "Graded" rather than "completed" on purpose: a recall
      // check on the topic you are mid-way through counts too.
      label: `mastery · ${mastery.topics_scored} graded`,
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
            <Text className="text-ink-faint text-[13px]" numberOfLines={1}>
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

/** "3 min ago" / "yesterday" — how old the cached Today on screen is. */
function savedAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/**
 * The one line that tells the learner the screen isn't live.
 *
 * Two different things are worth saying and they can be true at once, so the
 * more consequential one wins: unsynced work is a promise the app has made on
 * the server's behalf, while stale content is only stale.
 *
 * `stale` is deliberately both conditions — content did come off disk *and*
 * nothing has reached the server since. Either alone is a false alarm: a cache
 * that has already been refreshed is live, and an empty Today with no cache
 * behind it has nothing to be stale about.
 */
function OfflineNotice({
  savedAt,
  reachedServer,
  pending,
}: {
  savedAt: string | null;
  reachedServer: boolean;
  pending: number;
}) {
  const stale = !!savedAt && !reachedServer;
  if (!stale && pending === 0) return null;
  return (
    <View className="border-line bg-surface-alt mb-3 rounded-xl border px-3.5 py-2.5">
      <Text className="text-ink-soft text-[13px]">
        {pending > 0
          ? `${pending === 1 ? '1 digest' : `${pending} digests`} marked offline — syncing when you're back online`
          : `Offline — showing your saved digests from ${savedAgo(savedAt!)}`}
      </Text>
    </View>
  );
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
    cacheSavedAt,
    reachedServer,
    pendingMarks,
    flushPendingMarks,
    briefing,
    briefingLoading,
    fetchBriefing,
  } = useLearningStore();
  const runBriefingAction = useBriefingAction();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Which roadmap is generating, not just whether one is: with several cards on
  // screen, a shared flag spins all of them at once.
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const colors = useColors();
  const wide = useWideNav();

  useFocusEffect(
    useCallback(() => {
      // Anything already cached is on screen by now; these refresh it in the
      // background. Draining first means a mark made offline is settled with the
      // server before the fetches below ask it what the queue looks like.
      flushPendingMarks();
      fetchUnreadDigests();
      fetchStats();
      fetchReviews();
      fetchFocus();
      // Cheap on a repeat visit: the server replays one briefing per situation,
      // so this is a cache read until something the learner did changes it.
      fetchBriefing();
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
    written: Record<number, string>,
    generateNext: boolean
  ) => {
    setBusy(digest._id);
    setError('');
    try {
      const result = await markDigest(digest._id, { answers, written, generateNext });
      // Banked offline: the card is gone and the queue notice explains why, so
      // the "no next digest" reasoning below — all of which reads the server's
      // reply — has nothing to work with and would only mislead.
      if (result.queued) return;
      if (generateNext && !result.generated) {
        // No next digest has three different causes, and only one of them is
        // "nothing to send". Reporting them all the same way told a learner who
        // had just finished a topic to sit and wait.
        setError(
          result.revision_cleared
            ? ''
            : result.topic_status === 'needs_review'
              ? "That's the last of the tips — the checkpoint completes this topic."
              : "Nothing new to send yet — you're up to date on that topic."
        );
      }
      fetchStats();
      fetchFocus();
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
            {/* Above the numbers deliberately: the tiles say how far along you
                are, the briefing says what to do in the next ten minutes, and
                only one of those is worth the top of the screen. */}
            <BriefingCard
              briefing={briefing}
              loading={briefingLoading}
              busy={!!generatingFor}
              onAction={runBriefingAction}
            />

            {tiles.length > 0 && (
              <View className="mb-4">
                <StatsGrid stats={tiles} />
              </View>
            )}

            <OfflineNotice
              savedAt={cacheSavedAt}
              reachedServer={reachedServer}
              pending={pendingMarks.length}
            />

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
                    <Text className="text-ink-faint text-[13px]">
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
                onMark={(answers, written, next) => handleMark(d, answers, written, next)}
              />
            ))}

            {caughtUp && running > 0 && <CaughtUp hasRoadmaps />}
          </PageBody>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
