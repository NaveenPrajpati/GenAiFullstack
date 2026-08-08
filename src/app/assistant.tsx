/**
 * The unified assistant: one conversation over all three agents.
 *
 * A message here is routed by the supervisor to whichever skills can serve it,
 * so the same chat can build a study roadmap, add tasks, and plan a week of
 * meals — including turns that use two skills at once. Replies stream in token
 * by token, and any skill can pause the turn for approval without the user
 * leaving the thread.
 */
import ScreenHeader from '@/components/ui/ScreenHeader';
import ApprovalCard from '@/features/assistant/components/ApprovalCards';
import ResultCards from '@/features/assistant/components/ResultCards';
import SkillTrail, { SKILL_META } from '@/features/assistant/components/SkillTrail';
import { useAssistantStore } from '@/features/assistant/store';
import type { ChatMessage, Skill } from '@/features/assistant/types';
import { useEffect, useRef, useState } from 'react';
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

/** Starters chosen to show the range — including one that needs two skills. */
const STARTERS: { text: string; skills: Skill[] }[] = [
  { text: 'I want to learn Rust — build me a study roadmap', skills: ['learning'] },
  { text: "What's on my agenda today?", skills: ['assistant'] },
  { text: 'Plan a high-protein vegetarian week of meals', skills: ['meal'] },
  {
    text: 'Plan my meals for next week and add the shopping to my tasks',
    skills: ['meal', 'assistant'],
  },
];

function Bubble({
  msg,
  busy,
  onApprove,
  onReject,
}: {
  msg: ChatMessage;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (msg.role === 'user') {
    return (
      <View className="mb-4 items-end">
        <View className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5">
          <Text className="text-sm text-white">{msg.text}</Text>
        </View>
      </View>
    );
  }

  // An empty streaming bubble would be a blank box — show the trail alone until
  // the first token lands.
  const showBubble = !!msg.text || !msg.streaming;

  return (
    <View className="mb-4 w-full items-start">
      <SkillTrail skills={msg.skills} step={msg.step} streaming={msg.streaming} />

      {showBubble && (
        <View
          className={`mb-2 max-w-[92%] rounded-2xl rounded-tl-sm px-4 py-2.5 ${
            msg.isError ? 'bg-red-50' : 'bg-gray-100'
          }`}>
          <Text
            className={`text-sm leading-relaxed ${msg.isError ? 'text-red-700' : 'text-gray-800'}`}>
            {msg.text}
            {/* Caret while tokens are still arriving. */}
            {msg.streaming && !!msg.text && <Text className="text-gray-400">▌</Text>}
          </Text>
        </View>
      )}

      {!!msg.approval && (
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

      <ResultCards results={msg.result?.results} />
    </View>
  );
}

export default function UnifiedAssistantScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState('');

  // The drawer renders a native header on mobile (see app/_layout). Offset the
  // KeyboardAvoidingView by that header's height so the input bar isn't covered.
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width <= 500;
  const headerHeight = Platform.OS === 'ios' && isMobile ? insets.top + 44 : 0;

  const {
    messages,
    chatLoading,
    pendingApproval,
    skills,
    sendMessage,
    resolveApproval,
    newConversation,
    loadSkills,
  } = useAssistantStore();

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || chatLoading) return;
    setInput('');
    sendMessage(t);
  };

  const mealDown = skills?.meal && !skills.meal.available;

  return (
    <View className="bg-bg flex-1">
      <ScreenHeader
        title="Assistant"
        subtitle="One chat · three skills"
        right={
          <TouchableOpacity
            onPress={newConversation}
            className="rounded-lg bg-gray-100 px-3 py-1.5"
            activeOpacity={0.7}
            accessibilityRole="button">
            <Text className="text-xs text-gray-600">New chat</Text>
          </TouchableOpacity>
        }>
        <View className="mt-3 flex-row flex-wrap items-center gap-2">
          {(Object.keys(SKILL_META) as Skill[]).map((s) => {
            const meta = SKILL_META[s];
            const down = skills?.[s] && !skills[s].available;
            return (
              <View
                key={s}
                className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1 ${
                  down ? 'border-gray-200 bg-gray-50' : meta.chip
                }`}>
                <Text className="text-xs">{meta.emoji}</Text>
                <Text className={`text-xs font-medium ${down ? 'text-gray-400' : meta.text}`}>
                  {meta.label}
                </Text>
              </View>
            );
          })}
        </View>
        {mealDown && (
          <Text className="mt-2 text-xs text-amber-600">
            The meal planner is unreachable right now — the other skills still work.
          </Text>
        )}
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
                <Text className="mb-2 text-5xl">✨</Text>
                <Text className="mb-1 text-base font-semibold text-gray-700">Ask me anything</Text>
                <Text className="text-center text-sm leading-relaxed text-gray-400">
                  {
                    "I'll bring in whichever skill fits — studying, your\ntasks, or your meals. Some questions use more than one."
                  }
                </Text>
              </View>
              <View className="gap-2">
                {STARTERS.map((s) => (
                  <TouchableOpacity
                    key={s.text}
                    onPress={() => send(s.text)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3"
                    activeOpacity={0.7}>
                    <Text className="text-sm text-gray-700">{s.text}</Text>
                    <View className="mt-2 flex-row flex-wrap gap-1.5">
                      {s.skills.map((skill) => {
                        const meta = SKILL_META[skill];
                        return (
                          <View
                            key={skill}
                            className={`flex-row items-center gap-1 rounded-full border px-2 py-0.5 ${meta.chip}`}>
                            <Text className="text-[10px]">{meta.emoji}</Text>
                            <Text className={`text-[10px] font-medium ${meta.text}`}>
                              {meta.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
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
            />
          ))}
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
                !input.trim() || chatLoading ? 'bg-gray-200' : 'bg-indigo-600'
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
