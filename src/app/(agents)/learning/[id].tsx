import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageBody } from '@/components/ui/Page';
import { ProgressBar } from '@/components/ui/ProgressBar';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useColors } from '@/components/ui/theme';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { CheckpointCard } from '@/features/learning/components/CheckpointCard';
import { FeynmanCard } from '@/features/learning/components/FeynmanCard';
import { NoteComposer, NoteRow } from '@/features/learning/components/Notes';
import { useLearningStore } from '@/features/learning/store';
import type {
  CheckpointBlocked,
  ExplanationResult,
  Roadmap,
  RoadmapInsights,
  TopicNode,
} from '@/features/learning/types';
import { formatMinutes, isCompleted, revisionOwed } from '@/features/learning/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Mirrors FEYNMAN_MIN_WORDS on the server: below this there is nothing to
 *  judge, and the API refuses it. Shown as guidance before that happens. */
const FEYNMAN_MIN_WORDS = 20;

const FIELD_LABELS: Record<string, string> = {
  skill_level: 'Level',
  goals: 'Goals',
  preferred_resource_types: 'Resources',
  preferred_explanation_style: 'Explanation style',
  preferred_quiz_difficulty: 'Quiz difficulty',
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
    <View className="border-line mt-3 border-t pt-3">
      {!!forecast && (
        <Text className="text-ink-soft text-[13px]">
          At {forecast.minutes_per_day} min/day ·{' '}
          <Text className="text-ink font-semibold">
            {forecast.calendar_days <= 10 ? `${forecast.calendar_days} days` : `~${weeks} weeks`}
          </Text>{' '}
          · done by {targetDate}
        </Text>
      )}
      {forecast?.on_track === false && (
        <Text className="text-warning mt-0.5 text-[13px]">
          That&apos;s past your target date — more time per day, or a shorter roadmap, would close
          the gap.
        </Text>
      )}

      {applied.length > 0 && (
        <TouchableOpacity onPress={() => setOpen((o) => !o)} activeOpacity={0.7} className="mt-2">
          <Text className="text-primary text-[13px] font-semibold">
            ✨ Personalized for you {open ? '▴' : '▾'}
          </Text>
        </TouchableOpacity>
      )}
      {open && (
        <View className="bg-surface-alt mt-2 rounded-xl p-3">
          {applied.map((line) => (
            <Text key={line} className="text-ink-soft text-[13px]">
              • {line}
            </Text>
          ))}
        </View>
      )}

      {profile_changes.length > 0 && (
        <View className="border-warning bg-warning-soft mt-3 rounded-xl border p-3">
          <Text className="text-ink-soft mb-2 text-[13px]">
            Your profile changed since this was built (
            {profile_changes.map((f) => (FIELD_LABELS[f] ?? f).toLowerCase()).join(', ')}).
          </Text>
          <Button label="Update this roadmap" size="sm" onPress={() => onRetune(retunePrompt())} />
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

/**
 * What tapping a topic does, which depends on where that topic stands rather
 * than on any one toggle: it starts it, opens a checkpoint, fetches the revision
 * a failed attempt owes, or un-completes it.
 *
 * One function because the dot and the expanded card's button run the same
 * `handleToggle` and were describing it twice. The visible half had all five
 * cases; the screen-reader half had "Mark X complete" for every one of them, so
 * a control that launches a checkpoint announced itself as a checkbox being
 * ticked. Anything added here has to be said in both places or in neither.
 */
function topicAction({
  done,
  owed,
  ready,
  started,
}: {
  done: boolean;
  owed: boolean;
  ready: boolean;
  started: boolean;
}): {
  /** The expanded card's button, emoji and all. */
  label: string;
  /** Where the topic stands — the dot's accessibility label, after its title. */
  status: string;
  /** What tapping will do, announced after the label. */
  hint: string;
} {
  if (done) {
    return {
      label: '✓ Completed — mark as not done',
      status: 'completed',
      hint: 'Marks this topic as not done',
    };
  }
  if (owed) {
    return {
      label: '📘 Revise before retrying',
      status: 'revision owed',
      hint: 'Opens the revision this topic owes before another checkpoint attempt',
    };
  }
  if (ready) {
    return {
      label: 'Take the final checkpoint',
      status: 'ready for its checkpoint',
      hint: 'Opens the final checkpoint for this topic',
    };
  }
  if (started) {
    return {
      label: 'Take checkpoint to complete',
      status: 'in progress',
      hint: 'Opens the checkpoint that completes this topic',
    };
  }
  return {
    label: 'Start this topic',
    status: 'not started',
    hint: 'Starts this topic and turns on its daily tips',
  };
}

/**
 * The rail down the left of the topic list: one dot per topic, joined by a line.
 *
 * The dot is also the completion control, which is why it carries a hit slop far
 * larger than it looks — at 20px across it was easy to miss entirely, and that
 * made the tracker look like it had no way to record anything.
 *
 * It is a `button`, not a `checkbox`: only one of the five things it can do is
 * ticking anything off. The state it reports lives in the label instead, where
 * it can name what is actually about to happen.
 */
function TopicDot({
  done,
  ready,
  started,
  last,
  label,
  hint,
  onPress,
}: {
  done: boolean;
  ready: boolean;
  started: boolean;
  last: boolean;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const ring = done
    ? 'border-success bg-success'
    : ready
      ? 'border-warning bg-warning'
      : started
        ? 'border-primary bg-primary'
        : 'border-line bg-surface';

  return (
    <View className="w-7 items-center">
      <TouchableOpacity
        onPress={onPress}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        className={`mt-1.5 h-4 w-4 items-center justify-center rounded-full border-2 ${ring}`}>
        {done && <Text className="text-on-primary text-[9px] font-bold">✓</Text>}
      </TouchableOpacity>
      {/* Drawn only between dots, so the rail stops at the last topic instead of
          trailing off under the next stage heading. */}
      {!last && <View className="bg-line w-px flex-1" />}
    </View>
  );
}

/**
 * Why a checkpoint wouldn't open. Three refusals reach here — revision owed,
 * cooldown, and the daily cap — and each wants a different next move, so none of
 * them is served by a bare error string.
 */
function CheckpointBlockedCard({
  blocked,
  busy,
  onRevise,
  onDismiss,
}: {
  blocked: CheckpointBlocked;
  busy: boolean;
  onRevise: () => void;
  onDismiss: () => void;
}) {
  const revision = blocked.blocked_reason === 'needs_revision';
  return (
    <View className="border-warning bg-warning-soft mt-3 rounded-xl border p-4">
      <Text className="text-warning text-[15px] font-bold">
        {revision ? 'Revision first' : 'Not just yet'}
      </Text>
      <Text className="text-ink-soft mt-1 text-[15px] leading-relaxed">{blocked.message}</Text>

      {/* The questions that failed it. Naming them turns "go revise" into
          something the learner can actually act on. */}
      {!!blocked.weak_points?.length && (
        <View className="mt-2.5">
          {blocked.weak_points.map((w, i) => (
            <Text key={i} className="text-ink-soft mt-0.5 text-[13px] leading-relaxed">
              • {w}
            </Text>
          ))}
        </View>
      )}

      {typeof blocked.attempts_today === 'number' && typeof blocked.limit === 'number' && (
        <Text className="text-ink-faint mt-2 text-[13px]">
          {blocked.attempts_today} of {blocked.limit} attempts used today
        </Text>
      )}

      <View className="mt-3 flex-row gap-2">
        {revision && (
          <Button
            label="Get revision tips"
            size="sm"
            full
            loading={busy}
            loadingLabel="Writing them…"
            onPress={onRevise}
          />
        )}
        <Button label="OK" variant="secondary" size="sm" onPress={onDismiss} />
      </View>
    </View>
  );
}

export default function RoadmapDetail() {
  // `focusTopic` and `action` are how the briefing hands a specific topic over:
  // it recommends a checkpoint, and the learner should land on that topic with
  // it open rather than on a roadmap with it somewhere in the list.
  const {
    id,
    // Not `focusTopic` — that name is taken by the local helper below.
    focusTopic: routeTopicId,
    action: routeAction,
  } = useLocalSearchParams<{ id: string; focusTopic?: string; action?: string }>();
  const router = useRouter();
  const {
    roadmaps,
    roadmapsLoading,
    fetchRoadmaps,
    submitProgress,
    setSelectedTopic,
    checkpoint,
    checkpointLoading,
    checkpointOutcome,
    checkpointError,
    checkpointBlocked,
    generateNextDigest,
    generatingDigest,
    startCheckpoint,
    submitCheckpoint,
    closeCheckpoint,
    explainTopic,
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
  /** Stages the learner has folded away by hand. Finished ones start folded — see
   *  `stageCollapsed` — so this only records deliberate overrides. */
  const [stageToggles, setStageToggles] = useState<Record<string, boolean>>({});
  /** Transient "what just happened" line, so completing a topic visibly does
   *  something beyond a checkbox quietly filling in. */
  const [justFinished, setJustFinished] = useState('');
  /** Which topic's notes section is open — one at a time, like the topics. */
  const [notesOpen, setNotesOpen] = useState<string | null>(null);
  /** The Feynman checkpoint: which topic is being judged, the verdict when it
   *  lands, and any failure. Local rather than in the store — it's one card's
   *  transient state, and nothing else in the app reads it. */
  const [explaining, setExplaining] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResult | null>(null);
  const [explainError, setExplainError] = useState('');

  const handleExplain = async (topicId: string, text: string) => {
    setExplainError('');
    setExplaining(topicId);
    try {
      // `source: 'voice'` would be set by a real recorder; dictation arrives
      // through the keyboard as ordinary text and is indistinguishable here.
      setExplanation(await explainTopic(topicId, { roadmapId: id, text }));
    } catch (e: any) {
      setExplainError(e?.message ?? 'Could not read that just now.');
    } finally {
      setExplaining(null);
    }
  };
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

  /**
   * Act on a topic handed over in the route — the briefing recommending a
   * checkpoint, or a review that has come due.
   *
   * Genuinely an effect rather than state derived during render: it responds to
   * having been navigated to, it calls a store action, and the scroll cannot
   * happen until the rows have laid out and reported their offsets. Guarded by a
   * ref so a background refetch of the roadmap doesn't re-open a checkpoint the
   * learner has since closed.
   */
  const handledRoute = useRef<string | null>(null);
  useEffect(() => {
    if (!roadmap || !routeTopicId || handledRoute.current === routeTopicId) return;
    const target = roadmap.topics.find((t) => t.id === routeTopicId);
    if (!target) return;
    handledRoute.current = routeTopicId;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setExpanded((prev) => new Set(prev).add(target.id));
    setSelectedTopic({ roadmapId: roadmap._id, id: target.id, title: target.title });

    // The server refuses an attempt while revision is owed, so send them to the
    // revision instead of opening something that would be turned away — the same
    // rule `handleToggle` follows.
    if (routeAction === 'checkpoint' && !revisionOwed(target)) {
      startCheckpoint(target.id, roadmap._id);
    }

    // Offsets are recorded by each row's onLayout, which has not necessarily run
    // on the frame this mounts. One tick later it has.
    const t = setTimeout(() => {
      const y = topicOffsets.current[target.id];
      if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(y - 80, 0), animated: true });
    }, 250);
    return () => clearTimeout(t);
  }, [roadmap, routeTopicId, routeAction]);

  useEffect(() => {
    if (!justFinished) return;
    const t = setTimeout(() => setJustFinished(''), 4000);
    return () => clearTimeout(t);
  }, [justFinished]);

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
  const nextTopic = [...roadmap.topics]
    .sort((a, b) => a.order - b.order)
    .find((t) => !isCompleted(t) && t.progress_status !== 'skipped');

  /** A finished stage folds itself away — its rows are all struck through and
   *  none of them is the next thing to do — until the learner says otherwise. */
  const stageCollapsed = (groupId: string, allDone: boolean) => stageToggles[groupId] ?? allDone;

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
    // Owed revision is refused server-side, so asking would spend a round trip to
    // be told no. Go straight to what actually unblocks them.
    if (revisionOwed(topic)) {
      await handleRevise(topic);
      return;
    }
    startCheckpoint(topic.id, roadmap._id);
  };

  /**
   * Fetch the revision a failed checkpoint owes, and take them to read it.
   *
   * `/digests/generate` routes to a revision digest whenever one is owed, so
   * this is the same call the home screen makes — no second endpoint to keep in
   * step. If one is already waiting the server declines and they're sent to read
   * that instead, which is the right destination either way.
   */
  const handleRevise = async (topic: TopicNode) => {
    setProgressError('');
    // Resolves to null when the server declines — most often because revision
    // tips are already waiting, which is not a failure. Either way the
    // destination is the same: the tips that exist for this topic.
    await generateNextDigest(roadmap._id, topic.id);
    router.push({
      pathname: '/learning/digests',
      params: { roadmapId: roadmap._id, topicId: topic.id },
    });
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

  const jumpTo = (topic: TopicNode) => {
    focusTopic(topic);
    const y = topicOffsets.current[topic.id];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(y - 80, 0), animated: true });
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

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}>
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
                wall of 26 rows with nothing telling them where to begin. */}
            {nextTopic && (
              <TouchableOpacity
                onPress={() => jumpTo(nextTopic)}
                className="bg-primary-soft mb-4 flex-row items-center gap-2 rounded-xl px-3.5 py-3"
                activeOpacity={0.7}>
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

            {/* A checkpoint that failed to open renders no card, so its error
                has nowhere else to go. Refusals with a reason — revision owed,
                cooldown, the daily cap — are not routed here: they belong on the
                topic they're about, and land in the card below. */}
            {!checkpoint && !!checkpointError && (
              <View className="border-danger bg-danger-soft mb-3 rounded-xl border p-3">
                <Text className="text-danger text-[13px]">{checkpointError}</Text>
              </View>
            )}

            {!!justFinished && (
              <View className="border-success bg-success-soft mb-3 rounded-xl border p-3">
                <Text className="text-success text-[13px] font-semibold">{justFinished}</Text>
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
                      const isExpanded = expanded.has(topic.id);
                      const done = isCompleted(topic);
                      const started = topic.progress_status === 'in_progress';
                      // Fully taught, awaiting its checkpoint.
                      const ready = topic.progress_status === 'needs_review';
                      // A failed attempt owes revision before the next one, and
                      // the server enforces it — so the button says so rather
                      // than offering an attempt that will be refused.
                      const owed = revisionOwed(topic);
                      // One description of the tap, shared by the dot and the
                      // button below it — see `topicAction`.
                      const action = topicAction({ done, owed, ready, started });
                      const duration = formatMinutes(topic.estimated_minutes);
                      const isCheckpointOpen = checkpoint?.topicId === topic.id;
                      const noteCount = insights[roadmap._id]?.note_counts?.[topic.id] ?? 0;
                      const topicNotes = notes.filter((n) => n.topicId === topic.id);
                      const meta = [duration, topic.difficulty].filter(Boolean).join(' · ');

                      return (
                        <View
                          key={topic.id}
                          onLayout={(e) => {
                            topicOffsets.current[topic.id] = e.nativeEvent.layout.y;
                          }}
                          className="flex-row">
                          <TopicDot
                            done={done}
                            ready={ready}
                            started={started}
                            last={idx === topics.length - 1}
                            label={`${topic.title}, ${action.status}`}
                            hint={action.hint}
                            onPress={() => handleToggle(topic)}
                          />

                          <View className="flex-1 pb-2 pl-2">
                            {/* Collapsed, a topic is one quiet line on the rail;
                                expanded, it becomes the card the mockup shows. */}
                            {!isExpanded ? (
                              <TouchableOpacity
                                onPress={() => handleTopicPress(topic)}
                                activeOpacity={0.7}
                                className="flex-row items-center justify-between gap-2 py-1.5">
                                <Text
                                  className={`flex-1 text-[15px] ${
                                    done ? 'text-ink-faint line-through' : 'text-ink'
                                  }`}
                                  numberOfLines={1}>
                                  {topic.order}. {topic.title}
                                </Text>
                                {!!meta && (
                                  <Text className="text-ink-faint text-[13px]">{meta}</Text>
                                )}
                              </TouchableOpacity>
                            ) : (
                              <Card className="border-primary mb-1">
                                <TouchableOpacity
                                  onPress={() => handleTopicPress(topic)}
                                  activeOpacity={0.7}>
                                  <View className="flex-row items-start justify-between gap-2">
                                    <Text
                                      className={`flex-1 text-[17px] font-bold ${
                                        done ? 'text-ink-faint line-through' : 'text-ink'
                                      }`}>
                                      {topic.order}. {topic.title}
                                    </Text>
                                    {!!meta && (
                                      <Text className="text-ink-faint text-[13px]">{meta}</Text>
                                    )}
                                  </View>
                                </TouchableOpacity>

                                {!!topic.description && (
                                  <Text className="text-ink-soft mt-2 text-[15px] leading-relaxed">
                                    {topic.description}
                                  </Text>
                                )}

                                {(topic.learning_outcomes ?? []).length > 0 && (
                                  <View className="mt-3">
                                    <Text className="text-ink mb-1 text-[13px] font-bold">
                                      You&apos;ll be able to
                                    </Text>
                                    {topic.learning_outcomes!.map((o, i) => (
                                      <View key={i} className="flex-row gap-2">
                                        <Text className="text-ink-faint text-[15px] leading-relaxed">
                                          •
                                        </Text>
                                        <Text className="text-ink-soft flex-1 text-[15px] leading-relaxed">
                                          {o}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                )}

                                {(topic.prerequisites ?? []).length > 0 && (
                                  <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
                                    <Text className="text-ink-faint text-[13px]">Needs:</Text>
                                    {topic.prerequisites!.map((p, i) => (
                                      <Badge key={i} label={p} tone="neutral" />
                                    ))}
                                  </View>
                                )}

                                {(topic.resources ?? []).length > 0 && (
                                  <View className="mt-3">
                                    {topic.resources!.map((r, i) => (
                                      <TouchableOpacity
                                        key={i}
                                        disabled={!r.url}
                                        onPress={() =>
                                          r.url && Linking.openURL(r.url).catch(() => {})
                                        }
                                        activeOpacity={0.7}>
                                        <Text
                                          className={`mb-0.5 text-[13px] ${
                                            r.url ? 'text-primary font-semibold' : 'text-ink-soft'
                                          }`}
                                          numberOfLines={1}>
                                          {r.title} {r.url ? '↗' : ''}
                                        </Text>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                )}

                                {/* The explicit affordance. The dot alone reads as a
                                    status marker, not a control, so an expanded topic
                                    always spells out the action. */}
                                {!isCheckpointOpen && (
                                  <View className="mt-4">
                                    <Button
                                      label={action.label}
                                      accessibilityHint={action.hint}
                                      variant={done ? 'secondary' : 'primary'}
                                      loading={checkpointLoading && !done}
                                      onPress={() => handleToggle(topic)}
                                    />
                                    {!done && !started && !ready && (
                                      <Text className="text-ink-faint mt-1.5 text-[13px]">
                                        Starting it turns on daily tips for this topic.
                                      </Text>
                                    )}
                                    {ready && !owed && (
                                      <Text className="text-ink-faint mt-1.5 text-[13px]">
                                        The tips have covered this topic — pass the checkpoint to
                                        complete it.
                                      </Text>
                                    )}
                                    {/* Said before they tap, not after. The server
                                        refuses this attempt either way; the only
                                        question is whether they find out by being
                                        turned away. */}
                                    {owed && (
                                      <Text className="text-warning mt-1.5 text-[13px]">
                                        That last attempt didn&apos;t pass — a short revision comes
                                        first.
                                      </Text>
                                    )}
                                  </View>
                                )}

                                {done && !isCheckpointOpen && (
                                  <View className="mt-2">
                                    <Button
                                      label={
                                        owed ? '📘 Revise before retrying' : '🔁 Review this topic'
                                      }
                                      variant="secondary"
                                      size="sm"
                                      // The action follows the label: a topic
                                      // owed revision is refused a checkpoint.
                                      onPress={() =>
                                        owed
                                          ? handleRevise(topic)
                                          : startCheckpoint(topic.id, roadmap._id)
                                      }
                                    />
                                  </View>
                                )}

                                {/* Notes live with the topic they're about, so writing
                                    something down is part of working through it. */}
                                <View className="border-line mt-4 border-t pt-3">
                                  <TouchableOpacity
                                    onPress={() => toggleNotes(topic.id)}
                                    className="flex-row items-center justify-between"
                                    activeOpacity={0.7}>
                                    <Text className="text-ink-soft text-[13px] font-bold">
                                      Notes{noteCount ? ` (${noteCount})` : ''}
                                    </Text>
                                    <Text className="text-ink-faint text-[13px]">
                                      {notesOpen === topic.id ? '▴' : '▾'}
                                    </Text>
                                  </TouchableOpacity>

                                  {notesOpen === topic.id && (
                                    <View className="mt-2">
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
                                          addNote({
                                            ...n,
                                            roadmapId: roadmap._id,
                                            topicId: topic.id,
                                          })
                                        }
                                      />
                                    </View>
                                  )}
                                </View>

                                {/* A refused attempt opens no checkpoint, so the card
                                    below never mounts and its `error` has nowhere to
                                    go. Rendered here instead — tapping and seeing
                                    nothing at all is the worst possible answer. */}
                                {checkpointBlocked?.topicId === topic.id && (
                                  <CheckpointBlockedCard
                                    blocked={checkpointBlocked}
                                    busy={generatingDigest}
                                    onRevise={async () => {
                                      closeCheckpoint();
                                      await handleRevise(topic);
                                    }}
                                    onDismiss={closeCheckpoint}
                                  />
                                )}

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
                                    // A failed attempt owes revision, and the
                                    // server refuses the retry until it's read.
                                    // Sending them there is the difference
                                    // between a retry and a round trip to "no".
                                    onRetry={async () => {
                                      if (!revisionOwed(topic)) {
                                        startCheckpoint(topic.id, roadmap._id, true);
                                        return;
                                      }
                                      closeCheckpoint();
                                      await handleRevise(topic);
                                    }}
                                    onClose={closeCheckpoint}
                                  />
                                )}

                                {/* Offered once the topic is ready to be completed, and
                                    withdrawn once it's been earned — asking someone to
                                    explain the same topic twice pays out nothing the
                                    second time. */}
                                {(topic.progress_status === 'needs_review' ||
                                  topic.progress_status === 'completed') &&
                                  !topic.feynman_passed && (
                                    <FeynmanCard
                                      title={topic.title}
                                      minWords={FEYNMAN_MIN_WORDS}
                                      result={
                                        explanation?.topicId === topic.id ? explanation : null
                                      }
                                      busy={explaining === topic.id}
                                      error={explainError}
                                      onSubmit={(text) => handleExplain(topic.id, text)}
                                      onDismiss={() => setExplanation(null)}
                                    />
                                  )}
                              </Card>
                            )}
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
