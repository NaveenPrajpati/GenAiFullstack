import { Badge, SectionLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, DashedCard, InsetCard } from '@/components/ui/Card';
import DigestCard from '@/components/ui/cards/DigestCard';
import { PageBody } from '@/components/ui/Page';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useColors } from '@/components/ui/theme';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { CheckpointBlockedCard } from '@/features/learning/components/CheckpointBlockedCard';
import { CheckpointCard } from '@/features/learning/components/CheckpointCard';
import { FeynmanCard } from '@/features/learning/components/FeynmanCard';
import { NoteComposer, NoteRow } from '@/features/learning/components/Notes';
import { useLearningStore } from '@/features/learning/store';
import { nextTopicOf, topicAction, topicStance } from '@/features/learning/topicActions';
import type { Digest, ExplanationResult, TopicMastery, TopicNode } from '@/features/learning/types';
import { formatMinutes } from '@/features/learning/types';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * One topic, and everything the app knows about it.
 *
 * This is the screen the tracker did not have. A topic's material was on the
 * digest archive, its notes were folded into an accordion on the roadmap, what
 * the learner keeps getting wrong about it was on Insights, and how well they
 * hold it was a number in a tile on Today — four screens, none of them *about*
 * the topic, and no way to see any of it beside the checkpoint it all feeds.
 *
 * The order is what a learner needs in the order they need it: where this stands
 * and the one thing to do about it, then what they have been taught, then what
 * they have written and what keeps catching them out. Reference last.
 */

/** Mirrors FEYNMAN_MIN_WORDS on the server: below this there is nothing to
 *  judge, and the API refuses it. Shown as guidance before that happens. */
const FEYNMAN_MIN_WORDS = 20;

/** "in 3 days" / "5 days overdue" — a review date only means something relative. */
function reviewDue(iso: string): { text: string; overdue: boolean } {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, overdue: true };
  if (days === 0) return { text: 'due today', overdue: true };
  if (days === 1) return { text: 'due tomorrow', overdue: false };
  return { text: `due in ${days}d`, overdue: false };
}

/**
 * Where this topic stands, as a row of facts rather than prose.
 *
 * `mastery` comes from the server's one calculation — the same age-weighted mean
 * over every graded attempt that the home screen shows. This strip used to read
 * `topic.mastery_score` and `topic.checkpoint_attempts` instead, which are the
 * last checkpoint's score and the count of *failures*, so a topic could report
 * "50% · 1 attempt" here and "33% · 6 attempts" on Today. Two calculations, both
 * on screen, and the learner left to guess which was theirs.
 *
 * Shown only once something has been graded: a topic nobody has been tested on
 * has no mastery, and 0% is a different claim from "not yet measured".
 */
function StatusStrip({ topic, mastery }: { topic: TopicNode; mastery?: TopicMastery }) {
  const stance = topicStance(topic);
  const review = topic.next_review_at ? reviewDue(topic.next_review_at) : null;

  const state = stance.done
    ? { label: 'Completed', tone: 'success' as const }
    : stance.owed
      ? { label: 'Revision owed', tone: 'danger' as const }
      : stance.ready
        ? { label: 'Ready for its checkpoint', tone: 'warning' as const }
        : stance.started
          ? { label: 'Underway', tone: 'primary' as const }
          : { label: 'Not started', tone: 'neutral' as const };

  return (
    <View className="mb-3 flex-row flex-wrap items-center gap-1.5">
      <Badge square label={state.label} tone={state.tone} />
      {!!mastery && (
        <Badge
          square
          // The denominator travels with the number here for the same reason it
          // does on Today's tile: "60%" alone doesn't say what it was measured
          // over, and one attempt is a very different claim from six.
          label={`${mastery.mastery}% mastery · ${mastery.attempts} attempt${
            mastery.attempts === 1 ? '' : 's'
          }`}
          tone={mastery.mastery < 70 ? 'warning' : 'success'}
        />
      )}
      {mastery?.trend === 'slipping' && <Badge square label="↓ slipping" tone="warning" />}
      {!!review && (
        <Badge
          square
          label={`Review ${review.text}`}
          tone={review.overdue ? 'warning' : 'neutral'}
        />
      )}
      {!!topic.feynman_passed && <Badge square label="🎙 Explained" tone="success" />}
    </View>
  );
}

/** A digest already acknowledged: the record of what was taught, not a task. */
function TaughtCard({ digest }: { digest: Digest }) {
  const [open, setOpen] = useState(false);
  const date = new Date(digest.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card className="mb-2 opacity-80">
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center justify-between gap-2">
        <Text className="text-ink-soft flex-1 text-[15px]" numberOfLines={1}>
          {digest.kind === 'revision'
            ? '🔁 Revision'
            : digest.kind === 'reteach'
              ? '✍️ Explained again'
              : `Lesson ${digest.sequence ?? ''}`.trim()}
          {` · ${digest.bullets.length} points`}
        </Text>
        <Text className="text-ink-faint text-[13px]">{date}</Text>
        <Text className="text-ink-faint text-[13px]">{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>

      {open && (
        <View className="mt-2.5 gap-1.5">
          {digest.bullets.map((b, i) => (
            <View key={i} className="flex-row gap-2">
              <Text className="text-ink-faint text-[15px] leading-relaxed">•</Text>
              <Text className="text-ink-soft flex-1 text-[15px] leading-relaxed">{b}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

export default function TopicDetail() {
  const { id, topicId } = useLocalSearchParams<{ id: string; topicId: string }>();
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
    startCheckpoint,
    submitCheckpoint,
    closeCheckpoint,
    generateNextDigest,
    generatingDigest,
    explainTopic,
    digests,
    fetchDigests,
    markDigest,
    digestQuizFailures,
    notes,
    notesLoading,
    fetchNotes,
    addNote,
    toggleNoteResolved,
    removeNote,
    misconceptions,
    fetchMisconceptions,
    insights,
    fetchInsights,
  } = useLearningStore();

  const [progressError, setProgressError] = useState('');
  const [justFinished, setJustFinished] = useState('');
  const [markingDigest, setMarkingDigest] = useState<string | null>(null);
  const [digestError, setDigestError] = useState('');
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<ExplanationResult | null>(null);
  const [explainError, setExplainError] = useState('');
  const colors = useColors();

  const roadmap = roadmaps.find((r) => r._id === id);
  const topic = roadmap?.topics.find((t) => t.id === topicId);

  useEffect(() => {
    if (!roadmap) fetchRoadmaps();
  }, [id]);

  // Everything about this one topic, scoped server-side. The store's `digests`
  // and `notes` are single lists shared with the archive and the notes screen —
  // both refetch on their own focus, so narrowing them here costs nothing.
  useFocusEffect(
    useCallback(() => {
      if (!id || !topicId) return;
      fetchDigests({ roadmapId: id, topicId, limit: 50 });
      fetchNotes({ roadmapId: id, topicId });
      fetchMisconceptions(id);
      // Carries this topic's mastery. Fetched here rather than relying on the
      // roadmap screen having done it, because a notification or a briefing
      // action can land on this screen without ever passing through that one.
      fetchInsights(id);
    }, [id, topicId])
  );

  // The chat panel follows the learner, and on this screen there is exactly one
  // topic it could be about.
  useEffect(() => {
    if (roadmap && topic) {
      setSelectedTopic({ roadmapId: roadmap._id, id: topic.id, title: topic.title });
    }
    return () => setSelectedTopic(null);
  }, [roadmap?._id, topic?.id]);

  useEffect(() => {
    if (!justFinished) return;
    const t = setTimeout(() => setJustFinished(''), 5000);
    return () => clearTimeout(t);
  }, [justFinished]);

  if (roadmapsLoading && !roadmap) {
    return (
      <View className="bg-bg flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!roadmap || !topic) {
    return (
      <View className="bg-bg flex-1 items-center justify-center p-6">
        <Text className="text-ink-soft mb-4 text-[15px]">Topic not found.</Text>
        <Button label="Go back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const stance = topicStance(topic);
  const action = topicAction(stance);
  const meta = [formatMinutes(topic.estimated_minutes), topic.difficulty]
    .filter(Boolean)
    .join(' · ');

  const topicDigests = digests.filter((d) => d.topicId === topic.id);
  const unread = topicDigests.filter((d) => d.status !== 'marked');
  const taught = topicDigests.filter((d) => d.status === 'marked');
  const topicNotes = notes.filter((n) => n.topicId === topic.id);
  const patterns = misconceptions.filter((m) => m.topicId === topic.id).flatMap((m) => m.patterns);

  /**
   * Fetch the revision a failed checkpoint owes. Unlike before, this stays put —
   * the tips it writes appear in this screen's own lesson list, so sending the
   * learner to the archive to read them would now be a detour away from where
   * they already are.
   */
  const handleRevise = async () => {
    setProgressError('');
    setDigestError('');
    closeCheckpoint();
    const digest = await generateNextDigest(roadmap._id, topic.id);
    // Null most often means revision tips are already waiting, which is not a
    // failure — and either way they are in the list below.
    if (!digest) setDigestError(useLearningStore.getState().digestError);
    fetchDigests({ roadmapId: roadmap._id, topicId: topic.id, limit: 50 });
  };

  const handleAction = async () => {
    setProgressError('');
    if (stance.done) {
      try {
        await submitProgress(roadmap._id, topic.id, 'not_started');
      } catch {
        setProgressError('Failed to update progress. Please try again.');
      }
      return;
    }
    if (stance.owed) return handleRevise();
    if (!stance.started && !stance.ready) {
      try {
        await submitProgress(roadmap._id, topic.id, 'in_progress');
        setJustFinished('Started — daily lessons for this topic begin now.');
      } catch {
        setProgressError('Could not start that topic. Please try again.');
      }
      return;
    }
    startCheckpoint(topic.id, roadmap._id);
  };

  const handleMarkDigest = async (
    digest: Digest,
    answers: { question: number; answer: number }[],
    written: Record<number, string>,
    generateNext: boolean
  ) => {
    setMarkingDigest(digest._id);
    setDigestError('');
    try {
      const result = await markDigest(digest._id, { answers, written, generateNext });
      if (generateNext && !result.generated) {
        setDigestError(
          result.topic_status === 'needs_review'
            ? "That's the last of the lessons — the checkpoint completes this topic."
            : "Nothing new to send yet — you're up to date on this topic."
        );
      }
      fetchDigests({ roadmapId: roadmap._id, topicId: topic.id, limit: 50 });
    } catch (e: any) {
      setDigestError(e?.message ?? 'Could not mark that lesson.');
    } finally {
      setMarkingDigest(null);
    }
  };

  const handleExplain = async (text: string) => {
    setExplainError('');
    setExplaining(true);
    try {
      setExplanation(await explainTopic(topic.id, { roadmapId: roadmap._id, text }));
    } catch (e: any) {
      setExplainError(e?.message ?? 'Could not read that just now.');
    } finally {
      setExplaining(false);
    }
  };

  /** Passing is the only thing that completes a topic, so this is where the
   *  roadmap actually moves — and where the next topic gets offered. */
  const handleCheckpointDone = (passed: boolean, wasReview: boolean) => {
    fetchInsights(roadmap._id);
    if (!passed || wasReview) return;
    const next = nextTopicOf(roadmap, topic.id);
    setJustFinished(next ? `✓ Done. Next up: ${next.title}` : '🎉 Roadmap complete.');
  };

  const next = stance.done ? nextTopicOf(roadmap, topic.id) : undefined;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View className="bg-bg flex-1">
        <ScreenHeader
          title={topic.title}
          back
          actions={<ThemeToggle />}
          subtitle={
            <Text className="text-ink-soft mt-0.5 flex-1 pr-2 text-[13px]" numberOfLines={1}>
              {roadmap.title}
              {meta ? ` · ${meta}` : ''}
            </Text>
          }
        />

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          <PageBody className="pt-3">
            <StatusStrip topic={topic} mastery={insights[roadmap._id]?.topic_mastery?.[topic.id]} />

            {!!justFinished && (
              <View className="border-success bg-success-soft mb-3 rounded-xl border p-3">
                <Text className="text-success text-[13px] font-semibold">{justFinished}</Text>
              </View>
            )}
            {!!progressError && (
              <View className="border-danger bg-danger-soft mb-3 rounded-xl border p-3">
                <Text className="text-danger text-[13px]">{progressError}</Text>
              </View>
            )}

            {/* The one action, and what it costs to take it. */}
            <Card className="mb-3">
              <Button
                label={action.label}
                variant={stance.done ? 'secondary' : 'primary'}
                full
                loading={checkpointLoading || (stance.owed && generatingDigest)}
                onPress={handleAction}
                accessibilityHint={action.hint}
              />
              {!stance.done && !stance.started && !stance.ready && (
                <Text className="text-ink-faint mt-1.5 text-[13px]">
                  Starting it turns on daily lessons for this topic.
                </Text>
              )}
              {stance.ready && !stance.owed && (
                <Text className="text-ink-faint mt-1.5 text-[13px]">
                  The lessons have covered this topic — pass the checkpoint to complete it.
                </Text>
              )}
              {stance.owed && (
                <Text className="text-warning mt-1.5 text-[13px]">
                  That last attempt didn&apos;t pass — a short revision comes first.
                </Text>
              )}
              {stance.done && (
                <View className="mt-2">
                  <Button
                    label="🔁 Review this topic"
                    variant="secondary"
                    size="sm"
                    onPress={() =>
                      stance.owed ? handleRevise() : startCheckpoint(topic.id, roadmap._id)
                    }
                  />
                </View>
              )}

              {!checkpoint && !!checkpointError && (
                <Text className="text-danger mt-2 text-[13px]">{checkpointError}</Text>
              )}

              {checkpointBlocked?.topicId === topic.id && (
                <CheckpointBlockedCard
                  blocked={checkpointBlocked}
                  busy={generatingDigest}
                  onRevise={handleRevise}
                  onDismiss={closeCheckpoint}
                />
              )}

              {checkpoint?.topicId === topic.id && (
                <CheckpointCard
                  checkpoint={checkpoint}
                  outcome={checkpointOutcome}
                  loading={checkpointLoading}
                  error={checkpointError}
                  onSubmit={async (answers) => {
                    const result = await submitCheckpoint(answers);
                    if (result) handleCheckpointDone(result.passed, result.was_review);
                  }}
                  // A failed attempt owes revision, and the server refuses the
                  // retry until it's read. Sending them there is the difference
                  // between a retry and a round trip to "no".
                  onRetry={async () => {
                    if (!stance.owed) {
                      startCheckpoint(topic.id, roadmap._id, true);
                      return;
                    }
                    await handleRevise();
                  }}
                  onClose={closeCheckpoint}
                />
              )}

              {/* Offered once the topic is ready to be completed, and withdrawn
                  once earned — asking someone to explain the same topic twice
                  pays out nothing the second time. */}
              {(stance.ready || stance.done) && !topic.feynman_passed && (
                <FeynmanCard
                  title={topic.title}
                  minWords={FEYNMAN_MIN_WORDS}
                  result={explanation}
                  busy={explaining}
                  error={explainError}
                  onSubmit={handleExplain}
                  onDismiss={() => setExplanation(null)}
                />
              )}
            </Card>

            {/* Finishing a topic should hand over the next one rather than
                leaving the learner to go back and hunt for it. */}
            {!!next && (
              <TouchableOpacity
                onPress={() => router.replace(`/learning/${roadmap._id}/${next.id}`)}
                className="bg-primary-soft mb-3 flex-row items-center gap-2 rounded-xl px-3.5 py-3"
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Next up: ${next.title}`}>
                <Text className="text-primary text-[13px] font-bold">Next up →</Text>
                <Text className="text-ink flex-1 text-[15px]" numberOfLines={1}>
                  {next.title}
                </Text>
              </TouchableOpacity>
            )}

            {!!topic.description && (
              <Card className="mb-3">
                <Text className="text-ink-soft text-[15px] leading-relaxed">
                  {topic.description}
                </Text>

                {(topic.learning_outcomes ?? []).length > 0 && (
                  <View className="mt-3">
                    <Text className="text-ink mb-1 text-[13px] font-bold">
                      You&apos;ll be able to
                    </Text>
                    {topic.learning_outcomes!.map((o, i) => (
                      <View key={i} className="flex-row gap-2">
                        <Text className="text-ink-faint text-[15px] leading-relaxed">•</Text>
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
              </Card>
            )}

            {!!digestError && (
              <View className="border-danger bg-danger-soft mb-3 rounded-xl border p-3">
                <Text className="text-danger text-[13px]">{digestError}</Text>
              </View>
            )}

            {/* Anything unread is a task, and gets the full card — the recall
                check included, so it can be answered here rather than sending the
                learner to Today to find the same digest. */}
            {unread.length > 0 && (
              <>
                <SectionLabel>Waiting for you</SectionLabel>
                {unread.map((d) => (
                  <DigestCard
                    key={d._id}
                    digest={d}
                    failure={digestQuizFailures[d._id]}
                    busy={markingDigest === d._id}
                    onMark={(answers, written, generateNext) =>
                      handleMarkDigest(d, answers, written, generateNext)
                    }
                  />
                ))}
              </>
            )}

            {taught.length > 0 && (
              <>
                <SectionLabel>{`What you've been taught · ${taught.length}`}</SectionLabel>
                {taught.map((d) => (
                  <TaughtCard key={d._id} digest={d} />
                ))}
              </>
            )}

            {topicDigests.length === 0 && (
              <DashedCard className="mb-3">
                <Text className="text-ink-soft text-[15px] leading-relaxed">
                  {stance.started
                    ? 'No lessons on this topic yet — the next one arrives on schedule, or ask the tutor for it now.'
                    : 'Lessons start arriving once you begin this topic.'}
                </Text>
              </DashedCard>
            )}

            {/* Only what was inferred about *this* topic. On the Insights screen
                it sits among everything else; here it is beside the material it
                is about, which is where it can actually be acted on. */}
            {patterns.length > 0 && (
              <>
                <SectionLabel>What keeps catching you out</SectionLabel>
                <Card className="border-warning/40 mb-3">
                  {patterns.map((p, i) => (
                    <View key={i} className={i > 0 ? 'border-line mt-2.5 border-t pt-2.5' : ''}>
                      <Text className="text-ink text-[15px] font-semibold">{p.label}</Text>
                      <Text className="text-ink-soft mt-0.5 text-[13px] leading-relaxed">
                        {p.detail}
                      </Text>
                    </View>
                  ))}
                </Card>
              </>
            )}

            <SectionLabel>{`Notes${topicNotes.length ? ` · ${topicNotes.length}` : ''}`}</SectionLabel>
            <Card className="mb-3">
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
                onSave={(n) => addNote({ ...n, roadmapId: roadmap._id, topicId: topic.id })}
              />
            </Card>

            {(topic.resources ?? []).length > 0 && (
              <>
                <SectionLabel>Resources</SectionLabel>
                <Card className="mb-3">
                  {topic.resources!.map((r, i) => (
                    <InsetCard key={i} className="mb-1.5">
                      <TouchableOpacity
                        disabled={!r.url}
                        onPress={() => r.url && Linking.openURL(r.url).catch(() => {})}
                        activeOpacity={0.7}
                        accessibilityRole={r.url ? 'link' : undefined}>
                        <Text
                          className={`text-[15px] ${
                            r.url ? 'text-primary font-semibold' : 'text-ink-soft'
                          }`}>
                          {r.title} {r.url ? '↗' : ''}
                        </Text>
                        {!!r.resource_type && r.resource_type !== 'other' && (
                          <Text className="text-ink-faint mt-0.5 text-[13px] capitalize">
                            {r.resource_type}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </InsetCard>
                  ))}
                </Card>
              </>
            )}
          </PageBody>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
