import { CardSkeletons, EmptyState, ErrorCard } from '@/features/meal-planner/components/common';
import { useMealPlannerStore } from '@/features/meal-planner/store';
import type { GroceryItem } from '@/features/meal-planner/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

function ItemRow({
  item,
  checked,
  onToggle,
}: {
  item: GroceryItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const qty = [item.qty, item.unit].filter(Boolean).join(' ');
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="flex-row items-center gap-3 border-b border-gray-100 py-3">
      <View
        className={`h-5 w-5 items-center justify-center rounded-md border ${
          checked ? 'border-violet-600 bg-violet-600' : 'border-gray-300 bg-white'
        }`}>
        {checked && <Text className="text-xs font-bold text-white">✓</Text>}
      </View>
      <Text
        className={`flex-1 text-sm ${checked ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
        {item.name}
      </Text>
      {!!qty && <Text className="text-xs text-gray-400">{qty}</Text>}
    </TouchableOpacity>
  );
}

export default function GroceryListScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = String(id);

  const {
    groceryByPlanId,
    checkedByPlanId,
    groceryLoading,
    groceryError,
    loadGrocery,
    toggleGroceryItem,
    selectPlan,
  } = useMealPlannerStore();

  useEffect(() => {
    if (!planId) return;
    selectPlan(planId);
    loadGrocery(planId);
  }, [planId]);

  const items = groceryByPlanId[planId];
  const checked = checkedByPlanId[planId] ?? new Set<string>();
  const remaining = items ? items.filter((i) => !checked.has(i.name)).length : 0;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-sm text-violet-600">← Week view</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Grocery list</Text>
        {!!items?.length && (
          <Text className="mt-0.5 text-sm text-gray-500">
            {remaining} of {items.length} left
          </Text>
        )}
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {groceryLoading && !items && <CardSkeletons count={5} />}

        {!!groceryError && !groceryLoading && (
          <ErrorCard message={groceryError} onRetry={() => loadGrocery(planId)} />
        )}

        {!groceryLoading && !groceryError && items && items.length === 0 && (
          <EmptyState
            emoji="🛒"
            title="Nothing to buy"
            subtitle="This plan has no grocery items."
          />
        )}

        {!!items?.length && (
          <View className="rounded-xl border border-gray-200 bg-white px-4">
            {items.map((it, i) => (
              <ItemRow
                key={`${it.name}-${i}`}
                item={it}
                checked={checked.has(it.name)}
                onToggle={() => toggleGroceryItem(it.name)}
              />
            ))}
          </View>
        )}

        <Text className="mt-3 text-center text-xs text-gray-400">
          Checked items are saved on this device only.
        </Text>
      </ScrollView>
    </View>
  );
}
