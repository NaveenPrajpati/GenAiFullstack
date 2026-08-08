import { useColors } from '@/components/ui/theme';
import { CheckpointCard } from '@/features/learning/components/CheckpointCard';
import { NoteComposer, NoteRow } from '@/features/learning/components/Notes';
import { useLearningStore } from '@/features/learning/store';
import type { Roadmap, RoadmapInsights, TopicNode } from '@/features/learning/types';
import { formatMinutes, isCompleted } from '@/features/learning/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FIELD_LABELS: Record<string, string> = {
  skill_level: 'Level',
  goals: 'Goals',
  preferred_resource_types: 'Resources',
  availability: 'Time',
  known_topics: 'Already known',
};

/** Renders one personalization input as "Level: beginner". */
function describeField(key: string, value: any): string | null {
  if (value == null || (Array.isArray(value) && value.length === 0)) return null;
  const label = FIELD_LABELS[key] ?? key;
  if (key === 'availability') {
    const mins = value?.minutes_per_day;
    if (!mins) return null;
    const days = value?.days_per_week;
    return `${label}: ${mins} min/day${days && days < 7 ? `, ${days} days/wk` : ''}`;
  }
  return `${label}: ${Array.isArray(value) ? value.join(', ') : value}`;
}

/**
 * Makes the learner profile visible on the thing it shaped: the pace it implies,
 * what it actually contributed, and whether it has moved on since.
 */
function PersonalizationPanel({
  insights,
  onRetune,
}: {
  insights: RoadmapInsights;
  onRetune: (prompt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { forecast, personalization, profile_changes, current_personalization } = insights;
  const applied = Object.entries(personalization ?? {})
    .map(([k, v]) => describeField(k, v))
    .filter(Boolean) as string[];

  const targetDate = forecast
    ? new Date(forecast.target_date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;
  const weeks = forecast ? Math.max(Math.round(forecast.calendar_days / 7), 0) : 0;

  const retunePrompt = () => {
    const now = Object.entries(current_personalization)
      .map(([k, v]) => describeField(k, v))
      .filter(Boolean)
      .join('; ');
    return `Update this roadmap for my current profile — ${now}. Keep the topics I've already completed.`;
  };

  if (!forecast && applied.length === 0 && profile_changes.length === 0) return null;

  return (
    <View className="mt-3">
      {!!forecast && (
        <View className="flex-row items-center gap-x-1">
          <Text className="text-xs text-gray-500">
            At {forecast.minutes_per_day} min/day ·{' '}
            <Text className="font-semibold text-gray-700">
              {forecast.calendar_days <= 10 ? `${forecast.calendar_days} days` : `~${weeks} weeks`}
            </Text>{' '}
            · done by {targetDate}
          </Text>
        </View>
      )}
      {forecast?.on_track === false && (
        <Text className="mt-0.5 text-xs text-orange-600">
          That&apos;s past your target date — more time per day, or a shorter roadmap, would close
          the gap.
        </Text>
      )}

      {applied.length > 0 && (
        <TouchableOpacity
          onPress={() => setOpen((o) => !o)}
          className="mt-2 self-start rounded-full bg-violet-50 px-2.5 py-1"
          activeOpacity={0.7}>
          <Text className="text-[11px] font-medium text-violet-700">
            ✨ Personalized for you {open ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
      )}
      {open && (
        <View className="mt-1.5 rounded-lg bg-gray-50 p-2.5">
          <Text className="mb-1 text-[10px] font-semibold text-gray-400 uppercase">
            Built from your profile
          </Text>
          {applied.map((line) => (
            <Text key={line} className="text-xs text-gray-600">
              • {line}
            </Text>
          ))}
        </View>
      )}

      {profile_changes.length > 0 && (
        <View className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
          <Text className="mb-1.5 text-xs text-amber-800">
            Your profile changed since this was built (
            {profile_changes.map((f) => (FIELD_LABELS[f] ?? f).toLowerCase()).join(', ')}).
          </Text>
          <TouchableOpacity
            onPress={() => onRetune(retunePrompt())}
            className="self-start rounded-lg bg-amber-500 px-3 py-1.5"
            activeOpacity={0.8}>
            <Text className="text-xs font-semibold text-white">Update this roadmap</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

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
    checkpoint,
    checkpointLoading,
    checkpointOutcome,
    checkpointError,
    startCheckpoint,
    submitCheckpoint,
    closeCheckpoint,
    insights,
    fetchInsights,
    sendChatMessage,
    notes,
    notesLoading,
    fetchNotes,
    addNote,
    toggleNoteResolved,
    removeNote,
  } = useLearningStore();
  const [progressError, setProgressError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /** Transient "what just happened" line, so completing a topic visibly does
   *  something beyond a checkbox quietly filling in. */
  const [justFinished, setJustFinished] = useState('');
  /** Which topic's notes section is open — one at a time, like the topics. */
  const [notesOpen, setNotesOpen] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // y offset of each topic card, captured on layout, so auto-advance can scroll
  // the next topic into view.
  const topicOffsets = useRef<Record<string, number>>({});
  const colors = useColors();

  const roadmap = roadmaps.find((r) => r._id === id);

  useEffect(() => {
    if (!roadmap) fetchRoadmaps();
    if (id) fetchInsights(id);
  }, [id]);

  // A topic selection belongs to the roadmap it was made on, so drop it when
  // this screen goes away or the learner opens a different roadmap.
  useEffect(() => () => setSelectedTopic(null), [id]);

  useEffect(() => {
    if (!justFinished) return;
    const t = setTimeout(() => setJustFinished(''), 4000);
    return () => clearTimeout(t);
  }, [justFinished]);

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
  const nextTopic = [...roadmap.topics]
    .sort((a, b) => a.order - b.order)
    .find((t) => !isCompleted(t) && t.progress_status !== 'skipped');

  /** Opens one topic's notes, loading that topic's notes on first expand. */
  const toggleNotes = (topicId: string) => {
    const opening = notesOpen !== topicId;
    setNotesOpen(opening ? topicId : null);
    if (opening) fetchNotes({ roadmapId: roadmap._id, topicId });
  };

  const focusTopic = (topic: TopicNode) => {
    setExpanded((prev) => new Set(prev).add(topic.id));
    setSelectedTopic({ roadmapId: roadmap._id, id: topic.id, title: topic.title });
  };

  /** Tapping a topic both expands it and hands it to the chat panel, which is
   *  where the per-topic actions (explain / quiz / resources) now live. */
  const handleTopicPress = (topic: TopicNode) => {
    if (expanded.has(topic.id)) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(topic.id);
        return next;
      });
      setSelectedTopic(null);
      return;
    }
    focusTopic(topic);
  };

  /** Picking a topic up. Digests only go out for a topic that's in progress, so
   *  this is what starts the drip-feed as well as the timer. */
  const handleStart = async (topic: TopicNode) => {
    setProgressError('');
    focusTopic(topic);
    try {
      await submitProgress(roadmap._id, topic.id, 'in_progress');
      setJustFinished(`Started “${topic.title}” — daily tips will follow.`);
    } catch {
      setProgressError('Could not start that topic. Please try again.');
    }
  };

  /**
   * The circle means something different at each stage: start what hasn't been
   * picked up, sit the checkpoint for what's underway, reopen what's done.
   * Completion is earned, not asserted, so it never ticks directly.
   */
  const handleToggle = async (topic: TopicNode) => {
    setProgressError('');
    if (isCompleted(topic)) {
      try {
        await submitProgress(roadmap._id, topic.id, 'not_started');
      } catch {
        setProgressError('Failed to update progress. Please try again.');
      }
      return;
    }
    // `needs_review` means the tips have covered the whole topic and only the
    // checkpoint is left — it opens the checkpoint, it doesn't restart anything.
    if (!['in_progress', 'needs_review'].includes(topic.progress_status ?? '')) {
      await handleStart(topic);
      return;
    }
    focusTopic(topic);
    startCheckpoint(topic.id, roadmap._id);
  };

  /** Called once a checkpoint passes — this is where completion actually lands. */
  const advanceFrom = (topic: TopicNode) => {
    // Auto-advance: finishing a topic should hand the learner the next one
    // rather than leaving them to hunt for it. Collapse what they just closed
    // out, open what's next, and scroll it into view.
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(topic.id);
      return next;
    });
    const next = [...roadmap.topics]
      .sort((a, b) => a.order - b.order)
      .find((t) => t.id !== topic.id && !isCompleted(t) && t.progress_status !== 'skipped');

    if (!next) {
      setJustFinished('🎉 Roadmap complete — every topic done.');
      setSelectedTopic(null);
      return;
    }
    setJustFinished(`✓ Done. Next up: ${next.title}`);
    focusTopic(next);
    const y = topicOffsets.current[next.id];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(y - 80, 0), animated: true });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View className="flex-1 bg-gray-50">
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

          {!!insights[roadmap._id] && (
            <PersonalizationPanel
              insights={insights[roadmap._id]}
              // Routed through the chat panel on purpose: it lands in the existing
              // modify-roadmap flow, which asks for approval and merges the result
              // so completed topics survive the retune.
              onRetune={(prompt) => sendChatMessage(prompt, roadmap._id)}
            />
          )}

          {/* A single obvious entry point. At 0% the learner otherwise faces a
            wall of 26 rows with nothing telling them where to begin. */}
          {nextTopic && (
            <TouchableOpacity
              onPress={() => {
                focusTopic(nextTopic);
                const y = topicOffsets.current[nextTopic.id];
                if (y !== undefined) {
                  scrollRef.current?.scrollTo({ y: Math.max(y - 80, 0), animated: true });
                }
              }}
              className="mt-3 flex-row items-center justify-between rounded-lg bg-violet-50 px-3 py-2"
              activeOpacity={0.7}>
              <Text className="flex-1 text-xs text-violet-700" numberOfLines={1}>
                <Text className="font-semibold">
                  {completed === 0 ? 'Start here: ' : 'Next up: '}
                </Text>
                {nextTopic.title}
              </Text>
              <Text className="ml-2 text-xs text-violet-400">→</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {!!progressError && (
            <View className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
              <Text className="text-xs text-red-700">{progressError}</Text>
            </View>
          )}

          {!!justFinished && (
            <View className="mb-3 rounded-xl border border-green-200 bg-green-50 p-3">
              <Text className="text-xs font-medium text-green-800">{justFinished}</Text>
            </View>
          )}

          {groups.map(({ id: groupId, stage, topics }) => {
            const stageDone = topics.filter(isCompleted).length;
            const stagePct = Math.round((stageDone / topics.length) * 100);
            return (
              <View key={groupId} className="mb-5">
                {/* Stage header with its own progress — a 26-topic roadmap needs
                milestones closer than "the whole thing". */}
                <View className="mb-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold tracking-widest text-gray-400 uppercase">
                      {stage}
                    </Text>
                    <Text
                      className={`text-xs font-semibold ${
                        stagePct === 100 ? 'text-green-600' : 'text-gray-400'
                      }`}>
                      {stagePct === 100 ? '✓ ' : ''}
                      {stageDone}/{topics.length}
                    </Text>
                  </View>
                  <View className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100">
                    <View
                      className={`h-1 rounded-full ${
                        stagePct === 100 ? 'bg-green-500' : 'bg-violet-400'
                      }`}
                      style={{ width: `${stagePct}%` }}
                    />
                  </View>
                </View>

                {topics.map((topic) => {
                  const isExpanded = expanded.has(topic.id);
                  const isSelected = selectedTopic?.id === topic.id;
                  const done = isCompleted(topic);
                  const started = topic.progress_status === 'in_progress';
                  // Fully taught, awaiting its checkpoint.
                  const ready = topic.progress_status === 'needs_review';
                  const duration = formatMinutes(topic.estimated_minutes);
                  const isCheckpointOpen = checkpoint?.topicId === topic.id;
                  const noteCount = insights[roadmap._id]?.note_counts?.[topic.id] ?? 0;
                  const topicNotes = notes.filter((n) => n.topicId === topic.id);
                  return (
                    <View
                      key={topic.id}
                      onLayout={(e) => {
                        topicOffsets.current[topic.id] = e.nativeEvent.layout.y;
                      }}
                      className={`mb-2 rounded-xl border p-4 ${
                        done
                          ? 'border-green-200 bg-green-50/40'
                          : ready
                            ? 'border-amber-300 bg-amber-50/40'
                            : isSelected
                              ? 'border-violet-400 bg-white'
                              : 'border-gray-200 bg-white'
                      }`}>
                      {/* Topic row */}
                      <View className="flex-row items-start gap-3">
                        {/* Completion toggle. Generous hit area — at 20px this was
                        easy to miss entirely, which made the tracker look like
                        it had no way to record anything. */}
                        <TouchableOpacity
                          onPress={() => handleToggle(topic)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: done }}
                          accessibilityLabel={
                            done
                              ? `Mark ${topic.title} not started`
                              : `Mark ${topic.title} complete`
                          }
                          className={`mt-0.5 h-6 w-6 items-center justify-center rounded-full border-2 ${
                            done
                              ? 'border-green-500 bg-green-500'
                              : ready
                                ? 'border-amber-500 bg-white'
                                : started
                                  ? 'border-violet-500 bg-white'
                                  : 'border-gray-300 bg-white'
                          }`}>
                          {done && <Text className="text-xs font-bold text-white">✓</Text>}
                          {!done && (started || ready) && (
                            <View
                              className={`h-2 w-2 rounded-full ${
                                ready ? 'bg-amber-500' : 'bg-violet-500'
                              }`}
                            />
                          )}
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
                            <Text className="ml-2 text-xs text-gray-400">
                              {isExpanded ? '▲' : '▼'}
                            </Text>
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

                          {/* The explicit affordance. The circle alone reads as a
                          status dot, not a control, so an expanded topic always
                          spells out the action. */}
                          {isCheckpointOpen ? null : (
                            <TouchableOpacity
                              onPress={() => handleToggle(topic)}
                              disabled={checkpointLoading}
                              className={`items-center rounded-lg py-2.5 ${
                                done ? 'bg-gray-100' : started ? 'bg-green-600' : 'bg-violet-600'
                              }`}
                              activeOpacity={0.8}>
                              {checkpointLoading && !done ? (
                                <ActivityIndicator size="small" color="white" />
                              ) : (
                                <Text
                                  className={`text-sm font-semibold ${
                                    done ? 'text-gray-600' : 'text-white'
                                  }`}>
                                  {done
                                    ? '✓ Completed — mark as not done'
                                    : ready
                                      ? 'Ready — take the final checkpoint'
                                      : started
                                        ? 'Take checkpoint to complete'
                                        : 'Start this topic'}
                                </Text>
                              )}
                            </TouchableOpacity>
                          )}

                          {!done && !started && !ready && (
                            <Text className="mt-1.5 text-center text-[11px] text-gray-400">
                              Starting it turns on daily tips for this topic.
                            </Text>
                          )}
                          {ready && (
                            <Text className="mt-1.5 text-center text-[11px] text-gray-400">
                              The tips have covered this topic — pass the checkpoint to complete it.
                            </Text>
                          )}

                          {done && !isCheckpointOpen && (
                            <TouchableOpacity
                              onPress={() => startCheckpoint(topic.id, roadmap._id)}
                              className="mt-2 items-center rounded-lg bg-amber-50 py-2"
                              activeOpacity={0.8}>
                              <Text className="text-xs font-medium text-amber-700">
                                🔁 Review this topic
                              </Text>
                            </TouchableOpacity>
                          )}

                          {/* Notes live with the topic they're about, so writing
                          something down is part of working through it. */}
                          <View className="mt-3 border-t border-gray-100 pt-3">
                            <TouchableOpacity
                              onPress={() => toggleNotes(topic.id)}
                              className="mb-2 flex-row items-center justify-between"
                              activeOpacity={0.7}>
                              <Text className="text-xs font-semibold text-gray-500">
                                Notes{noteCount ? ` (${noteCount})` : ''}
                              </Text>
                              <Text className="text-xs text-gray-400">
                                {notesOpen === topic.id ? '▲' : '▼'}
                              </Text>
                            </TouchableOpacity>

                            {notesOpen === topic.id && (
                              <>
                                {topicNotes.map((n) => (
                                  <NoteRow
                                    key={n._id}
                                    note={n}
                                    onToggleResolved={toggleNoteResolved}
                                    onDelete={removeNote}
                                  />
                                ))}
                                <NoteComposer
                                  saving={notesLoading}
                                  onSave={(n) =>
                                    addNote({ ...n, roadmapId: roadmap._id, topicId: topic.id })
                                  }
                                />
                              </>
                            )}
                          </View>

                          {isCheckpointOpen && checkpoint && (
                            <CheckpointCard
                              checkpoint={checkpoint}
                              outcome={checkpointOutcome}
                              loading={checkpointLoading}
                              error={checkpointError}
                              onSubmit={async (answers) => {
                                const result = await submitCheckpoint(answers);
                                if (result?.passed && !result.was_review) advanceFrom(topic);
                              }}
                              onRetry={() => startCheckpoint(topic.id, roadmap._id, true)}
                              onClose={closeCheckpoint}
                            />
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
