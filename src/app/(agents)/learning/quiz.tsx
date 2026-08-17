import { SectionLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, DashedCard, InsetCard } from '@/components/ui/Card';
import { PageBody } from '@/components/ui/Page';
import { useLearningStore } from '@/features/learning/store';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Practice: a quiz raised from the tutor panel, on whatever the learner asked
 * about. Reached only through chat — it is not in the section nav, because it
 * has no standing queue of its own to come back to.
 *
 * It is deliberately NOT a checkpoint, and the wording throughout says so. A set
 * of four questions that looks identical to the one gating a topic, but isn't,
 * is the kind of ambiguity that makes someone think they've damaged something.
 *
 * Two rules the checkpoint holds that this screen does not:
 *
 *  - **Answers are shown.** Withholding them exists to stop a failed checkpoint
 *    being transcribed into a passing retry. Practice gates nothing, so there is
 *    no retry to protect and immediate feedback is simply the better teaching —
 *    see the note on `POST /submit-quiz` server-side.
 *  - **It completes nothing.** Only a checkpoint can mark a topic done.
 *
 * What it does still do is count: the server records the attempt like any other,
 * so it feeds mastery and the misconception tracker. That is worth saying out
 * loud rather than letting someone discover it in their numbers later.
 */
export default function QuizScreen() {
  const router = useRouter();
  const { activeQuiz, quizResult, submitQuiz, clearQuiz } = useLearningStore();
  /** Picks by question index. A map rather than an array sized to the questions,
   *  so there is nothing to initialise when a new set arrives. */
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [pickedFor, setPickedFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Clearing the picks when a different quiz arrives is state adjusted during
  // render, not in an effect: an effect would paint the previous set's answers
  // against the new questions for one frame before correcting itself.
  if (activeQuiz && activeQuiz.quizId !== pickedFor) {
    setPickedFor(activeQuiz.quizId);
    setPicks({});
  }

  /** Closing has to clear the active quiz as well as pop the screen, or the next
   *  chat quiz opens onto this one's answers. */
  const handleClose = () => {
    clearQuiz();
    router.back();
  };

  if (!activeQuiz) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1 }} className="bg-bg">
        <PageBody className="flex-1 items-center justify-center">
          <DashedCard className="w-full items-center px-6 py-10">
            <Text className="mb-2 text-5xl">📝</Text>
            <Text className="text-ink mb-1 text-[20px] font-bold">No practice loaded</Text>
            <Text className="text-ink-soft mb-4 text-center text-[15px] leading-relaxed">
              Ask the tutor to quiz you on a topic and it&apos;ll open here.
            </Text>
            <Button label="Go back" variant="secondary" onPress={() => router.back()} />
          </DashedCard>
        </PageBody>
      </SafeAreaView>
    );
  }

  const { questions, quizId } = activeQuiz;
  const answered = questions.filter((_, i) => picks[i] !== undefined).length;
  const allAnswered = answered === questions.length;

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (quizResult) return;
    setPicks((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleSubmit = async () => {
    const payload = questions
      .map((_, i) => (picks[i] !== undefined ? { question: i, answer: picks[i] } : null))
      .filter((x): x is { question: number; answer: number } => x !== null);
    setSubmitting(true);
    setError('');
    try {
      await submitQuiz(quizId, payload);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Could not grade that. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }} className="bg-bg">
      {/* Its own header rather than ScreenHeader's `back`: leaving has to clear
          the quiz, which a plain router.back() wouldn't. */}
      <PageBody className="pt-3 pb-2 md:pt-5">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={handleClose}
            className="bg-surface-alt h-10 items-center justify-center rounded-xl px-3.5"
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close practice">
            <Text className="text-ink-soft text-[15px] font-semibold">Close</Text>
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="text-ink text-[26px] leading-tight font-extrabold md:text-[28px]">
              Practice
            </Text>
            {/* Both halves of the truth, in one line: it can't finish anything,
                and it isn't a freebie either. */}
            <Text className="text-ink-soft mt-0.5 text-[13px]">
              Won&apos;t complete a topic — but it counts toward your mastery
            </Text>
          </View>

          {!quizResult && (
            <Text className="text-ink-faint shrink-0 text-[13px]">
              {answered}/{questions.length}
            </Text>
          )}
        </View>
      </PageBody>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <PageBody className="pt-3">
          {quizResult && (
            <Card
              className={`mb-4 ${
                quizResult.correct === quizResult.total ? 'border-success' : 'border-primary'
              }`}>
              <Text
                className={`text-[26px] font-extrabold ${
                  quizResult.correct === quizResult.total ? 'text-success' : 'text-ink'
                }`}>
                {quizResult.correct}/{quizResult.total} · {quizResult.score}%
              </Text>
              <Text className="text-ink-soft mt-0.5 text-[15px] leading-relaxed">
                {quizResult.correct === quizResult.total
                  ? 'Every one. Nothing to go back over.'
                  : "Answers are below — practice gates nothing, so there's no reason to hide them."}
              </Text>

              {quizResult.review.length > 0 && (
                <View className="mt-4">
                  <SectionLabel>Worth another look</SectionLabel>
                  {quizResult.review.map((r, i) => (
                    <InsetCard key={i} className="mb-1.5">
                      <Text className="text-ink text-[15px] font-medium">
                        {questions[r.question]?.question}
                      </Text>
                      <Text className="text-danger mt-1.5 text-[13px]">
                        You said:{' '}
                        {r.selected == null
                          ? 'nothing'
                          : (questions[r.question]?.options[r.selected] ?? '—')}
                      </Text>
                      {!!r.correctOption && (
                        <Text className="text-success mt-0.5 text-[13px]">
                          Answer: {r.correctOption}
                        </Text>
                      )}
                    </InsetCard>
                  ))}
                </View>
              )}

              <View className="mt-4">
                <Button label="Done" onPress={handleClose} />
              </View>
            </Card>
          )}

          {!quizResult &&
            questions.map((q, qIdx) => (
              <Card key={qIdx} className="mb-3">
                <Text className="text-ink mb-2.5 text-[15px] font-medium">
                  {qIdx + 1}. {q.question}
                </Text>
                {q.options.map((opt, optIdx) => {
                  const isSel = picks[qIdx] === optIdx;
                  return (
                    <TouchableOpacity
                      key={optIdx}
                      disabled={submitting}
                      onPress={() => handleSelect(qIdx, optIdx)}
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
              </Card>
            ))}

          {!!error && (
            <View className="border-danger bg-danger-soft mb-3 rounded-xl border p-3">
              <Text className="text-danger text-[13px]">{error}</Text>
            </View>
          )}

          {!quizResult && (
            <Button
              label={allAnswered ? 'Submit' : `Answer all ${questions.length}`}
              full
              disabled={!allAnswered}
              loading={submitting}
              loadingLabel="Grading…"
              onPress={handleSubmit}
            />
          )}
        </PageBody>
      </ScrollView>
    </SafeAreaView>
  );
}
