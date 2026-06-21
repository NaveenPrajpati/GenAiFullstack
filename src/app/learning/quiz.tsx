import { useAuth } from '@/context/AuthContext';
import { useLearningStore } from '@/features/learning/store';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function QuizScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { activeQuiz, quizResult, submitQuiz, clearQuiz } = useLearningStore();
  const [selected, setSelected] = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeQuiz) {
      setSelected(new Array<number | null>(activeQuiz.questions.length).fill(null));
    }
  }, [activeQuiz?.quizId]);

  const handleClose = () => {
    clearQuiz();
    router.back();
  };

  if (!activeQuiz) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Text className="mb-2 text-5xl">📝</Text>
        <Text className="mb-4 text-center text-base text-gray-500">No quiz loaded.</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="rounded-lg bg-violet-600 px-5 py-3">
          <Text className="text-sm font-medium text-white">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { questions, quizId } = activeQuiz;
  const answers = selected.length === questions.length ? selected : questions.map(() => null);
  const answered = answers.filter((a) => a !== null).length;

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (quizResult) return;
    const next = [...answers];
    next[qIdx] = optIdx;
    setSelected(next);
  };

  const handleSubmit = async () => {
    if (!token) return;
    const payload = answers
      .map((a, i) => (a !== null ? { question: i, answer: a } : null))
      .filter((x): x is { question: number; answer: number } => x !== null);
    setSubmitting(true);
    setError('');
    try {
      await submitQuiz(token, quizId, payload);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={handleClose}>
            <Text className="text-sm text-violet-600">← Close</Text>
          </TouchableOpacity>
          <Text className="text-base font-bold text-gray-900">Quiz</Text>
          <Text className="text-xs text-gray-400">
            {answered}/{questions.length}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Score card */}
        {quizResult && (
          <View className="mb-6 rounded-xl border border-green-200 bg-green-50 p-5">
            <Text className="mb-1 text-center text-3xl font-bold text-green-700">
              {quizResult.correct}/{quizResult.total}
            </Text>
            <Text className="mb-4 text-center text-sm text-green-600">
              {quizResult.correct === quizResult.total
                ? 'Perfect score!'
                : `${Math.round((quizResult.correct / quizResult.total) * 100)}% correct`}
            </Text>

            {quizResult.review.length > 0 && (
              <View className="mb-4">
                <Text className="mb-2 text-xs font-semibold text-gray-700">
                  Review — wrong answers
                </Text>
                {quizResult.review.map((r, i) => (
                  <View key={i} className="mb-2 rounded-lg border border-red-100 bg-white p-3">
                    <Text className="mb-1 text-xs font-medium text-gray-700">
                      Q{r.question + 1}: {questions[r.question]?.question}
                    </Text>
                    <Text className="text-xs text-red-500">
                      Your answer: {questions[r.question]?.options[r.selected]}
                    </Text>
                    <Text className="text-xs text-green-600">Correct: {r.correctOption}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              onPress={handleClose}
              className="items-center rounded-xl bg-violet-600 py-3"
              activeOpacity={0.8}>
              <Text className="text-sm font-semibold text-white">Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Questions */}
        {!quizResult &&
          questions.map((q, qIdx) => (
            <View key={qIdx} className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
              <Text className="mb-3 text-sm font-semibold text-gray-900">
                {qIdx + 1}. {q.question}
              </Text>
              {q.options.map((opt, optIdx) => {
                const isSel = answers[qIdx] === optIdx;
                return (
                  <TouchableOpacity
                    key={optIdx}
                    onPress={() => handleSelect(qIdx, optIdx)}
                    className={`mb-2 flex-row items-center gap-3 rounded-lg border px-3 py-2.5 ${
                      isSel ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-gray-50'
                    }`}
                    activeOpacity={0.7}>
                    <View
                      className={`h-4 w-4 rounded-full border-2 ${
                        isSel ? 'border-violet-500 bg-violet-500' : 'border-gray-300'
                      }`}
                    />
                    <Text
                      className={`flex-1 text-sm ${
                        isSel ? 'font-medium text-violet-800' : 'text-gray-700'
                      }`}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

        {!!error && (
          <View className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        )}

        {!quizResult && (
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || answered < questions.length}
            className={`items-center rounded-xl py-4 ${
              submitting || answered < questions.length ? 'bg-gray-300' : 'bg-violet-600'
            }`}
            activeOpacity={0.8}>
            {submitting ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="white" />
                <Text className="text-sm font-semibold text-white">Submitting…</Text>
              </View>
            ) : (
              <Text className="text-sm font-semibold text-white">
                {answered < questions.length
                  ? `Answer all questions (${answered}/${questions.length})`
                  : 'Submit Quiz'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
