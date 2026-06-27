import ScreenHeader from '@/components/layout/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { useLearningStore } from '@/features/learning/store';
import type { Roadmap } from '@/features/learning/types';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

function getProgress(roadmap: Roadmap) {
  const total = roadmap.topics.length;
  const covered = roadmap.topics.filter((t) => t.covered).length;
  return { total, covered, pct: total > 0 ? Math.round((covered / total) * 100) : 0 };
}

export default function RoadmapsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { roadmaps, roadmapsLoading, roadmapsError, fetchRoadmaps } = useLearningStore();

  useEffect(() => {
    if (token) fetchRoadmaps(token);
  }, [token]);

  return (
    <View className="flex-1 bg-gray-50">
      <ScreenHeader
        title="Learning"
        subtitle="Your roadmaps"
        right={
          <>
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

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 24 }}>
        {roadmapsLoading && (
          <View className="items-center py-12">
            <ActivityIndicator size="large" />
            <Text className="mt-3 text-sm text-gray-400">Loading roadmaps…</Text>
          </View>
        )}

        {!roadmapsLoading && !!roadmapsError && (
          <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <Text className="mb-2 text-sm text-red-700">{roadmapsError}</Text>
            <TouchableOpacity onPress={() => token && fetchRoadmaps(token)}>
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
            <TouchableOpacity
              onPress={() => router.push('/learning/chat')}
              className="rounded-lg bg-violet-600 px-5 py-3"
              activeOpacity={0.8}>
              <Text className="text-sm font-medium text-white">Create my first roadmap</Text>
            </TouchableOpacity>
          </View>
        )}

        {roadmaps.map((roadmap) => {
          const { covered, total, pct } = getProgress(roadmap);
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
                  {covered}/{total} topics
                </Text>
                <Text className="text-xs font-semibold text-violet-600">{pct}%</Text>
              </View>

              {roadmap.stages.length > 0 && (
                <View className="mt-2 flex-row flex-wrap gap-1">
                  {roadmap.stages.map((s) => (
                    <View key={s} className="rounded-md bg-blue-50 px-2 py-0.5">
                      <Text className="text-xs text-blue-600">{s}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {!roadmapsLoading && (
          <TouchableOpacity
            onPress={() => router.push('/learning/chat')}
            className="mt-2 items-center rounded-xl bg-violet-600 py-4"
            activeOpacity={0.8}>
            <Text className="text-sm font-semibold text-white">+ Chat with AI Tutor</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
