import { useAuth } from '@/context/AuthContext';
import { useLearningStore } from '@/features/learning/store';
import type { Roadmap, TopicNode } from '@/features/learning/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

function groupByStages(roadmap: Roadmap) {
  const sorted = [...roadmap.topics].sort((a, b) => a.order - b.order);
  if (roadmap.stages.length === 0) return [{ stage: 'Topics', topics: sorted }];
  const perStage = Math.ceil(sorted.length / roadmap.stages.length);
  return roadmap.stages
    .map((stage, i) => ({
      stage,
      topics: sorted.slice(i * perStage, (i + 1) * perStage),
    }))
    .filter((g) => g.topics.length > 0);
}

export default function RoadmapDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const { roadmaps, roadmapsLoading, fetchRoadmaps, submitProgress } = useLearningStore();
  const [progressError, setProgressError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const roadmap = roadmaps.find((r) => r._id === id);

  useEffect(() => {
    if (token && !roadmap) fetchRoadmaps(token);
  }, [token, id]);

  if (roadmapsLoading && !roadmap) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!roadmap) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Text className="mb-4 text-base text-gray-500">Roadmap not found.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-sm font-medium text-violet-600">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const covered = roadmap.topics.filter((t) => t.covered).length;
  const total = roadmap.topics.length;
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
  const groups = groupByStages(roadmap);

  const toggleExpand = (topicId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(topicId) ? next.delete(topicId) : next.add(topicId);
      return next;
    });

  const handleToggle = async (topic: TopicNode) => {
    setProgressError('');
    try {
      await submitProgress(token!, roadmap._id, topic.id, !topic.covered);
    } catch {
      setProgressError('Failed to update progress. Please try again.');
    }
  };

  const openChat = (prefill: string) =>
    router.push({ pathname: '/learning/chat', params: { prefill, roadmapId: roadmap._id } });

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-sm text-violet-600">← Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">{roadmap.title}</Text>
        <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={2}>
          {roadmap.summary}
        </Text>
        {roadmap.total_estimated_hours && (
          <Text className="mt-0.5 text-xs text-gray-400">
            ~{roadmap.total_estimated_hours}h total
          </Text>
        )}
        {/* Progress bar */}
        <View className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
          <View className="h-2 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
        </View>
        <View className="mt-1 flex-row justify-between">
          <Text className="text-xs text-gray-400">
            {covered}/{total} topics complete
          </Text>
          <Text className="text-xs font-semibold text-violet-600">{pct}%</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {!!progressError && (
          <View className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <Text className="text-xs text-red-700">{progressError}</Text>
          </View>
        )}

        {groups.map(({ stage, topics }) => (
          <View key={stage} className="mb-5">
            <Text className="mb-2 text-xs font-bold tracking-widest text-gray-400 uppercase">
              {stage}
            </Text>

            {topics.map((topic) => {
              const isExpanded = expanded.has(topic.id);
              return (
                <View
                  key={topic.id}
                  className={`mb-2 rounded-xl border bg-white p-4 ${
                    topic.covered ? 'border-green-200' : 'border-gray-200'
                  }`}>
                  {/* Topic row */}
                  <View className="flex-row items-start gap-3">
                    {/* Checkbox */}
                    <TouchableOpacity
                      onPress={() => handleToggle(topic)}
                      className={`mt-0.5 h-5 w-5 items-center justify-center rounded-full border-2 ${
                        topic.covered ? 'border-green-500 bg-green-500' : 'border-gray-300'
                      }`}>
                      {topic.covered && <Text className="text-xs font-bold text-white">✓</Text>}
                    </TouchableOpacity>

                    {/* Title */}
                    <TouchableOpacity
                      className="flex-1"
                      onPress={() => toggleExpand(topic.id)}
                      activeOpacity={0.7}>
                      <View className="flex-row items-center justify-between">
                        <Text
                          className={`flex-1 text-sm font-medium ${
                            topic.covered ? 'text-gray-400 line-through' : 'text-gray-900'
                          }`}>
                          {topic.order}. {topic.title}
                        </Text>
                        <Text className="ml-2 text-xs text-gray-400">{isExpanded ? '▲' : '▼'}</Text>
                      </View>
                      {topic.estimated_hours ? (
                        <Text className="mt-0.5 text-xs text-gray-400">
                          ~{topic.estimated_hours}h
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  </View>

                  {/* Expanded content */}
                  {isExpanded && (
                    <View className="mt-3 border-t border-gray-100 pt-3">
                      <Text className="mb-3 text-sm leading-relaxed text-gray-600">
                        {topic.description}
                      </Text>

                      {(topic.prerequisites ?? []).length > 0 && (
                        <View className="mb-3">
                          <Text className="mb-1 text-xs font-semibold text-gray-500">
                            Prerequisites
                          </Text>
                          <Text className="text-xs text-gray-500">
                            {topic.prerequisites.join(', ')}
                          </Text>
                        </View>
                      )}

                      {(topic.resources ?? []).length > 0 && (
                        <View className="mb-3">
                          <Text className="mb-1 text-xs font-semibold text-gray-500">
                            Resources
                          </Text>
                          {topic.resources!.map((r, i) => (
                            <Text key={i} className="mb-0.5 text-xs text-gray-500">
                              • {r}
                            </Text>
                          ))}
                        </View>
                      )}

                      {/* Per-topic actions */}
                      <View className="flex-row flex-wrap gap-2">
                        <TouchableOpacity
                          onPress={() => openChat(`Explain "${topic.title}"`)}
                          className="rounded-lg bg-violet-50 px-3 py-1.5"
                          activeOpacity={0.7}>
                          <Text className="text-xs font-medium text-violet-700">Explain</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            openChat(
                              `Quiz me on "${topic.title}" from the "${roadmap.title}" roadmap`
                            )
                          }
                          className="rounded-lg bg-blue-50 px-3 py-1.5"
                          activeOpacity={0.7}>
                          <Text className="text-xs font-medium text-blue-700">Quiz me</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            openChat(
                              `Find resources for "${topic.title}" from the "${roadmap.title}" roadmap`
                            )
                          }
                          className="rounded-lg bg-gray-100 px-3 py-1.5"
                          activeOpacity={0.7}>
                          <Text className="text-xs font-medium text-gray-700">Find resources</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        <TouchableOpacity
          onPress={() => openChat(`What should I study next in the "${roadmap.title}" roadmap?`)}
          className="items-center rounded-xl bg-violet-600 py-4"
          activeOpacity={0.8}>
          <Text className="text-sm font-semibold text-white">Ask AI about this roadmap</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
