import { CardSkeletons, EmptyState, ErrorCard } from '@/features/meal-planner/components/common';
import { formatWeekStart } from '@/features/meal-planner/copy';
import { useMealPlannerStore } from '@/features/meal-planner/store';
import type { Plan } from '@/features/meal-planner/types';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-700' },
  approved: { bg: 'bg-green-100', text: 'text-green-700' },
  draft: { bg: 'bg-amber-100', text: 'text-amber-700' },
  archived: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <View className={`rounded-full px-2 py-0.5 ${s.bg}`}>
      <Text className={`text-xs font-medium capitalize ${s.text}`}>{status}</Text>
    </View>
  );
}

function PlanRow({ plan, active, onOpen }: { plan: Plan; active: boolean; onOpen: () => void }) {
  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={0.7}
      accessibilityRole="button"
      className={`mb-2 flex-row items-center justify-between rounded-xl border bg-white p-4 ${
        active ? 'border-violet-400' : 'border-gray-200'
      }`}>
      <View className="flex-1 pr-2">
        <Text className="text-sm font-semibold text-gray-900">
          {formatWeekStart(plan.week_start)}
        </Text>
        <Text className="mt-0.5 text-xs text-gray-400">Starts {plan.week_start}</Text>
      </View>
      <StatusChip status={plan.status} />
      <Text className="ml-2 text-gray-300">›</Text>
    </TouchableOpacity>
  );
}

export default function PlansScreen() {
  const router = useRouter();
  const { plans, plansLoading, plansError, activePlanId, loadPlans, selectPlan, sendMessage } =
    useMealPlannerStore();

  useEffect(() => {
    loadPlans();
  }, []);

  const openPlan = (id: string) => {
    selectPlan(id);
    router.push(`/meal-planner/plan/${id}` as any);
  };

  const generateNew = () => {
    // Generating a plan is chat-driven; kick off the request and jump to chat.
    sendMessage('Plan my meals for next week');
    router.push('/meal-planner' as any);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-sm text-violet-600">← Meal Planner</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Your plans</Text>
        <Text className="mt-0.5 text-sm text-gray-500">Weekly meal plans</Text>
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={generateNew}
          className="mb-4 items-center rounded-xl bg-violet-600 py-3"
          activeOpacity={0.85}
          accessibilityRole="button">
          <Text className="text-sm font-semibold text-white">＋ Generate new plan</Text>
        </TouchableOpacity>

        {plansLoading && plans.length === 0 && <CardSkeletons count={3} />}

        {!!plansError && !plansLoading && <ErrorCard message={plansError} onRetry={loadPlans} />}

        {!plansLoading && !plansError && plans.length === 0 && (
          <EmptyState
            emoji="📋"
            title="No plans yet"
            subtitle="Generate your first weekly plan to get started."
          />
        )}

        {plans.map((p) => (
          <PlanRow
            key={p.id}
            plan={p}
            active={p.id === activePlanId}
            onOpen={() => openPlan(p.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
