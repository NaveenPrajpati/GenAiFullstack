import { useAuth } from '@/context/AuthContext';
import { ChatMarkdown } from '@/features/learning/components/Markdown';
import { useLearningStore } from '@/features/learning/store';
import type {
  ChatMessage,
  OnboardingPrompt,
  Proposal,
  QuizResult,
  Resource,
  RoadmapProgress,
  SelectedTopic,
} from '@/features/learning/types';
import { formatMinutes } from '@/features/learning/types';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ─── Message card sub-components ─── */

function ExplainCard({ text }: { text: string }) {
  return (
    <View className="rounded-xl border border-violet-200 bg-violet-50 p-4">
      <Text className="mb-1.5 text-xs font-semibold text-violet-600">Explanation</Text>
      <ChatMarkdown markdown={text} />
    </View>
  );
}

function ResourcesCard({ suggestions }: { suggestions: Resource[] }) {
  return (
    <View className="rounded-xl border border-blue-100 bg-blue-50 p-4">
      <Text className="mb-2 text-xs font-semibold text-blue-600">Resources</Text>
      {suggestions.map((r, i) => (
        <TouchableOpacity
          key={i}
          disabled={!r.url}
          onPress={() => r.url && Linking.openURL(r.url).catch(() => {})}>
          <Text
            className={`mb-1 text-sm ${r.url ? 'text-blue-700 underline' : 'text-gray-700'}`}
            numberOfLines={2}>
            {r.title}
          </Text>
          {!!r.resource_type && r.resource_type !== 'other' && (
            <Text className="mb-1.5 text-xs text-blue-400 capitalize">{r.resource_type}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ProgressCard({
  next_topic,
  progress,
}: {
  next_topic: string | null;
  progress: RoadmapProgress;
}) {
  return (
    <View className="rounded-xl border border-green-100 bg-green-50 p-4">
      <Text className="mb-1 text-xs font-semibold text-green-600">Your progress</Text>
      <Text className="mb-2 text-sm font-medium text-gray-900">
        {next_topic ? `Next: ${next_topic}` : 'All topics complete 🎉'}
      </Text>
      <View className="mb-1 h-1.5 overflow-hidden rounded-full bg-green-200">
        <View
          className="h-1.5 rounded-full bg-green-500"
          style={{ width: `${progress.percent}%` }}
        />
      </View>
      <Text className="text-xs text-gray-500">
        {progress.completed_count}/{progress.total} topics · {progress.remaining} remaining
      </Text>
    </View>
  );
}

function QuizResultCard({ result }: { result: QuizResult }) {
  return (
    <View className="rounded-xl border border-amber-100 bg-amber-50 p-4">
      <Text className="mb-1 text-xs font-semibold text-amber-600">Quiz graded</Text>
      <Text className="mb-2 text-lg font-bold text-gray-900">
        {result.correct}/{result.total} · {result.score}%
      </Text>
      {result.review.length > 0 && (
        <View>
          <Text className="mb-1 text-xs font-semibold text-gray-500">What to review</Text>
          {result.review.map((r, i) => (
            <Text key={i} className="mb-0.5 text-xs text-gray-600">
              • Q{r.question + 1} — correct answer: {r.correctOption ?? '—'}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * The first-run profile questions. The turn the learner sent is paused on the
 * server until this is answered or skipped, so the card always offers a way out.
 */
function OnboardingCard({
  prompt,
  onSubmit,
  submitting,
}: {
  prompt: OnboardingPrompt;
  onSubmit: (answers: Record<string, string> | null) => void;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const allAnswered = prompt.questions.every((q) => answers[q.key]);

  return (
    <View className="rounded-xl border border-violet-200 bg-violet-50 p-4">
      <Text className="mb-3 text-xs font-semibold text-violet-600">Let&apos;s personalize</Text>
      {prompt.questions.map((q) => (
        <View key={q.key} className="mb-3">
          <Text className="mb-1.5 text-sm font-medium text-gray-800">{q.q}</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {q.options.map((opt) => {
              const isSel = answers[q.key] === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setAnswers((a) => ({ ...a, [q.key]: opt }))}
                  className={`rounded-lg border px-3 py-1.5 ${
                    isSel ? 'border-violet-500 bg-violet-500' : 'border-gray-200 bg-white'
                  }`}
                  activeOpacity={0.7}>
                  <Text className={`text-xs capitalize ${isSel ? 'text-white' : 'text-gray-700'}`}>
                    {opt.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => onSubmit(answers)}
          disabled={!allAnswered || submitting}
          className={`flex-1 items-center rounded-lg py-2.5 ${
            allAnswered && !submitting ? 'bg-violet-600' : 'bg-gray-300'
          }`}
          activeOpacity={0.8}>
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-sm font-semibold text-white">Save</Text>
          )}
        </TouchableOpacity>
        {prompt.skippable !== false && (
          <TouchableOpacity
            onPress={() => onSubmit(null)}
            disabled={submitting}
            className="flex-1 items-center rounded-lg bg-gray-200 py-2.5"
            activeOpacity={0.8}>
            <Text className="text-sm font-medium text-gray-700">Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function QuizLaunchCard({ onStart }: { onStart: () => void }) {
  return (
    <View className="rounded-xl border border-amber-100 bg-amber-50 p-4">
      <Text className="mb-1 text-xs font-semibold text-amber-600">Quiz ready</Text>
      <Text className="mb-3 text-sm text-gray-700">
        A quiz has been generated. Tap below to start.
      </Text>
      <TouchableOpacity
        onPress={onStart}
        className="items-center rounded-lg bg-amber-500 py-2.5"
        activeOpacity={0.8}>
        <Text className="text-sm font-semibold text-white">Start Quiz</Text>
      </TouchableOpacity>
    </View>
  );
}

function ProposalCard({
  proposal,
  decision,
  savedRoadmapId,
  onApprove,
  onReject,
  onView,
  approving,
}: {
  proposal: Proposal;
  decision?: 'approved' | 'rejected';
  savedRoadmapId?: string;
  onApprove: () => void;
  onReject: () => void;
  onView: (roadmapId?: string) => void;
  approving: boolean;
}) {
  const p = proposal.roadmap;
  return (
    <View className="rounded-xl border border-violet-200 bg-violet-50 p-4">
      <Text className="mb-1 text-xs font-semibold text-violet-600">Proposed Roadmap</Text>
      <Text className="mb-1 text-base font-bold text-gray-900">{p?.title}</Text>
      {!!p?.summary && (
        <Text className="mb-3 text-sm leading-relaxed text-gray-600">{p.summary}</Text>
      )}

      <View className="mb-3 flex-row flex-wrap gap-1">
        {(p?.stages ?? []).map((s) => (
          <View key={s.order} className="rounded-md bg-blue-50 px-2 py-0.5">
            <Text className="text-xs text-blue-700">{s.title}</Text>
          </View>
        ))}
        {!!p?.total_estimated_hours && (
          <View className="rounded-md bg-violet-100 px-2 py-0.5">
            <Text className="text-xs text-violet-700">{p.total_estimated_hours}h total</Text>
          </View>
        )}
      </View>

      {(p?.topics ?? []).length > 0 && (
        <View className="mb-4 rounded-lg bg-white p-3">
          <Text className="mb-2 text-xs font-semibold text-gray-500">{p.topics.length} topics</Text>
          {p.topics.slice(0, 5).map((t, i) => {
            const duration = formatMinutes(t.estimated_minutes);
            return (
              <Text key={i} className="mb-1 text-xs text-gray-700">
                {t.order}. {t.title}
                {duration ? ` · ${duration}` : ''}
              </Text>
            );
          })}
          {p.topics.length > 5 && (
            <Text className="text-xs text-gray-400">+{p.topics.length - 5} more…</Text>
          )}
        </View>
      )}

      {decision === 'approved' ? (
        <TouchableOpacity
          onPress={() => onView(savedRoadmapId)}
          className="flex-row items-center justify-center rounded-lg bg-green-100 py-2.5"
          activeOpacity={0.8}>
          <Text className="text-sm font-semibold text-green-700">✓ Roadmap saved — view it</Text>
        </TouchableOpacity>
      ) : decision === 'rejected' ? (
        <View className="items-center rounded-lg bg-gray-100 py-2.5">
          <Text className="text-sm font-medium text-gray-500">Discarded</Text>
        </View>
      ) : (
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={onApprove}
            disabled={approving}
            className="flex-1 items-center rounded-lg bg-green-600 py-2.5"
            activeOpacity={0.8}>
            {approving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-sm font-semibold text-white">Approve &amp; Save</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onReject}
            disabled={approving}
            className="flex-1 items-center rounded-lg bg-gray-200 py-2.5"
            activeOpacity={0.8}>
            <Text className="text-sm font-medium text-gray-700">Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function Bubble({
  msg,
  onApprove,
  onReject,
  onStartQuiz,
  onOnboard,
  onView,
  approving,
}: {
  msg: ChatMessage;
  onApprove: () => void;
  onReject: () => void;
  onStartQuiz: () => void;
  onOnboard: (answers: Record<string, string> | null) => void;
  onView: (roadmapId?: string) => void;
  approving: boolean;
}) {
  if (msg.role === 'user') {
    return (
      <View className="mb-3 items-end">
        <View className="max-w-xs rounded-2xl rounded-tr-sm bg-violet-600 px-4 py-2.5">
          <Text className="text-sm text-white">{msg.content}</Text>
        </View>
      </View>
    );
  }

  const d = msg.data;

  if (!d) {
    return (
      <View className="mb-3 items-start">
        <View className="max-w-xs rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-2.5">
          <ChatMarkdown markdown={msg.content} streaming={msg.streaming} />
        </View>
      </View>
    );
  }

  if ('intent' in d) {
    if (d.intent === 'explain')
      return (
        <View className="mb-3 w-9/12 items-start">
          <ExplainCard text={d.topic_explaination} />
        </View>
      );
    if (d.intent === 'quiz')
      return (
        <View className="mb-3 w-64 items-start">
          <QuizLaunchCard onStart={onStartQuiz} />
        </View>
      );
    if (d.intent === 'submit_quiz')
      return (
        <View className="mb-3 w-72 items-start">
          <QuizResultCard result={d.quiz_result} />
        </View>
      );
    if (d.intent === 'find_resources')
      return (
        <View className="mb-3 w-72 items-start">
          <ResourcesCard suggestions={d.suggestions} />
        </View>
      );
    if (d.intent === 'query_roadmap')
      return (
        <View className="mb-3 w-72 items-start">
          <ProgressCard next_topic={d.next_topic} progress={d.progress} />
        </View>
      );
    if (d.intent === 'update_progress')
      return (
        <View className="mb-3 items-start">
          <View className="max-w-xs rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-2.5">
            <Text className="text-sm text-gray-800">
              {d.log_status === 'updated' ? '✓ Progress updated!' : 'Topic not found.'}
            </Text>
          </View>
        </View>
      );
  }

  if ('type' in d && d.type === 'approval_request')
    return (
      <View className="mb-3 w-80 items-start">
        <ProposalCard
          proposal={d.proposal}
          decision={d.decision}
          savedRoadmapId={d.savedRoadmapId}
          onApprove={onApprove}
          onReject={onReject}
          onView={onView}
          approving={approving}
        />
      </View>
    );

  if ('type' in d && d.type === 'onboarding')
    return (
      <View className="mb-3 w-80 items-start">
        <OnboardingCard prompt={d.prompt} onSubmit={onOnboard} submitting={approving} />
      </View>
    );

  return (
    <View className="mb-3 items-start">
      <View className="max-w-xs rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-2.5">
        <ChatMarkdown markdown={msg.content} />
      </View>
    </View>
  );
}

/**
 * Topic-scoped shortcuts on the roadmap screen. These used to sit on every
 * topic card, which repeated the same three buttons down the whole roadmap;
 * now the learner taps a topic and the actions appear here once.
 */
function TopicActions({
  topic,
  roadmapTitle,
  onAsk,
  disabled,
}: {
  topic: SelectedTopic;
  roadmapTitle?: string;
  onAsk: (prompt: string) => void;
  disabled: boolean;
}) {
  const from = roadmapTitle ? ` from the "${roadmapTitle}" roadmap` : '';
  const actions = [
    { label: 'Explain', prompt: `Explain "${topic.title}"${from}` },
    { label: 'Quiz me', prompt: `Quiz me on "${topic.title}"${from}` },
    { label: 'Resources', prompt: `Find resources for "${topic.title}"${from}` },
  ];

  return (
    <View className="border-t border-gray-100 bg-white px-4 py-3">
      <Text className="mb-2 text-xs text-gray-500" numberOfLines={1}>
        Selected: <Text className="font-semibold text-gray-800">{topic.title}</Text>
      </Text>
      <View className="flex-row gap-2">
        {actions.map((a) => (
          <TouchableOpacity
            key={a.label}
            onPress={() => onAsk(a.prompt)}
            disabled={disabled}
            className={`flex-1 items-center rounded-lg py-2 ${
              disabled ? 'bg-gray-100' : 'bg-violet-50'
            }`}
            activeOpacity={0.7}>
            <Text
              className={`text-xs font-medium ${
                disabled ? 'text-gray-400' : 'text-violet-700'
              }`}>
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/* ─── Main screen ─── */

export default function ChatBot() {
  const { token } = useAuth();
  const router = useRouter();
  // GLOBAL, not local: this panel is rendered by the section layout, and
  // useLocalSearchParams only sees params of the route it is rendered in — from
  // a layout that's empty.
  const { prefill, source, roadmapId: roadmapIdParam } = useGlobalSearchParams<{
    prefill?: string;
    roadmapId?: string;
    source?: string;
  }>();

  // The panel is mounted once for the whole section, so its context comes from
  // the route. Read off the pathname rather than useSegments so nothing depends
  // on how the router spells a dynamic segment: under /learning, anything that
  // isn't one of the named screens IS a roadmap id.
  const pathname = usePathname();
  const screen = pathname.split('/')[2] ?? '';
  const onRoadmapDetail = !['', 'quiz', 'digests', 'settings'].includes(screen);
  const roadmapId = roadmapIdParam ?? (onRoadmapDetail ? screen : undefined);

  // The RAG path answers via the streaming endpoint; every other path uses the
  // plain (non-streaming) POST /query.
  const useStream = source === 'rag';
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState(prefill ?? '');
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState('');

  // The learning Stack renders a native header above this screen, so offset the
  // KeyboardAvoidingView by its height or the input bar sits under the keyboard.
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width <= 500;
  const headerHeight = Platform.OS === 'ios' && isMobile ? insets.top + 44 : 0;

  const {
    chatMessages,
    chatLoading,
    sendChatMessage,
    resolveProposal,
    resolveOnboarding,
    resetChat,
    roadmaps,
    selectedTopic,
  } = useLearningStore();

  const roadmapTitle = roadmaps.find((r) => r._id === roadmapId)?.title;
  // A selection made on one roadmap must not leak into another's chat.
  const topic = selectedTopic?.roadmapId === roadmapId ? selectedTopic : null;

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [chatMessages.length, chatLoading]);

  const handleSend = () => {
    if (!input.trim() || chatLoading || !token) return;
    const text = input.trim();
    setInput('');
    sendChatMessage(text, roadmapId, useStream);
  };

  const handleAsk = (prompt: string) => {
    if (chatLoading || !token) return;
    sendChatMessage(prompt, roadmapId, useStream);
  };

  // What the panel offers depends on where the learner is standing.
  const emptyStateHint = onRoadmapDetail
    ? topic
      ? `Ask me anything about "${topic.title}", or use a shortcut below.`
      : 'Select a topic to get help with it,\nor just ask me anything.'
    : screen === 'quiz'
      ? 'Stuck on a question? Ask me to explain the idea behind it.'
      : screen === 'digests'
        ? 'Ask me to go deeper on anything from your digests.'
        : 'Ask me to create a roadmap, explain a topic,\nquiz you, or find resources.';

  // Approving leaves the user in the chat and switches the card to its saved
  // state; they navigate via "view it" when they want to. Pushing straight to
  // the roadmap used to yank them out of the conversation mid-turn.
  const handleApprove = async () => {
    setApproving(true);
    setApprovalError('');
    try {
      await resolveProposal('approved');
    } catch (e: any) {
      setApprovalError(e?.response?.data?.detail ?? 'Failed to approve.');
    } finally {
      setApproving(false);
    }
  };

  const handleView = (roadmapId?: string) =>
    router.push(roadmapId ? `/learning/${roadmapId}` : '/learning');

  const handleReject = async () => {
    setApproving(true);
    try {
      await resolveProposal('rejected');
    } finally {
      setApproving(false);
    }
  };

  // Answering (or skipping) onboarding resumes the paused turn, so the reply to
  // whatever the learner originally asked arrives from this call.
  const handleOnboard = async (answers: Record<string, string> | null) => {
    setApproving(true);
    setApprovalError('');
    try {
      await resolveOnboarding(answers);
    } catch (e: any) {
      setApprovalError(e?.response?.data?.detail ?? 'Failed to save your preferences.');
    } finally {
      setApproving(false);
    }
  };

  return (
    <View className="flex-1 rounded-xl border border-gray-300 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-base font-bold text-gray-900">AI Tutor</Text>
            {!!roadmapId && (
              <Text className="text-xs text-gray-400" numberOfLines={1}>
                {topic ? topic.title : (roadmapTitle ?? 'Roadmap context active')}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={resetChat}
            className="rounded-lg bg-gray-100 px-3 py-1.5"
            activeOpacity={0.7}>
            <Text className="text-xs text-gray-600">New chat</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
        style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: 8, maxHeight: 400 }}>
          {chatMessages.length === 0 && (
            <View className="items-center py-12">
              <Text className="mb-2 text-5xl">🤖</Text>
              <Text className="mb-1 text-base font-semibold text-gray-700">AI Learning Tutor</Text>
              <Text className="text-center text-sm leading-relaxed text-gray-400">
                {emptyStateHint}
              </Text>
            </View>
          )}

          {chatMessages.map((msg) => (
            <Bubble
              key={msg.id}
              msg={msg}
              onApprove={handleApprove}
              onReject={handleReject}
              onStartQuiz={() => router.push('/learning/quiz')}
              onOnboard={handleOnboard}
              onView={handleView}
              approving={approving}
            />
          ))}

          {chatLoading && (
            <View className="mb-3 items-start">
              <View className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-2.5">
                <ActivityIndicator size="small" />
              </View>
            </View>
          )}

          {!!approvalError && (
            <View className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
              <Text className="text-sm text-red-700">{approvalError}</Text>
            </View>
          )}
        </ScrollView>

        {/* Topic shortcuts, only once a topic is selected on the roadmap screen */}
        {onRoadmapDetail && topic && (
          <TopicActions
            topic={topic}
            roadmapTitle={roadmapTitle}
            onAsk={handleAsk}
            disabled={chatLoading}
          />
        )}

        {/* Input bar */}
        <View className="border-t border-gray-200 bg-white px-4 py-3">
          <View className="flex-row items-end gap-3">
            <TextInput
              className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800"
              style={{ maxHeight: 100 }}
              placeholder="Ask anything…"
              placeholderTextColor="#9ca3af"
              multiline
              value={input}
              onChangeText={setInput}
              // Enter sends, Shift+Enter inserts a newline. The field is
              // multiline, so Enter would otherwise only ever add a line break.
              //
              // Web and native are wired separately on purpose: onKeyPress is
              // the only one carrying the shift modifier, and letting both fire
              // would send the message twice on one keystroke.
              {...(Platform.OS === 'web'
                ? {
                    submitBehavior: 'newline' as const,
                    onKeyPress: (e: any) => {
                      if (e.nativeEvent?.key === 'Enter' && !e.nativeEvent?.shiftKey) {
                        e.preventDefault?.();
                        handleSend();
                      }
                    },
                  }
                : { submitBehavior: 'submit' as const, onSubmitEditing: handleSend })}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || chatLoading}
              className={`h-11 w-11 items-center justify-center rounded-full ${
                !input.trim() || chatLoading ? 'bg-gray-200' : 'bg-violet-600'
              }`}
              activeOpacity={0.8}>
              {chatLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-lg font-bold text-white">↑</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
