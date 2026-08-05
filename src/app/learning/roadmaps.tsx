import ScreenHeader from '@/components/layout/ScreenHeader';
import { useLearningStore } from '@/features/learning/store';
import type { DueReview, LearningStats, Roadmap, RoadmapStatus } from '@/features/learning/types';
import { isCompleted } from '@/features/learning/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { SettingsIcon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

function getProgress(roadmap: Roadmap) {
  const total = roadmap.topics.length;
  const completed = roadmap.topics.filter(isCompleted).length;
  return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

const STATUS_STYLES: Record<RoadmapStatus, { pill: string; text: string }> = {
  active: { pill: 'bg-green-100', text: 'text-green-700' },
  paused: { pill: 'bg-amber-100', text: 'text-amber-700' },
  completed: { pill: 'bg-violet-100', text: 'text-violet-700' },
  archived: { pill: 'bg-gray-100', text: 'text-gray-500' },
  draft: { pill: 'bg-gray-100', text: 'text-gray-500' },
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
  // it's the one action here that can't be undone, and it shouldn't be the same
  // size and weight as Pause.
  const deleteButton = (
    <TouchableOpacity onPress={onDelete} disabled={busy} className="px-2 py-2" activeOpacity={0.6}>
      <Text className="text-[11px] font-medium text-red-500">Delete</Text>
    </TouchableOpacity>
  );

  if (status === 'archived') {
    return (
      <View className="flex-row items-center gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5">
        <Text className="flex-1 text-[11px] text-gray-400">Archived</Text>
        {deleteButton}
        <TouchableOpacity
          onPress={() => onSet('paused')}
          disabled={busy}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5"
          activeOpacity={0.7}>
          <Text className="text-[11px] font-medium text-gray-600">Restore</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // A finished roadmap has nothing left to drip-feed, so pause and resume would
  // mean nothing — but it still needs a way out of the list, and deleting one is
  // the most likely thing a learner wants to do with it.
  if (status === 'completed') {
    return (
      <View className="flex-row items-center gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5">
        <Text className="flex-1 text-[11px] text-gray-400">✓ Finished</Text>
        {deleteButton}
        <TouchableOpacity
          onPress={() => onSet('archived')}
          disabled={busy}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5"
          activeOpacity={0.7}>
          <Text className="text-[11px] font-medium text-gray-600">Archive</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const active = status === 'active';
  const canResume = !active && !slotsFull;

  return (
    <View className="flex-row items-center gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5">
      {active ? (
        <TouchableOpacity
          onPress={() => onSet('paused')}
          disabled={busy}
          className="flex-1 items-center rounded-lg border border-gray-200 bg-white py-2"
          activeOpacity={0.7}>
          <Text className="text-[11px] font-semibold text-gray-600">
            {busy ? 'Pausing…' : 'Pause'}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => onSet('active')}
          disabled={busy || !canResume}
          className={`flex-1 items-center rounded-lg py-2 ${
            canResume ? 'bg-violet-600' : 'bg-gray-200'
          }`}
          activeOpacity={0.8}>
          <Text
            className={`text-[11px] font-semibold ${canResume ? 'text-white' : 'text-gray-400'}`}>
            {busy ? 'Resuming…' : canResume ? 'Resume' : 'No free slot'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => onSet('archived')}
        disabled={busy}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2"
        activeOpacity={0.7}>
        <Text className="text-[11px] font-medium text-gray-500">Archive</Text>
      </TouchableOpacity>

      {deleteButton}
    </View>
  );
}

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-lg font-bold text-gray-900">{value}</Text>
      <Text className="text-center text-[10px] leading-tight text-gray-400">{label}</Text>
    </View>
  );
}

/** Aggregate progress across every roadmap. Hidden until there's something to
 *  summarize, so a new account isn't greeted by a row of zeros. */
function StatsStrip({ stats }: { stats: LearningStats }) {
  if (stats.topics.total === 0) return null;
  return (
    <View className="mx-4 mt-3 rounded-xl border border-gray-200 bg-white p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-gray-500">Overall progress</Text>
        <Text className="text-xs font-semibold text-violet-600">{stats.topics.percent}%</Text>
      </View>
      <View className="mb-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <View
          className="h-1.5 rounded-full bg-violet-500"
          style={{ width: `${stats.topics.percent}%` }}
        />
      </View>
      <View className="flex-row">
        <StatTile value={`${stats.topics.completed}/${stats.topics.total}`} label="topics done" />
        {/* Against the cap, not bare: "2" alone doesn't say whether there's room. */}
        <StatTile value={`${stats.roadmaps.active}/${stats.roadmaps.max_active}`} label="running" />
        <StatTile value={stats.completed_this_week} label="this week" />
        <StatTile
          value={stats.streak_days > 0 ? `🔥 ${stats.streak_days}` : '—'}
          label="day streak"
        />
        {/* Mastery rather than the lifetime quiz average: the average counts a
            week-one failure as evidence about today and stops moving once there's
            any history, so it reads as a fixed property of the learner. */}
        {stats.mastery?.score !== null && stats.mastery?.score !== undefined && (
          <StatTile value={`${stats.mastery.score}%`} label="mastery" />
        )}
      </View>
    </View>
  );
}

/** Topics whose spaced-repetition review has come due. Sits above the roadmap
 *  list because reviewing what's fading matters more than starting something new. */
function ReviewsCard({
  reviews,
  onOpen,
}: {
  reviews: DueReview[];
  onOpen: (roadmapId: string) => void;
}) {
  return (
    <View className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <Text className="mb-1 text-sm font-semibold text-amber-800">
        🔁 {reviews.length} {reviews.length === 1 ? 'topic' : 'topics'} due for review
      </Text>
      <Text className="mb-3 text-xs text-amber-700">A quick check keeps these from fading.</Text>
      {reviews.slice(0, 3).map((r) => (
        <TouchableOpacity
          key={`${r.roadmapId}:${r.topicId}`}
          onPress={() => onOpen(r.roadmapId)}
          className="mb-1.5 flex-row items-center justify-between rounded-lg bg-white px-3 py-2"
          activeOpacity={0.7}>
          <View className="flex-1 pr-2">
            <Text className="text-xs font-medium text-gray-900" numberOfLines={1}>
              {r.title}
            </Text>
            <Text className="text-[10px] text-gray-400" numberOfLines={1}>
              {r.roadmapTitle}
            </Text>
          </View>
          <Text className="text-xs text-amber-500">→</Text>
        </TouchableOpacity>
      ))}
      {reviews.length > 3 && (
        <Text className="mt-1 text-[10px] text-amber-600">+{reviews.length - 3} more waiting</Text>
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
    <View className="flex-1 bg-gray-50">
      <ScreenHeader
        title="Learning"
        subtitle="Your roadmaps"
        right={
          <>
            <TouchableOpacity
              onPress={() => router.replace('/learning')}
              className="rounded-lg bg-gray-100 px-3 py-2">
              <Text className="text-xs font-medium text-gray-700">CatchUp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/learning/notes')}
              className="rounded-lg bg-gray-100 px-3 py-2">
              <Text className="text-xs font-medium text-gray-700">Notes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/learning/digests')}
              className="rounded-lg bg-gray-100 px-3 py-2">
              <Text className="text-xs font-medium text-gray-700">Digests</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/learning/settings')}
              className="rounded-lg bg-gray-100 px-3 py-2">
              <SettingsIcon size={16} />
            </TouchableOpacity>
          </>
        }
      />

      {!!stats && <StatsStrip stats={stats} />}

      {reviews.length > 0 && (
        <ReviewsCard
          reviews={reviews}
          onOpen={(roadmapId) => router.push(`/learning/${roadmapId}`)}
        />
      )}

      {/* No `flex: 1` on the content container: it pins the content to the
          viewport height, and the list stops scrolling once it outgrows it. */}
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 24 }}>
        {!!statusError && (
          <View className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <Text className="text-xs text-red-700">{statusError}</Text>
          </View>
        )}

        {roadmapsLoading && (
          <View className="items-center py-12">
            <ActivityIndicator size="large" />
            <Text className="mt-3 text-sm text-gray-400">Loading roadmaps…</Text>
          </View>
        )}

        {!roadmapsLoading && !!roadmapsError && (
          <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <Text className="mb-2 text-sm text-red-700">{roadmapsError}</Text>
            <TouchableOpacity onPress={() => fetchRoadmaps()}>
              <Text className="text-sm font-medium text-red-600">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!roadmapsLoading && !roadmapsError && roadmaps.length === 0 && (
          <View className="items-center rounded-xl border border-dashed border-gray-300 bg-white p-10">
            <Text className="mb-2 text-5xl">📚</Text>
            <Text className="mb-1 text-base font-semibold text-gray-900">No roadmaps yet</Text>
            <Text className="mb-5 text-center text-sm leading-relaxed text-gray-500">
              Chat with the AI tutor to create your first learning roadmap
            </Text>
          </View>
        )}

        {roadmaps.map((roadmap) => {
          const { completed, total, pct } = getProgress(roadmap);
          const style = STATUS_STYLES[roadmap.status] ?? STATUS_STYLES.draft;
          // Parked and archived roadmaps stay legible but visibly recede — what
          // matters at a glance is which ones are actually running.
          const dimmed = roadmap.status === 'archived' || roadmap.status === 'paused';
          return (
            <View
              key={roadmap._id}
              className={`mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white ${
                dimmed ? 'opacity-75' : ''
              }`}>
              <TouchableOpacity
                onPress={() => router.push(`/learning/${roadmap._id}`)}
                className="p-4"
                activeOpacity={0.8}>
                <View className="mb-1 flex-row items-start justify-between">
                  <Text className="flex-1 pr-2 text-base font-semibold text-gray-900">
                    {roadmap.title}
                  </Text>
                  <View className={`rounded-full px-2 py-0.5 ${style.pill}`}>
                    <Text className={`text-xs capitalize ${style.text}`}>{roadmap.status}</Text>
                  </View>
                </View>

                <Text className="mb-3 text-sm leading-relaxed text-gray-500" numberOfLines={2}>
                  {roadmap.summary}
                </Text>

                {/* Progress bar */}
                <View className="mb-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <View className="h-1.5 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-gray-400">
                    {completed}/{total} topics
                  </Text>
                  <Text className="text-xs font-semibold text-violet-600">{pct}%</Text>
                </View>

                {roadmap.stages.length > 0 && (
                  <View className="mt-2 flex-row flex-wrap gap-1">
                    {roadmap.stages.map((s, ind) => (
                      <View key={ind} className="rounded-md bg-blue-50 px-2 py-0.5">
                        <Text className="text-xs text-blue-600">{s.title}</Text>
                      </View>
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
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
