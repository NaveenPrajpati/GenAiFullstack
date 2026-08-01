import { useLearningStore } from '@/features/learning/store';
import type { Roadmap, TopicNode } from '@/features/learning/types';
import { formatMinutes, isCompleted } from '@/features/learning/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';

/** Groups topics under their real stage via `stage_id`. */
function groupByStages(roadmap: Roadmap) {
  const sorted = [...roadmap.topics].sort((a, b) => a.order - b.order);
  const stages = [...roadmap.stages].sort((a, b) => a.order - b.order);
  if (stages.length === 0) return [{ id: 'all', stage: 'Topics', topics: sorted }];

  const groups = stages.map((s) => ({
    id: s.id,
    stage: s.title,
    topics: sorted.filter((t) => t.stage_id === s.id),
  }));
  // A topic the model never linked to a stage still has to appear somewhere.
  const stageIds = new Set(stages.map((s) => s.id));
  const orphans = sorted.filter((t) => !t.stage_id || !stageIds.has(t.stage_id));
  if (orphans.length) groups.push({ id: 'other', stage: 'Other', topics: orphans });

  return groups.filter((g) => g.topics.length > 0);
}

export default function RoadmapDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    roadmaps,
    roadmapsLoading,
    fetchRoadmaps,
    submitProgress,
    selectedTopic,
    setSelectedTopic,
  } = useLearningStore();
  const [progressError, setProgressError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const roadmap = roadmaps.find((r) => r._id === id);

  useEffect(() => {
    if (!roadmap) fetchRoadmaps();
  }, [id]);

  // A topic selection belongs to the roadmap it was made on, so drop it when
  // this screen goes away or the learner opens a different roadmap.
  useEffect(() => () => setSelectedTopic(null), [id]);

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

  const completed = roadmap.topics.filter(isCompleted).length;
  const total = roadmap.topics.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const groups = groupByStages(roadmap);

  /** Tapping a topic both expands it and hands it to the chat panel, which is
   *  where the per-topic actions (explain / quiz / resources) now live. */
  const handleTopicPress = (topic: TopicNode) => {
    const isOpen = expanded.has(topic.id);
    setExpanded((prev) => {
      const next = new Set(prev);
      isOpen ? next.delete(topic.id) : next.add(topic.id);
      return next;
    });
    setSelectedTopic(
      isOpen ? null : { roadmapId: roadmap._id, id: topic.id, title: topic.title }
    );
  };

  const handleToggle = async (topic: TopicNode) => {
    setProgressError('');
    try {
      await submitProgress(roadmap._id, topic.id, isCompleted(topic) ? 'not_started' : 'completed');
    } catch {
      setProgressError('Failed to update progress. Please try again.');
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <Text className="text-xl font-bold text-gray-900">{roadmap.title}</Text>
        <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={2}>
          {roadmap.summary}
        </Text>
        {roadmap.total_estimated_hours && (
          <View className="mt-0.5 flex-row items-center gap-x-1">
            <Clock size={12} />
            <Text className="text-xs text-gray-400">{roadmap.total_estimated_hours}h total</Text>
          </View>
        )}
        {/* Progress bar */}
        <View className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
          <View className="h-2 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
        </View>
        <View className="mt-1 flex-row justify-between">
          <Text className="text-xs text-gray-400">
            {completed}/{total} topics complete
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

        {groups.map(({ id: groupId, stage, topics }) => (
          <View key={groupId} className="mb-5">
            <Text className="mb-2 text-xs font-bold tracking-widest text-gray-400 uppercase">
              {stage}
            </Text>

            {topics.map((topic) => {
              const isExpanded = expanded.has(topic.id);
              const isSelected = selectedTopic?.id === topic.id;
              const done = isCompleted(topic);
              const duration = formatMinutes(topic.estimated_minutes);
              return (
                <View
                  key={topic.id}
                  className={`mb-2 rounded-xl border bg-white p-4 ${
                    isSelected
                      ? 'border-violet-400'
                      : done
                        ? 'border-green-200'
                        : 'border-gray-200'
                  }`}>
                  {/* Topic row */}
                  <View className="flex-row items-start gap-3">
                    {/* Checkbox */}
                    <TouchableOpacity
                      onPress={() => handleToggle(topic)}
                      className={`mt-0.5 h-5 w-5 items-center justify-center rounded-full border-2 ${
                        done ? 'border-green-500 bg-green-500' : 'border-gray-300'
                      }`}>
                      {done && <Text className="text-xs font-bold text-white">✓</Text>}
                    </TouchableOpacity>

                    {/* Title — also selects the topic for the chat panel */}
                    <TouchableOpacity
                      className="flex-1"
                      onPress={() => handleTopicPress(topic)}
                      activeOpacity={0.7}>
                      <View className="flex-row items-center justify-between">
                        <Text
                          className={`flex-1 text-sm font-medium ${
                            done ? 'text-gray-400 line-through' : 'text-gray-900'
                          }`}>
                          {topic.order}. {topic.title}
                        </Text>
                        <Text className="ml-2 text-xs text-gray-400">{isExpanded ? '▲' : '▼'}</Text>
                      </View>
                      <View className="mt-0.5 flex-row items-center gap-x-2">
                        {duration ? (
                          <View className="flex-row items-center gap-x-1">
                            <Clock size={12} />
                            <Text className="text-sm text-gray-400">{duration}</Text>
                          </View>
                        ) : null}
                        {!!topic.difficulty && (
                          <Text className="text-xs text-gray-400 capitalize">
                            {topic.difficulty}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Expanded content */}
                  {isExpanded && (
                    <View className="mt-3 border-t border-gray-100 pt-3">
                      <Text className="mb-3 text-sm leading-relaxed text-gray-600">
                        {topic.description}
                      </Text>

                      {(topic.learning_outcomes ?? []).length > 0 && (
                        <View className="mb-3">
                          <Text className="mb-1 text-xs font-semibold text-gray-500">
                            You&apos;ll be able to
                          </Text>
                          {topic.learning_outcomes!.map((o, i) => (
                            <Text key={i} className="mb-0.5 text-xs text-gray-500">
                              • {o}
                            </Text>
                          ))}
                        </View>
                      )}

                      {(topic.prerequisites ?? []).length > 0 && (
                        <View className="mb-3">
                          <Text className="mb-1 text-xs font-semibold text-gray-500">
                            Prerequisites
                          </Text>
                          <Text className="text-xs text-gray-500">
                            {topic.prerequisites!.join(', ')}
                          </Text>
                        </View>
                      )}

                      {(topic.resources ?? []).length > 0 && (
                        <View className="mb-3">
                          <Text className="mb-1 text-xs font-semibold text-gray-500">
                            Resources
                          </Text>
                          {topic.resources!.map((r, i) => (
                            <TouchableOpacity
                              key={i}
                              disabled={!r.url}
                              onPress={() => r.url && Linking.openURL(r.url).catch(() => {})}>
                              <Text
                                className={`mb-0.5 text-xs ${
                                  r.url ? 'text-blue-600 underline' : 'text-gray-500'
                                }`}>
                                • {r.title}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
