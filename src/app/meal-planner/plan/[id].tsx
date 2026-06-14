import { CardSkeletons, EmptyState, ErrorCard } from '@/features/meal-planner/components/common';
import PlanGrid from '@/features/meal-planner/components/PlanGrid';
import { formatWeekStart } from '@/features/meal-planner/copy';
import { useMealPlannerStore } from '@/features/meal-planner/store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function WeekViewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = String(id);

  const { plans, slotsByPlanId, slotsLoading, slotsError, loadSlots, selectPlan, sendMessage } =
    useMealPlannerStore();

  useEffect(() => {
    if (!planId) return;
    selectPlan(planId);
    loadSlots(planId);
  }, [planId]);

  const plan = plans.find((p) => p.id === planId);
  const slots = slotsByPlanId[planId];

  const updatePlan = () => {
    selectPlan(planId);
    // Update requires the plan_id, which the store forwards from activePlanId.
    sendMessage('Update this plan');
    router.push('/meal-planner' as any);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-sm text-violet-600">← Plans</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">
          {plan ? formatWeekStart(plan.week_start) : 'Week view'}
        </Text>
        {!!plan && (
          <Text className="mt-0.5 text-sm text-gray-500 capitalize">Status: {plan.status}</Text>
        )}

        <View className="mt-3 flex-row gap-2">
          <TouchableOpacity
            onPress={updatePlan}
            className="rounded-lg bg-violet-600 px-3 py-1.5"
            activeOpacity={0.8}
            accessibilityRole="button">
            <Text className="text-xs font-semibold text-white">Update plan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(`/meal-planner/grocery/${planId}` as any)}
            className="rounded-lg bg-gray-100 px-3 py-1.5"
            activeOpacity={0.8}
            accessibilityRole="button">
            <Text className="text-xs font-medium text-gray-700">🛒 Grocery list</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {slotsLoading && !slots && <CardSkeletons count={4} />}

        {!!slotsError && !slotsLoading && (
          <ErrorCard message={slotsError} onRetry={() => loadSlots(planId)} />
        )}

        {!slotsLoading && !slotsError && slots && slots.length === 0 && (
          <EmptyState
            emoji="🍽️"
            title="No meals yet"
            subtitle="Use “Update plan” to fill this week's slots."
          />
        )}

        {!!slots?.length && <PlanGrid slots={slots} />}
      </ScrollView>
    </View>
  );
}
