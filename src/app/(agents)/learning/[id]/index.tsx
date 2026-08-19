import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageBody } from '@/components/ui/Page';
import { ProgressBar } from '@/components/ui/ProgressBar';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useColors } from '@/components/ui/theme';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PersonalizationPanel } from '@/features/learning/components/PersonalizationPanel';
import { TopicDot } from '@/features/learning/components/TopicDot';
import { useLearningStore } from '@/features/learning/store';
import {
  groupByStages,
  nextTopicOf,
  topicAction,
  topicStance,
} from '@/features/learning/topicActions';
import type { TopicNode } from '@/features/learning/types';
import { formatMinutes, isCompleted } from '@/features/learning/types';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * One roadmap: where the learner stands on it, and the way in to each topic.
 *
 * This screen used to hold everything — every topic's description, its notes, its
 * checkpoint, the explain-it-yourself exercise — inside an accordion, and ran to
 * a thousand lines because of it. All of that now lives on the topic's own route,
 * which is also where a topic's digests, its misconceptions and its attempt
 * history could finally be gathered: they were scattered across three other
 * screens precisely because there was nowhere that was *about* one topic.
 *
 * What is left is an index. Tapping a row goes to the topic; the dot beside it
 * still performs the topic's action directly, because "start the next one" should
 * not require a detour through a screen you then leave.
 */
export default function RoadmapDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    roadmaps,
    roadmapsLoading,
    fetchRoadmaps,
    submitProgress,
    setSelectedTopic,
    startCheckpoint,
    insights,
    fetchInsights,
    sendChatMessage,
  } = useLearningStore();
  const [progressError, setProgressError] = useState('');
  /** Stages the learner has folded away by hand. Finished ones start folded — see
   *  `stageCollapsed` — so this only records deliberate overrides. */
  const [stageToggles, setStageToggles] = useState<Record<string, boolean>>({});
  const colors = useColors();

  const roadmap = roadmaps.find((r) => r._id === id);

  useEffect(() => {
    if (!roadmap) fetchRoadmaps();
    if (id) fetchInsights(id);
  }, [id]);

  // Coming back from a topic screen, the topic's status has very likely changed —
  // it may have been started, or passed, and the roadmap in the store is the copy
  // that says so.
  useFocusEffect(
    useCallback(() => {
      if (id) fetchInsights(id);
    }, [id])
  );

  // A topic selection belongs to the roadmap it was made on, so drop it when this
  // screen goes away or the learner opens a different roadmap.
  useEffect(() => () => setSelectedTopic(null), [id]);

  if (roadmapsLoading && !roadmap) {
    return (
      <View className="bg-bg flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!roadmap) {
    return (
      <View className="bg-bg flex-1 items-center justify-center p-6">
        <Text className="text-ink-soft mb-4 text-[15px]">Roadmap not found.</Text>
        <Button label="Go back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const completed = roadmap.topics.filter(isCompleted).length;
  const total = roadmap.topics.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const groups = groupByStages(roadmap);
  const nextTopic = nextTopicOf(roadmap);

  /** A finished stage folds itself away — its rows are all struck through and
   *  none of them is the next thing to do — until the learner says otherwise. */
  const stageCollapsed = (groupId: string, allDone: boolean) => stageToggles[groupId] ?? allDone;

  const openTopic = (topic: TopicNode) => {
    setSelectedTopic({ roadmapId: roadmap._id, id: topic.id, title: topic.title });
    router.push(`/learning/${roadmap._id}/${topic.id}`);
  };

  /**
   * The dot performs the topic's action without leaving the list — starting one
   * is the common case and shouldn't cost a screen. Anything that needs room to
   * happen (a checkpoint, the revision it owes) opens the topic instead, which is
   * where those live now.
   */
  const handleDot = async (topic: TopicNode) => {
    setProgressError('');
    const { done, started, ready, owed } = topicStance(topic);

    if (done) {
      try {
        await submitProgress(roadmap._id, topic.id, 'not_started');
      } catch {
        setProgressError('Failed to update progress. Please try again.');
      }
      return;
    }

    if (!started && !ready) {
      try {
        await submitProgress(roadmap._id, topic.id, 'in_progress');
      } catch {
        setProgressError('Could not start that topic. Please try again.');
      }
      return;
    }

    // Owed revision is refused server-side, so the topic screen is where they
    // need to be either way: it offers the revision rather than the attempt.
    if (!owed) startCheckpoint(topic.id, roadmap._id);
    openTopic(topic);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View className="bg-bg flex-1">
        <ScreenHeader
          title={roadmap.title}
          back
          actions={<ThemeToggle />}
          subtitle={
            <Text className="text-ink-soft mt-0.5 flex-1 pr-2 text-[13px]" numberOfLines={2}>
              {roadmap.summary}
              {roadmap.total_estimated_hours ? ` · ${roadmap.total_estimated_hours}h total` : ''}
            </Text>
          }
        />

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          <PageBody className="pt-3">
            <Card className="mb-3">
              <View className="mb-2.5 flex-row items-center justify-between">
                <Text className="text-ink text-[15px] font-bold">Overall progress</Text>
                <Text className="text-primary text-[15px] font-bold">{pct}%</Text>
              </View>
              <ProgressBar pct={pct} tone={pct === 100 ? 'success' : 'primary'} />
              <Text className="text-ink-faint mt-1.5 text-[13px]">
                {completed}/{total} topics complete
              </Text>

              {!!insights[roadmap._id] && (
                <PersonalizationPanel
                  insights={insights[roadmap._id]}
                  // Routed through the chat panel on purpose: it lands in the existing
                  // modify-roadmap flow, which asks for approval and merges the result
                  // so completed topics survive the retune.
                  onRetune={(prompt) => sendChatMessage(prompt, roadmap._id)}
                />
              )}
            </Card>

            {/* A single obvious entry point. At 0% the learner otherwise faces a
                wall of 26 rows with nothing telling them where to begin — and it
                now opens the topic rather than scrolling to it, because the work
                is on the other side of that tap. */}
            {nextTopic && (
              <TouchableOpacity
                onPress={() => openTopic(nextTopic)}
                className="bg-primary-soft mb-4 flex-row items-center gap-2 rounded-xl px-3.5 py-3"
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${completed === 0 ? 'Start here' : 'Next up'}: ${nextTopic.title}`}>
                <Text className="text-primary text-[13px] font-bold">
                  {completed === 0 ? 'Start here' : 'Next up'} →
                </Text>
                <Text className="text-ink flex-1 text-[15px]" numberOfLines={1}>
                  {nextTopic.title}
                </Text>
              </TouchableOpacity>
            )}

            {!!progressError && (
              <View className="border-danger bg-danger-soft mb-3 rounded-xl border p-3">
                <Text className="text-danger text-[13px]">{progressError}</Text>
              </View>
            )}

            {groups.map(({ id: groupId, stage, topics }) => {
              const stageDone = topics.filter(isCompleted).length;
              const allDone = stageDone === topics.length;
              const folded = stageCollapsed(groupId, allDone);

              return (
                <View key={groupId} className="mb-5">
                  {/* Stage header with its own count — a 26-topic roadmap needs
                      milestones closer than "the whole thing". */}
                  <TouchableOpacity
                    onPress={() => setStageToggles((t) => ({ ...t, [groupId]: !folded }))}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !folded }}
                    className="border-line mb-3 flex-row items-center justify-between gap-2 border-b pb-2">
                    <Text
                      className={`flex-1 text-[17px] font-bold ${
                        allDone ? 'text-success' : 'text-ink'
                      }`}
                      numberOfLines={1}>
                      {allDone ? '✓ ' : ''}
                      {stage}
                    </Text>
                    <Text className="text-ink-faint text-[13px] font-semibold">
                      {stageDone}/{topics.length}
                    </Text>
                    <Text className="text-ink-faint text-[13px]">{folded ? '▾' : '▴'}</Text>
                  </TouchableOpacity>

                  {!folded &&
                    topics.map((topic, idx) => {
                      const stance = topicStance(topic);
                      const action = topicAction(stance);
                      const noteCount = insights[roadmap._id]?.note_counts?.[topic.id] ?? 0;
                      const meta = [formatMinutes(topic.estimated_minutes), topic.difficulty]
                        .filter(Boolean)
                        .join(' · ');

                      return (
                        <View key={topic.id} className="flex-row">
                          <TopicDot
                            done={stance.done}
                            ready={stance.ready}
                            started={stance.started}
                            last={idx === topics.length - 1}
                            label={`${topic.title}, ${action.status}`}
                            hint={action.hint}
                            onPress={() => handleDot(topic)}
                          />

                          <View className="flex-1 pb-2 pl-2">
                            <TouchableOpacity
                              onPress={() => openTopic(topic)}
                              activeOpacity={0.7}
                              accessibilityRole="button"
                              accessibilityLabel={`Open ${topic.title}`}
                              className="flex-row items-center justify-between gap-2 py-1.5">
                              <Text
                                className={`flex-1 text-[15px] ${
                                  stance.done ? 'text-ink-faint line-through' : 'text-ink'
                                }`}
                                numberOfLines={1}>
                                {topic.order}. {topic.title}
                              </Text>
                              {/* The two things worth knowing without opening it:
                                  that it is the one underway, and that there is
                                  something written down on it. */}
                              {stance.started && (
                                <Text className="text-primary text-[13px] font-bold">now</Text>
                              )}
                              {stance.ready && (
                                <Text className="text-warning text-[13px] font-bold">check</Text>
                              )}
                              {noteCount > 0 && (
                                <Text className="text-ink-faint text-[13px]">📝{noteCount}</Text>
                              )}
                              {!!meta && <Text className="text-ink-faint text-[13px]">{meta}</Text>}
                              <Text className="text-ink-faint text-[13px]">›</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                </View>
              );
            })}
          </PageBody>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
