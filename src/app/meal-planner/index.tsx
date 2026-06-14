import Spinner from '@/components/ui/Spinner';
import {
  ConflictCard,
  ProposalCard,
  ResearchCard,
  SlotsCard,
} from '@/features/meal-planner/components/MessageCards';
import { useMealPlannerStore } from '@/features/meal-planner/store';
import type { ChatMessage } from '@/features/meal-planner/types';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
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
  'Plan my meals for next week',
  'Add paneer bhurji to Tuesday dinner',
  "What's planned for this week?",
  'Suggest some high-protein vegetarian dinners',
];

const NAV: { label: string; href: string }[] = [
  { label: 'Plans', href: '/meal-planner/plans' },
  { label: 'Preferences', href: '/meal-planner/preferences' },
];

function Bubble({
  msg,
  busy,
  onApprove,
  onReject,
  onAccept,
  onRejectConflict,
}: {
  msg: ChatMessage;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onAccept: () => void;
  onRejectConflict: () => void;
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
  const isProposalResolved = msg.resolved === 'approved' || msg.resolved === 'rejected';
  const isConflictResolved = msg.resolved === 'accept' || msg.resolved === 'reject';

  return (
    <View className="mb-3 w-full items-start">
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

      <View className="w-full max-w-2xl gap-2">
        {/* HITL plan/update proposal. */}
        {msg.proposal && (
          <ProposalCard
            proposal={msg.proposal}
            resolved={isProposalResolved ? (msg.resolved as 'approved' | 'rejected') : undefined}
            busy={busy}
            onApprove={onApprove}
            onReject={onReject}
          />
        )}

        {/* Diet conflict. */}
        {msg.conflict && (
          <ConflictCard
            conflict={msg.conflict}
            resolved={isConflictResolved ? (msg.resolved as 'accept' | 'reject') : undefined}
            busy={busy}
            onAccept={onAccept}
            onReject={onRejectConflict}
          />
        )}

        {/* Queried slots. */}
        {!!r?.meal_slots?.length && r.intent === 'query' && <SlotsCard slots={r.meal_slots} />}

        {/* Research suggestions. */}
        {!!r?.suggestions?.length && <ResearchCard suggestions={r.suggestions} />}
      </View>
    </View>
  );
}

export default function MealPlannerChatScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState('');

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width <= 500;
  const headerHeight = Platform.OS === 'ios' && isMobile ? insets.top + 44 : 0;

  const {
    messages,
    chatLoading,
    pendingApproval,
    pendingConflict,
    activePlanId,
    plans,
    sendMessage,
    resolveApproval,
    resolveConflict,
    newConversation,
    loadPlans,
  } = useMealPlannerStore();

  useEffect(() => {
    loadPlans();
  }, []);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || chatLoading) return;
    setInput('');
    sendMessage(t);
  };

  const activePlan = plans.find((p) => p.id === activePlanId);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-xl font-bold text-gray-900">Meal Planner</Text>
            <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={1}>
              {activePlan
                ? `Active: week of ${activePlan.week_start} · ${activePlan.status}`
                : 'Your AI agent for weekly meal plans'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={newConversation}
            className="rounded-lg bg-gray-100 px-3 py-1.5"
            activeOpacity={0.7}
            accessibilityRole="button">
            <Text className="text-xs text-gray-600">New chat</Text>
          </TouchableOpacity>
        </View>

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
          {!!activePlanId && (
            <TouchableOpacity
              onPress={() => router.push(`/meal-planner/plan/${activePlanId}` as any)}
              className="rounded-lg bg-violet-100 px-3 py-1.5"
              activeOpacity={0.7}
              accessibilityRole="button">
              <Text className="text-xs font-medium text-violet-700">View week</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
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
            maxWidth: 860,
            width: '100%',
            alignSelf: 'center',
          }}>
          {messages.length === 0 && (
            <View className="py-10">
              <View className="mb-6 items-center">
                <Text className="mb-2 text-5xl">🍽️</Text>
                <Text className="mb-1 text-base font-semibold text-gray-700">
                  What should we cook this week?
                </Text>
                <Text className="text-center text-sm leading-relaxed text-gray-400">
                  Generate a weekly plan, log a dish,{'\n'}check what’s planned, or research meals.
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
              busy={chatLoading && (!!pendingApproval || !!pendingConflict)}
              onApprove={() => resolveApproval('approved')}
              onReject={() => resolveApproval('rejected')}
              onAccept={() => resolveConflict('accept')}
              onRejectConflict={() => resolveConflict('reject')}
            />
          ))}

          {chatLoading && !pendingApproval && !pendingConflict && (
            <View className="mb-3 items-start">
              <View className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3">
                <Spinner size="small" />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
        <View className="border-t border-gray-200 bg-white px-4 py-3">
          <View className="mx-auto w-full flex-row items-end gap-3" style={{ maxWidth: 860 }}>
            <TextInput
              className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800"
              style={{ maxHeight: 120 }}
              placeholder="Plan a week, log a dish, or ask…"
              placeholderTextColor="#9ca3af"
              multiline
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send(input)}
              accessibilityLabel="Message the meal planner"
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
                <Spinner size="small" color="white" />
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
