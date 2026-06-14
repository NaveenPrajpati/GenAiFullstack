import Spinner from '@/components/ui/Spinner';
import { ErrorCard } from '@/features/meal-planner/components/common';
import { formatWeekStart } from '@/features/meal-planner/copy';
import { useMealPlannerStore } from '@/features/meal-planner/store';
import type { PendingApproval } from '@/features/meal-planner/types';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

function approvalTitle(a: PendingApproval): string {
  if (a.week_start) return `Plan for ${formatWeekStart(a.week_start)}`;
  if (a.action_type) return a.action_type.replace(/_/g, ' ');
  if (a.type) return a.type.replace(/_/g, ' ');
  return 'Pending approval';
}

export default function PreferencesScreen() {
  const router = useRouter();
  const {
    dislikedDishes,
    dislikedLoading,
    dislikedError,
    loadDisliked,
    addDisliked,
    removeDisliked,
    autoPlanEnabled,
    autoPlanToggling,
    toggleAutoPlan,
    approvals,
    approvalsLoading,
    loadApprovals,
  } = useMealPlannerStore();

  const [dish, setDish] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadDisliked();
    loadApprovals();
  }, []);

  const handleAdd = async () => {
    const t = dish.trim();
    if (!t) return;
    setDish('');
    setError('');
    try {
      await addDisliked(t);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to add dish.');
    }
  };

  const handleRemove = async (d: string) => {
    setError('');
    try {
      await removeDisliked(d);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to remove dish.');
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-sm text-violet-600">← Meal Planner</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Preferences</Text>
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Disliked dishes */}
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <Text className="text-sm font-semibold text-gray-900">Disliked dishes</Text>
          <Text className="mt-0.5 mb-3 text-xs leading-relaxed text-gray-500">
            The planner avoids these when generating meals.
          </Text>

          <View className="mb-3 flex-row gap-2">
            <TextInput
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800"
              placeholder="e.g. mushrooms"
              placeholderTextColor="#9ca3af"
              value={dish}
              onChangeText={setDish}
              onSubmitEditing={handleAdd}
              accessibilityLabel="Disliked dish"
            />
            <TouchableOpacity
              onPress={handleAdd}
              disabled={!dish.trim()}
              className={`items-center justify-center rounded-xl px-4 ${
                dish.trim() ? 'bg-violet-600' : 'bg-gray-300'
              }`}
              activeOpacity={0.8}
              accessibilityRole="button">
              <Text className="text-sm font-semibold text-white">Add</Text>
            </TouchableOpacity>
          </View>

          {!!error && <Text className="mb-2 text-sm text-red-700">{error}</Text>}

          {dislikedLoading && dislikedDishes.length === 0 ? (
            <Spinner size="small" />
          ) : !!dislikedError && dislikedDishes.length === 0 ? (
            <ErrorCard message={dislikedError} onRetry={loadDisliked} />
          ) : dislikedDishes.length === 0 ? (
            <Text className="text-sm text-gray-400">No disliked dishes yet.</Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {dislikedDishes.map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => handleRemove(d)}
                  className="flex-row items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5"
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${d}`}>
                  <Text className="text-xs text-gray-700">{d}</Text>
                  <Text className="text-xs text-gray-400">✕</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Weekly auto-plan */}
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-sm font-semibold text-gray-900">Weekly auto-plan</Text>
              <Text className="mt-0.5 text-xs leading-relaxed text-gray-500">
                Get a fresh plan proposal every Sunday at 6:30pm.
              </Text>
            </View>
            {autoPlanToggling ? (
              <Spinner size="small" />
            ) : (
              <Switch
                value={autoPlanEnabled}
                onValueChange={toggleAutoPlan}
                trackColor={{ true: '#7c3aed', false: '#e5e7eb' }}
                thumbColor="#ffffff"
                accessibilityLabel="Toggle weekly auto-plan"
              />
            )}
          </View>
        </View>

        {/* Pending approvals inbox */}
        <View className="rounded-xl border border-gray-200 bg-white p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-gray-900">Pending approvals</Text>
            <TouchableOpacity onPress={loadApprovals}>
              <Text className="text-xs font-medium text-violet-600">Refresh</Text>
            </TouchableOpacity>
          </View>

          {approvalsLoading && approvals.length === 0 && (
            <View className="items-center py-6">
              <Spinner />
            </View>
          )}

          {!approvalsLoading && approvals.length === 0 && (
            <Text className="py-4 text-center text-sm text-gray-400">No pending approvals.</Text>
          )}

          {approvals.map((a, i) => (
            <View
              key={a.id ?? a.thread_id ?? i}
              className="mb-2 flex-row items-center justify-between border-b border-gray-100 pb-2">
              <View className="flex-1 pr-2">
                <Text className="text-sm text-gray-800 capitalize">{approvalTitle(a)}</Text>
                {!!a.created_at && (
                  <Text className="text-xs text-gray-400">
                    {new Date(a.created_at).toLocaleString()}
                  </Text>
                )}
              </View>
              {!!a.status && (
                <View className="rounded-full bg-gray-100 px-2 py-0.5">
                  <Text className="text-xs text-gray-600 capitalize">{a.status}</Text>
                </View>
              )}
            </View>
          ))}

          <Text className="mt-2 text-xs leading-relaxed text-gray-400">
            Plan approvals are confirmed inline in chat. This inbox lists any that are still
            waiting.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
