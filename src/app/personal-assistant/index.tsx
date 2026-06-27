import ScreenHeader from '@/components/layout/ScreenHeader';
import {
  AgendaCard,
  ApprovalCard,
  NotesCard,
  ResearchCard,
  SuggestionsCard,
  TaskListCard,
} from '@/features/personal-assistant/components/MessageCards';
import { usePersonalAssistantStore } from '@/features/personal-assistant/store';
import type { ChatMessage } from '@/features/personal-assistant/types';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STARTERS = [
  'Remind me to call mom tomorrow, high priority',
  "What's overdue?",
  'Break down "launch my side project"',
  'Remember that my anniversary is March 3rd',
  'Research the best note-taking apps',
];

const NAV: { label: string; href: string }[] = [
  { label: 'Tasks', href: '/personal-assistant/tasks' },
  { label: 'Agenda', href: '/personal-assistant/agenda' },
  { label: 'Notes', href: '/personal-assistant/notes' },
  { label: 'Settings', href: '/personal-assistant/settings' },
];

function Bubble({
  msg,
  busy,
  onApprove,
  onReject,
  onPickSuggestion,
}: {
  msg: ChatMessage;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onPickSuggestion: (s: string) => void;
}) {
  if (msg.role === 'user') {
    return (
      <View className="mb-3 items-end">
        <View className="max-w-[85%] rounded-2xl rounded-tr-sm bg-violet-600 px-4 py-2.5">
          <Text className="text-sm text-white">{msg.text}</Text>
        </View>
      </View>
    );
  }

  const r = msg.result;

  return (
    <View className="mb-3 w-full items-start">
      {/* Natural-language reply — always shown. */}
      {!!msg.text && (
        <View
          className={`mb-2 max-w-[90%] rounded-2xl rounded-tl-sm px-4 py-2.5 ${
            msg.isError ? 'bg-red-50' : 'bg-gray-100'
          }`}>
          <Text className={`text-sm ${msg.isError ? 'text-red-700' : 'text-gray-800'}`}>
            {msg.text}
          </Text>
        </View>
      )}

      {/* HITL approval card. */}
      {msg.approval && (
        <View className="mb-2 w-full max-w-md">
          <ApprovalCard
            proposal={msg.approval}
            resolved={msg.resolved}
            busy={busy}
            onApprove={onApprove}
            onReject={onReject}
          />
        </View>
      )}

      {/* Rich cards. */}
      {r && (
        <View className="w-full max-w-md gap-2">
          {!!r.research && <ResearchCard research={r.research} />}
          {!!r.agenda && <AgendaCard agenda={r.agenda} />}
          {!!r.todos?.length && <TaskListCard title="Tasks" tasks={r.todos} />}
          {!!r.subtasks?.length && <TaskListCard title="Subtasks" tasks={r.subtasks} />}
          {!!r.notes?.length && <NotesCard notes={r.notes} />}
          {!!r.suggestions?.length && (
            <SuggestionsCard suggestions={r.suggestions} onPick={onPickSuggestion} />
          )}
        </View>
      )}
    </View>
  );
}

export default function AssistantChatScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState('');

  // The drawer renders a native header on mobile (see app/_layout). Offset the
  // KeyboardAvoidingView by that header's height so the input bar isn't covered.
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width <= 500;
  const headerHeight = Platform.OS === 'ios' && isMobile ? insets.top + 44 : 0;

  const { messages, chatLoading, pendingApproval, sendMessage, resolveApproval, newConversation } =
    usePersonalAssistantStore();

  const send = (text: string) => {
    const t = text.trim();
    if (!t || chatLoading) return;
    setInput('');
    sendMessage(t);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <ScreenHeader
        title="Personal Assistant"
        subtitle="Your AI agent for tasks & more"
        right={
          <TouchableOpacity
            onPress={newConversation}
            className="rounded-lg bg-gray-100 px-3 py-1.5"
            activeOpacity={0.7}
            accessibilityRole="button">
            <Text className="text-xs text-gray-600">New chat</Text>
          </TouchableOpacity>
        }>
        {/* Section nav */}
        <View className="mt-3 flex-row flex-wrap gap-2">
          {NAV.map((n) => (
            <TouchableOpacity
              key={n.href}
              onPress={() => router.push(n.href as any)}
              className="rounded-lg bg-gray-100 px-3 py-1.5"
              activeOpacity={0.7}
              accessibilityRole="button">
              <Text className="text-xs font-medium text-gray-700">{n.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScreenHeader>

      <KeyboardAvoidingView
        // Android resizes the window automatically (adjustResize), so only iOS
        // needs explicit avoidance — adding it on Android double-counts the gap.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
        style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4 pt-4"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{
            paddingBottom: 12,
            maxWidth: 768,
            width: '100%',
            alignSelf: 'center',
          }}>
          {messages.length === 0 && (
            <View className="py-10">
              <View className="mb-6 items-center">
                <Text className="mb-2 text-5xl">🪄</Text>
                <Text className="mb-1 text-base font-semibold text-gray-700">
                  How can I help today?
                </Text>
                <Text className="text-center text-sm leading-relaxed text-gray-400">
                  Add tasks, plan your day, break down goals,{'\n'}remember facts, or research a
                  topic.
                </Text>
              </View>
              <View className="gap-2">
                {STARTERS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => send(s)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3"
                    activeOpacity={0.7}>
                    <Text className="text-sm text-gray-700">{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {messages.map((m) => (
            <Bubble
              key={m.id}
              msg={m}
              busy={chatLoading && !!pendingApproval}
              onApprove={() => resolveApproval('approved')}
              onReject={() => resolveApproval('rejected')}
              onPickSuggestion={send}
            />
          ))}

          {chatLoading && !pendingApproval && (
            <View className="mb-3 items-start">
              <View className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3">
                <ActivityIndicator size="small" />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
        <View className="border-t border-gray-200 bg-white px-4 py-3">
          <View className="mx-auto w-full flex-row items-end gap-3" style={{ maxWidth: 768 }}>
            <TextInput
              className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800"
              style={{ maxHeight: 120 }}
              placeholder="Message your assistant…"
              placeholderTextColor="#9ca3af"
              multiline
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send(input)}
              accessibilityLabel="Message your assistant"
            />
            <TouchableOpacity
              onPress={() => send(input)}
              disabled={!input.trim() || chatLoading}
              accessibilityRole="button"
              accessibilityLabel="Send message"
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
