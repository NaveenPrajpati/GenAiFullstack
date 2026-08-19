import { Badge, SectionLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, DashedCard, InsetCard } from '@/components/ui/Card';
import { PageBody } from '@/components/ui/Page';
import ScreenHeader from '@/components/ui/ScreenHeader';
import SectionNav, { useWideNav } from '@/components/ui/SectionNav';
import { useColors } from '@/components/ui/theme';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useLearningStore } from '@/features/learning/store';
import type { PracticeResult } from '@/features/learning/types';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Practice: five questions across whatever needs keeping sharp.
 *
 * The one screen in the app you can use on a day when nothing is waiting, and the
 * only retrieval here that **interleaves** — every other check sits inside one
 * topic, where the surrounding context carries half the answer. Mixing five
 * topics forces the recall to start from the question.
 *
 * It is deliberately weightless: it completes nothing, and a bad round cannot
 * cost anything, because an exercise that can lower your headline number is one
 * nobody volunteers for. The screen says both, once, rather than making anyone
 * guess what a wrong answer here is going to do to them.
 */
export default function PracticeScreen() {
  const router = useRouter();
  const {
    practice,
    practiceResult,
    practiceLoading,
    practiceError,
    startPractice,
    submitPractice,
    clearPractice,
  } = useLearningStore();

  /** Picks by question index — a map, so a new deck needs nothing initialised. */
  const [picks, setPicks] = useState<Record<number, number>>({});
  const colors = useColors();
  const wide = useWideNav();

  const questions = practice?.questions ?? [];
  const answered = questions.filter((_, i) => picks[i] !== undefined).length;
  const allAnswered = questions.length > 0 && answered === questions.length;

  const begin = async () => {
    setPicks({});
    await startPractice();
  };

  const handleSubmit = () =>
    submitPractice(
      questions
        .map((_, i) => (picks[i] !== undefined ? { question: i, answer: picks[i] } : null))
        .filter((x): x is { question: number; answer: number } => x !== null)
    );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View className="bg-bg flex-1">
        <ScreenHeader
          title="Practice"
          subtitle={
            practice && !practiceResult
              ? `${answered}/${questions.length} answered`
              : 'A few questions across what needs keeping sharp'
          }
          showMenu={!wide}
          actions={<ThemeToggle />}>
          <SectionNav />
        </ScreenHeader>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          <PageBody className="pt-3">
            {/* A refusal REPLACES the invitation rather than sitting above it.
                The most likely person to see one is somebody who has just found
                Practice in the nav and has not finished a topic yet — and
                "you've nothing to practise" printed over an unchanged "Start
                practising" button reads as the button having failed. */}
            {!!practiceError && !practice && !practiceLoading && (
              <DashedCard className="border-warning items-center px-6 py-8">
                <Text className="mb-2 text-4xl">🌱</Text>
                <Text className="text-ink mb-1 text-[20px] font-bold">Not yet</Text>
                <Text className="text-ink-soft mb-4 text-center text-[15px] leading-relaxed">
                  {practiceError}
                </Text>
                <Button label="Try again" variant="secondary" onPress={begin} />
              </DashedCard>
            )}

            {/* Before a deck exists: what this is, and what it isn't. */}
            {!practice && !practiceLoading && !practiceError && (
              <DashedCard className="items-center px-6 py-8">
                <Text className="mb-2 text-4xl">🎯</Text>
                <Text className="text-ink mb-1 text-[20px] font-bold">Keep it sharp</Text>
                <Text className="text-ink-soft mb-1 text-center text-[15px] leading-relaxed">
                  Five questions mixed across topics you&apos;ve finished. Jumping between them is
                  harder than one at a time — that&apos;s the point.
                </Text>
                <Text className="text-ink-faint mb-4 text-center text-[13px] leading-relaxed">
                  Nothing here completes a topic, and a bad round costs you nothing.
                </Text>
                <Button label="Start practising" onPress={begin} />
              </DashedCard>
            )}

            {practiceLoading && !practice && (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="text-ink-faint mt-3 text-[13px]">Putting a set together…</Text>
              </View>
            )}

            {!!practice && !practiceResult && (
              <>
                {/* Which topics are in the mix. Named up front because being
                    surprised by a topic is different from being tested on it. */}
                <View className="mb-3 flex-row flex-wrap gap-1.5">
                  {practice.topics.map((t) => (
                    <Badge key={t.topicId} label={t.title} tone="neutral" />
                  ))}
                </View>

                {questions.map((q, qIdx) => (
                  <Card key={qIdx} className="mb-3">
                    {!!q.topicTitle && (
                      <Text className="text-ink-faint mb-1 text-[13px]">{q.topicTitle}</Text>
                    )}
                    <Text className="text-ink mb-2.5 text-[15px] font-medium">
                      {qIdx + 1}. {q.question}
                    </Text>
                    <View accessibilityRole="radiogroup" accessibilityLabel={q.question}>
                      {q.options.map((opt, optIdx) => {
                        const isSel = picks[qIdx] === optIdx;
                        return (
                          <TouchableOpacity
                            key={optIdx}
                            disabled={practiceLoading}
                            onPress={() => setPicks((p) => ({ ...p, [qIdx]: optIdx }))}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: isSel }}
                            className={`mb-1.5 flex-row items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                              isSel ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
                            }`}
                            activeOpacity={0.7}>
                            <View
                              className={`h-4 w-4 items-center justify-center rounded-full border-2 ${
                                isSel ? 'border-primary' : 'border-line'
                              }`}>
                              {isSel && <View className="bg-primary h-2 w-2 rounded-full" />}
                            </View>
                            <Text className="text-ink flex-1 text-[15px]">{opt}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </Card>
                ))}

                <Button
                  label={allAnswered ? 'Check my answers' : `Answer all ${questions.length}`}
                  full
                  disabled={!allAnswered}
                  loading={practiceLoading}
                  loadingLabel="Marking…"
                  onPress={handleSubmit}
                />
              </>
            )}

            {!!practiceResult && (
              <PracticeReport
                result={practiceResult}
                questions={questions}
                picks={picks}
                onAgain={begin}
                onDone={() => {
                  clearPractice();
                  router.push('/learning');
                }}
                onOpenTopic={(roadmapId, topicId) =>
                  router.push(`/learning/${roadmapId}/${topicId}`)
                }
              />
            )}
          </PageBody>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/**
 * How it went, and — because the deck was mixed — which topic let them down.
 *
 * Answers are shown in full. Withholding them exists so a failed checkpoint
 * cannot be transcribed into a passing retry, and there is no retry here to
 * protect; seeing what you got wrong is the entire payoff.
 */
function PracticeReport({
  result,
  questions,
  picks,
  onAgain,
  onDone,
  onOpenTopic,
}: {
  result: PracticeResult;
  questions: { question: string; options: string[]; topicTitle?: string }[];
  picks: Record<number, number>;
  onAgain: () => void;
  onDone: () => void;
  onOpenTopic: (roadmapId: string, topicId: string) => void;
}) {
  const perfect = result.correct === result.total;
  // `review` carries only what was missed, so anything absent from it was right.
  const missed = new Set(result.review.map((r) => r.question));

  return (
    <>
      <Card className={`mb-3 ${perfect ? 'border-success' : 'border-primary'}`}>
        <Text className={`text-[26px] font-extrabold ${perfect ? 'text-success' : 'text-ink'}`}>
          {result.correct}/{result.total}
        </Text>
        <Text className="text-ink-soft mt-0.5 text-[15px] leading-relaxed">
          {perfect
            ? 'All of them, across topics you finished a while ago. That is what holding it looks like.'
            : 'Nothing here counts against you — what you missed just tells the tutor where to aim next.'}
        </Text>
      </Card>

      {result.topics.length > 1 && (
        <>
          <SectionLabel>By topic</SectionLabel>
          <Card className="mb-3">
            {result.topics.map((t, i) => (
              <TouchableOpacity
                key={t.topicId}
                onPress={() => onOpenTopic(t.roadmapId, t.topicId)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Open ${t.title}`}
                className={`flex-row items-center justify-between gap-2 ${
                  i > 0 ? 'border-line mt-2 border-t pt-2' : ''
                }`}>
                <Text className="text-ink flex-1 text-[15px]" numberOfLines={1}>
                  {t.title}
                </Text>
                <Text
                  className={`text-[13px] font-bold ${
                    t.correct === t.total ? 'text-success' : 'text-warning'
                  }`}>
                  {t.correct}/{t.total}
                </Text>
                <Text className="text-ink-faint text-[13px]">›</Text>
              </TouchableOpacity>
            ))}
          </Card>
        </>
      )}

      <SectionLabel>Every question</SectionLabel>
      {questions.map((q, i) => {
        const wrong = missed.has(i);
        const entry = result.review.find((r) => r.question === i);
        return (
          <Card key={i} className={`mb-2 ${wrong ? 'border-warning' : ''}`}>
            <Text className="text-ink-faint mb-1 text-[13px]">
              {wrong ? '✗' : '✓'} {q.topicTitle}
            </Text>
            <Text className="text-ink text-[15px] font-medium">{q.question}</Text>
            {wrong && (
              <InsetCard className="mt-2">
                <Text className="text-danger text-[13px]">
                  You said: {picks[i] !== undefined ? q.options[picks[i]] : 'nothing'}
                </Text>
                {!!entry?.correctOption && (
                  <Text className="text-success mt-0.5 text-[13px]">
                    Answer: {entry.correctOption}
                  </Text>
                )}
                {!!entry?.hint && (
                  <Text className="text-ink-faint mt-1 text-[13px] leading-relaxed">
                    {entry.hint}
                  </Text>
                )}
              </InsetCard>
            )}
          </Card>
        );
      })}

      <View className="mt-2 flex-row gap-2">
        <Button label="Another set" full onPress={onAgain} />
        <Button label="Done" variant="secondary" onPress={onDone} />
      </View>
    </>
  );
}
