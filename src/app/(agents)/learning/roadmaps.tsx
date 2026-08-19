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
import type { DueReview, LearningStats, Roadmap, RoadmapStatus } from '@/features/learning/types';
import { isCompleted } from '@/features/learning/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function getProgress(roadmap: Roadmap) {
  const total = roadmap.topics.length;
  const completed = roadmap.topics.filter(isCompleted).length;
  return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

const STATUS: Record<
  RoadmapStatus,
  { label: string; tone: 'success' | 'warning' | 'primary' | 'neutral' }
> = {
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  completed: { label: 'Completed', tone: 'primary' },
  archived: { label: 'Archived', tone: 'neutral' },
  draft: { label: 'Draft', tone: 'neutral' },
};

/**
 * The status controls for one roadmap.
 *
 * Only `active` roadmaps are drip-fed digests and only they show up on the home
 * screen, so this row is how a learner decides what they're actually working on.
 * Resume is disabled — not merely refused on tap — once the slots are full: the
 * cap is a fact about the account, and finding it out by being told "no" is a
 * worse way to learn it than seeing it before you reach for the button.
 */
function StatusActions({
  roadmap,
  slotsFull,
  busy,
  onSet,
  onDelete,
}: {
  roadmap: Roadmap;
  slotsFull: boolean;
  busy: boolean;
  onSet: (status: RoadmapStatus) => void;
  onDelete: () => void;
}) {
  const { status } = roadmap;
  // Delete sits apart from the status buttons and reads as text, not a button:
  // it's the one action here that can't be undone, and it shouldn't carry the
  // same size and weight as Pause.
  const deleteButton = (
    <TouchableOpacity
      onPress={onDelete}
      disabled={busy}
      className="px-2 py-2"
      activeOpacity={0.6}
      accessibilityRole="button">
      <Text className="text-danger text-[13px] font-semibold">Delete</Text>
    </TouchableOpacity>
  );

  const shell = 'border-line mt-3 flex-row items-center gap-2 border-t pt-3';

  if (status === 'archived') {
    return (
      <View className={shell}>
        <Text className="text-ink-faint flex-1 text-[13px]">Archived</Text>
        {deleteButton}
        <Button label="Restore" variant="secondary" size="sm" onPress={() => onSet('paused')} />
      </View>
    );
  }

  // A finished roadmap has nothing left to drip-feed, so pause and resume would
  // mean nothing — but it still needs a way out of the list, and deleting one is
  // the most likely thing a learner wants to do with it.
  if (status === 'completed') {
    return (
      <View className={shell}>
        <Text className="text-success flex-1 text-[13px] font-semibold">✓ Finished</Text>
        {deleteButton}
        <Button label="Archive" variant="secondary" size="sm" onPress={() => onSet('archived')} />
      </View>
    );
  }

  const active = status === 'active';
  const canResume = !active && !slotsFull;

  return (
    <View className={shell}>
      {active ? (
        <Button
          label="Pause"
          variant="secondary"
          size="sm"
          full
          loading={busy}
          loadingLabel="Pausing…"
          onPress={() => onSet('paused')}
        />
      ) : (
        <Button
          label={canResume ? 'Resume' : 'No free slot'}
          size="sm"
          full
          disabled={!canResume}
          loading={busy}
          loadingLabel="Resuming…"
          onPress={() => onSet('active')}
        />
      )}

      <Button label="Archive" variant="secondary" size="sm" onPress={() => onSet('archived')} />
      {deleteButton}
    </View>
  );
}

/** Aggregate progress across every roadmap. Hidden until there's something to
 *  summarize, so a new account isn't greeted by a row of zeros. */
function StatsStrip({ stats }: { stats: LearningStats }) {
  if (stats.topics.total === 0) return null;

  const tiles: Stat[] = [
    { value: `${stats.topics.completed}/${stats.topics.total}`, label: 'topics done' },
    // Against the cap, not bare: "2" alone doesn't say whether there's room.
    { value: `${stats.roadmaps.active}/${stats.roadmaps.max_active}`, label: 'running' },
    { value: stats.completed_this_week, label: 'this week' },
    {
      value: stats.streak_days > 0 ? `🔥 ${stats.streak_days}` : '—',
      label: 'day streak',
      tone: stats.streak_days > 0 ? 'streak' : 'default',
    },
  ];
  // Mastery rather than the lifetime quiz average: the average counts a week-one
  // failure as evidence about today and stops moving once there's any history, so
  // it reads as a fixed property of the learner.
  if (stats.mastery?.score !== null && stats.mastery?.score !== undefined) {
    // Carries how many topics it was measured over, for the same reason the
    // Today tile does: it is the mean over graded topics, not over the roadmap.
    tiles.push({
      value: `${stats.mastery.score}%`,
      label: `mastery · ${stats.mastery.topics_scored} graded`,
      tone: 'success',
    });
  }

  return (
    <>
      {/* The same tiles as Today, from the same component — 2×2 on a phone, one
          row once there's width. They sit on the page rather than inside the
          card below: a bordered tile on a bordered card reads as a box in a box. */}
      <View className="mb-3">
        <StatsGrid stats={tiles} />
      </View>

      <Card className="mb-3">
        <View className="mb-2.5 flex-row items-center justify-between">
          <Text className="text-ink text-[15px] font-bold">Overall progress</Text>
          <Text className="text-primary text-[15px] font-bold">{stats.topics.percent}%</Text>
        </View>
        <ProgressBar pct={stats.topics.percent} />
      </Card>
    </>
  );
}

/** Topics whose spaced-repetition review has come due. Sits above the roadmap
 *  list because reviewing what's fading matters more than starting something new. */
function ReviewsCard({
  reviews,
  onOpen,
}: {
  reviews: DueReview[];
  /** Each row names one topic, so it opens that topic rather than the roadmap
   *  it sits on — the review is the thing being offered. */
  onOpen: (review: DueReview) => void;
}) {
  return (
    <View className="border-warning bg-warning-soft mb-3 rounded-2xl border p-4">
      <Text className="text-warning text-[15px] font-bold">
        🔁 {reviews.length} {reviews.length === 1 ? 'topic' : 'topics'} due for review
      </Text>
      <Text className="text-ink-soft mt-0.5 mb-3 text-[13px]">
        A quick check keeps these from fading.
      </Text>
      {reviews.slice(0, 3).map((r) => (
        <TouchableOpacity
          key={`${r.roadmapId}:${r.topicId}`}
          onPress={() => onOpen(r)}
          className="bg-surface mb-1.5 flex-row items-center justify-between gap-2 rounded-xl px-3 py-2.5"
          activeOpacity={0.7}>
          <View className="flex-1">
            <Text className="text-ink text-[15px] font-medium" numberOfLines={1}>
              {r.title}
            </Text>
            <Text className="text-ink-faint text-[13px]" numberOfLines={1}>
              {r.roadmapTitle}
            </Text>
          </View>
          <Text className="text-warning text-[15px]">→</Text>
        </TouchableOpacity>
      ))}
      {reviews.length > 3 && (
        <Text className="text-ink-soft mt-1 text-[13px]">+{reviews.length - 3} more waiting</Text>
      )}
    </View>
  );
}

export default function RoadmapsScreen() {
  const router = useRouter();
  const {
    roadmaps,
    roadmapsLoading,
    roadmapsError,
    fetchRoadmaps,
    setRoadmapStatus,
    removeRoadmap,
    stats,
    fetchStats,
    reviews,
    fetchReviews,
  } = useLearningStore();
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [statusError, setStatusError] = useState('');
  const colors = useColors();
  const wide = useWideNav();

  useFocusEffect(
    useCallback(() => {
      // Two independent reads — the summary spans all roadmaps while the list
      // below is paginated — so fire them together rather than in sequence.
      // Digests live on the home screen now, not here.
      fetchRoadmaps();
      fetchStats();
      fetchReviews();
    }, [])
  );

  // Counted from the list rather than from stats: this screen is where the
  // learner is changing them, and the list is what its own writes update.
  const running = roadmaps.filter((r) => r.status === 'active').length;
  const maxActive = stats?.roadmaps.max_active ?? running;

  const applyStatus = async (roadmap: Roadmap, status: RoadmapStatus) => {
    setStatusError('');
    setStatusBusy(roadmap._id);
    try {
      await setRoadmapStatus(roadmap._id, status);
    } catch (e: any) {
      setStatusError(e?.message ?? 'Could not change that roadmap.');
    } finally {
      setStatusBusy(null);
    }
  };

  const handleStatus = (roadmap: Roadmap, status: RoadmapStatus) => {
    // Archiving is the one that's awkward to undo by accident — it drops the
    // roadmap out of every list that matters. Pausing and resuming are cheap.
    if (status !== 'archived') return applyStatus(roadmap, status);
    Alert.alert(
      `Archive ${roadmap.title}?`,
      'It stops getting digests and leaves your roadmap list. You can restore it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => applyStatus(roadmap, status),
        },
      ]
    );
  };

  const handleDelete = (roadmap: Roadmap) => {
    const { completed, total } = getProgress(roadmap);
    // Name what actually goes, and say archiving exists. A learner who wanted to
    // stop a roadmap rather than erase it shouldn't find that out afterwards —
    // this is the one action on the screen with nothing behind it.
    Alert.alert(
      `Delete ${roadmap.title}?`,
      `This permanently removes the roadmap, its ${total} topic${total === 1 ? '' : 's'}` +
        `${completed > 0 ? ` (${completed} completed)` : ''}, and every digest, note, ` +
        'quiz and score on it. This cannot be undone — archive it instead if you ' +
        'only want it out of the way.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive instead',
          onPress: () => applyStatus(roadmap, 'archived'),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setStatusError('');
            setStatusBusy(roadmap._id);
            try {
              const linked = await removeRoadmap(roadmap._id);
              if (linked > 0) {
                // They live in the assistant's task list and were left alone on
                // purpose; saying so beats them turning up unexplained.
                setStatusError(
                  `Deleted. ${linked} to-do${linked === 1 ? '' : 's'} from this roadmap ` +
                    'are still in your task list.'
                );
              }
            } catch (e: any) {
              setStatusError(e?.message ?? 'Could not delete that roadmap.');
            } finally {
              setStatusBusy(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View className="bg-bg flex-1">
        {/* Narrow screens reach the drawer through here — the stack's native
            header is off, and the sidebar that would carry it isn't rendered
            below the breakpoint. */}
        <ScreenHeader
          title="Learning"
          subtitle="Your roadmaps"
          showMenu={!wide}
          actions={<ThemeToggle />}>
          <SectionNav />
        </ScreenHeader>

        {/* Summary and reviews scroll with the list rather than sitting above it:
          pinned, they ate most of a phone's viewport before the first roadmap. */}
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
          <PageBody className="pt-3">
            {!!stats && <StatsStrip stats={stats} />}

            {reviews.length > 0 && (
              <ReviewsCard
                reviews={reviews}
                onOpen={(r) => router.push(`/learning/${r.roadmapId}/${r.topicId}`)}
              />
            )}

            {!!statusError && (
              <View className="border-danger bg-danger-soft mb-3 rounded-xl border p-3">
                <Text className="text-danger text-[13px]">{statusError}</Text>
              </View>
            )}

            {roadmapsLoading && (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="text-ink-faint mt-3 text-[13px]">Loading roadmaps…</Text>
              </View>
            )}

            {!roadmapsLoading && !!roadmapsError && (
              <View className="border-danger bg-danger-soft mb-4 rounded-xl border p-4">
                <Text className="text-danger mb-2 text-[15px]">{roadmapsError}</Text>
                <Button
                  label="Retry"
                  variant="secondary"
                  size="sm"
                  onPress={() => fetchRoadmaps()}
                />
              </View>
            )}

            {!roadmapsLoading && !roadmapsError && roadmaps.length === 0 && (
              <DashedCard className="items-center px-6 py-10">
                <Text className="mb-2 text-5xl">📚</Text>
                <Text className="text-ink mb-1 text-[20px] font-bold">No roadmaps yet</Text>
                <Text className="text-ink-soft text-center text-[15px] leading-relaxed">
                  Chat with the AI tutor to create your first learning roadmap.
                </Text>
              </DashedCard>
            )}

            {roadmaps.length > 0 && (
              <SectionLabel>{`Your roadmaps · ${roadmaps.length}`}</SectionLabel>
            )}

            {roadmaps.map((roadmap) => {
              const { completed, total, pct } = getProgress(roadmap);
              const badge = STATUS[roadmap.status] ?? STATUS.draft;
              // Parked and archived roadmaps stay legible but visibly recede — what
              // matters at a glance is which ones are actually running.
              const dimmed = roadmap.status === 'archived' || roadmap.status === 'paused';
              return (
                <Card key={roadmap._id} className={`mb-3 ${dimmed ? 'opacity-75' : ''}`}>
                  <TouchableOpacity
                    onPress={() => router.push(`/learning/${roadmap._id}`)}
                    activeOpacity={0.8}>
                    <View className="flex-row items-start justify-between gap-3">
                      <Text className="text-ink flex-1 text-[20px] font-bold" numberOfLines={2}>
                        {roadmap.title}
                      </Text>
                      <Badge square label={badge.label} tone={badge.tone} />
                    </View>

                    <Text
                      className="text-ink-soft mt-1 mb-3 text-[15px] leading-relaxed"
                      numberOfLines={2}>
                      {roadmap.summary}
                    </Text>

                    <ProgressBar
                      pct={pct}
                      tone={roadmap.status === 'completed' ? 'success' : 'primary'}
                    />
                    <View className="mt-1.5 flex-row items-center justify-between">
                      <Text className="text-ink-faint text-[13px]">
                        {completed}/{total} topics
                      </Text>
                      <Text className="text-primary text-[13px] font-bold">{pct}%</Text>
                    </View>

                    {roadmap.stages.length > 0 && (
                      <View className="mt-3 flex-row flex-wrap gap-1.5">
                        {roadmap.stages.map((s, ind) => (
                          <Badge key={ind} label={s.title} tone="neutral" />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>

                  <StatusActions
                    roadmap={roadmap}
                    slotsFull={running >= maxActive}
                    busy={statusBusy === roadmap._id}
                    onSet={(status) => handleStatus(roadmap, status)}
                    onDelete={() => handleDelete(roadmap)}
                  />
                </Card>
              );
            })}
          </PageBody>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
