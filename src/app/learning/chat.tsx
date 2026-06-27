import { useAuth } from '@/context/AuthContext';
import { ChatMarkdown } from '@/features/learning/components/Markdown';
import { useLearningStore } from '@/features/learning/store';
import type { ChatMessage, Proposal, RoadmapProgress } from '@/features/learning/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

function ResourcesCard({ suggestions }: { suggestions: string[] }) {
  return (
    <View className="rounded-xl border border-blue-100 bg-blue-50 p-4">
      <Text className="mb-2 text-xs font-semibold text-blue-600">Resources</Text>
      {suggestions.map((s, i) => (
        <TouchableOpacity key={i} onPress={() => Linking.openURL(s).catch(() => {})}>
          <Text className="mb-1 text-sm text-blue-700 underline" numberOfLines={2}>
            {s}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ProgressCard({ next_topic, progress }: { next_topic: string; progress: RoadmapProgress }) {
  return (
    <View className="rounded-xl border border-green-100 bg-green-50 p-4">
      <Text className="mb-1 text-xs font-semibold text-green-600">Your progress</Text>
      <Text className="mb-2 text-sm font-medium text-gray-900">Next: {next_topic}</Text>
      <View className="mb-1 h-1.5 overflow-hidden rounded-full bg-green-200">
        <View
          className="h-1.5 rounded-full bg-green-500"
          style={{ width: `${progress.percent}%` }}
        />
      </View>
      <Text className="text-xs text-gray-500">
        {progress.covered_count}/{progress.total} topics · {progress.remaining} remaining
      </Text>
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
  onApprove,
  onReject,
  approving,
}: {
  proposal: Proposal;
  onApprove: () => void;
  onReject: () => void;
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
          <View key={s} className="rounded-md bg-blue-50 px-2 py-0.5">
            <Text className="text-xs text-blue-700">{s}</Text>
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
          {p.topics.slice(0, 5).map((t, i) => (
            <Text key={i} className="mb-1 text-xs text-gray-700">
              {t.order}. {t.title}
              {t.estimated_hours ? ` · ${t.estimated_hours}h` : ''}
            </Text>
          ))}
          {p.topics.length > 5 && (
            <Text className="text-xs text-gray-400">+{p.topics.length - 5} more…</Text>
          )}
        </View>
      )}

      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={onApprove}
          disabled={approving}
          className="flex-1 items-center rounded-lg bg-green-600 py-2.5"
          activeOpacity={0.8}>
          {approving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-sm font-semibold text-white">Approve & Save</Text>
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
    </View>
  );
}

function Bubble({
  msg,
  onApprove,
  onReject,
  onStartQuiz,
  approving,
}: {
  msg: ChatMessage;
  onApprove: () => void;
  onReject: () => void;
  onStartQuiz: () => void;
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
          onApprove={onApprove}
          onReject={onReject}
          approving={approving}
        />
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

/* ─── Main screen ─── */

export default function ChatScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { prefill, roadmapId, source } = useLocalSearchParams<{
    prefill?: string;
    roadmapId?: string;
    source?: string;
  }>();
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

  const { chatMessages, chatLoading, sendChatMessage, resolveProposal, resetChat } =
    useLearningStore();

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [chatMessages.length, chatLoading]);

  const handleSend = () => {
    if (!input.trim() || chatLoading || !token) return;
    const text = input.trim();
    setInput('');
    sendChatMessage(token, text, roadmapId, useStream);
  };

  const handleApprove = async () => {
    if (!token) return;
    setApproving(true);
    setApprovalError('');
    try {
      const newId = await resolveProposal(token, 'approved');
      router.push(newId ? `/learning/${newId}` : '/learning');
    } catch (e: any) {
      setApprovalError(e?.response?.data?.detail ?? 'Failed to approve.');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!token) return;
    setApproving(true);
    try {
      await resolveProposal(token, 'rejected');
    } finally {
      setApproving(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-base font-bold text-gray-900">AI Tutor</Text>
            {!!roadmapId && <Text className="text-xs text-gray-400">Roadmap context active</Text>}
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
          contentContainerStyle={{ paddingBottom: 8 }}>
          {chatMessages.length === 0 && (
            <View className="items-center py-12">
              <Text className="mb-2 text-5xl">🤖</Text>
              <Text className="mb-1 text-base font-semibold text-gray-700">AI Learning Tutor</Text>
              <Text className="text-center text-sm leading-relaxed text-gray-400">
                {'Ask me to create a roadmap, explain a topic,\nquiz you, or find resources.'}
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
