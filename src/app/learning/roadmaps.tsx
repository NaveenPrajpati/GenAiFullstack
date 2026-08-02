import ScreenHeader from '@/components/layout/ScreenHeader';
import { useLearningStore } from '@/features/learning/store';
import type { DueReview, LearningStats, Roadmap } from '@/features/learning/types';
import { isCompleted } from '@/features/learning/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

function getProgress(roadmap: Roadmap) {
  const total = roadmap.topics.length;
  const completed = roadmap.topics.filter(isCompleted).length;
  return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
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
        <StatTile value={stats.roadmaps.active} label="active roadmaps" />
        <StatTile value={stats.completed_this_week} label="this week" />
        <StatTile
          value={stats.streak_days > 0 ? `🔥 ${stats.streak_days}` : '—'}
          label="day streak"
        />
        {stats.quizzes.attempts > 0 && (
          <StatTile value={`${stats.quizzes.average_score}%`} label="quiz avg" />
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
    stats,
    fetchStats,
    reviews,
    fetchReviews,
  } = useLearningStore();

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

  return (
    <View className="flex-1 bg-gray-50">
      <ScreenHeader
        title="Learning"
        subtitle="Your roadmaps"
        right={
          <>
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
              <Text className="text-xs font-medium text-gray-700">Settings</Text>
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

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 14, flex: 1 }}>
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
          return (
            <TouchableOpacity
              key={roadmap._id}
              onPress={() => router.push(`/learning/${roadmap._id}`)}
              className="mb-3 rounded-xl border border-gray-200 bg-white p-4"
              activeOpacity={0.8}>
              <View className="mb-1 flex-row items-start justify-between">
                <Text className="flex-1 pr-2 text-base font-semibold text-gray-900">
                  {roadmap.title}
                </Text>
                <View
                  className={`rounded-full px-2 py-0.5 ${
                    roadmap.status === 'completed'
                      ? 'bg-green-100'
                      : roadmap.status === 'archived'
                        ? 'bg-gray-100'
                        : 'bg-violet-100'
                  }`}>
                  <Text
                    className={`text-xs capitalize ${
                      roadmap.status === 'completed'
                        ? 'text-green-700'
                        : roadmap.status === 'archived'
                          ? 'text-gray-500'
                          : 'text-violet-700'
                    }`}>
                    {roadmap.status}
                  </Text>
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
                  {roadmap.stages.map((s) => (
                    <View key={s.id} className="rounded-md bg-blue-50 px-2 py-0.5">
                      <Text className="text-xs text-blue-600">{s.title}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
