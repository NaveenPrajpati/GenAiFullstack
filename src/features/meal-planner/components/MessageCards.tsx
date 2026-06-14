/** Rich cards rendered inside Meal Planner assistant chat bubbles. */
import Spinner from '@/components/ui/Spinner';
import { Text, TouchableOpacity, View } from 'react-native';
import { dayName, formatWeekStart, MEAL_EMOJI } from '../copy';
import type { DietConflict, MealSlot, PlanProposal, ResearchMeal } from '../types';
import PlanGrid from './PlanGrid';

/** HITL plan/update proposal: a reviewable week grid with Approve/Reject. */
export function ProposalCard({
  proposal,
  resolved,
  busy,
  onApprove,
  onReject,
}: {
  proposal: PlanProposal;
  resolved?: 'approved' | 'rejected';
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View className="rounded-xl border border-violet-200 bg-violet-50 p-4">
      <Text className="mb-1 text-xs font-semibold tracking-wide text-violet-600 uppercase">
        {proposal.type === 'update_plan' ? 'Proposed update' : 'Proposed plan'}
      </Text>
      <Text className="mb-3 text-sm font-medium text-gray-700">
        {formatWeekStart(proposal.week_start)}
      </Text>

      <PlanGrid slots={proposal.plan} />

      {resolved ? (
        <View className="mt-3 rounded-lg bg-white/70 py-2">
          <Text className="text-center text-sm font-medium text-gray-600">
            {resolved === 'approved' ? '✓ Approved & saved' : '✕ Discarded'}
          </Text>
        </View>
      ) : (
        <View className="mt-3 flex-row gap-2">
          <TouchableOpacity
            onPress={onApprove}
            disabled={busy}
            accessibilityRole="button"
            className="flex-1 items-center rounded-lg bg-violet-600 py-2.5"
            activeOpacity={0.8}>
            {busy ? (
              <Spinner size="small" color="white" />
            ) : (
              <Text className="text-sm font-semibold text-white">Approve</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onReject}
            disabled={busy}
            accessibilityRole="button"
            className="flex-1 items-center rounded-lg bg-gray-200 py-2.5"
            activeOpacity={0.8}>
            <Text className="text-sm font-medium text-gray-700">Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/** Diet-conflict resolution: original vs suggested alternative, Accept/Reject. */
export function ConflictCard({
  conflict,
  resolved,
  busy,
  onAccept,
  onReject,
}: {
  conflict: DietConflict;
  resolved?: 'accept' | 'reject';
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <View className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <Text className="mb-2 text-xs font-semibold tracking-wide text-amber-600 uppercase">
        Diet conflict
      </Text>
      <Text className="mb-3 text-sm text-gray-700">
        {dayName(conflict.day_of_week)} · {conflict.meal_type}
      </Text>

      <View className="mb-2 flex-row items-center gap-2">
        <Text className="text-sm text-gray-400 line-through" numberOfLines={1}>
          {conflict.original}
        </Text>
      </View>
      {!!conflict.suggestion && (
        <View className="flex-row items-center gap-2">
          <Text className="text-sm">↪️</Text>
          <Text className="flex-1 text-sm font-medium text-gray-800">{conflict.suggestion}</Text>
        </View>
      )}

      {resolved ? (
        <View className="mt-3 rounded-lg bg-white/70 py-2">
          <Text className="text-center text-sm font-medium text-gray-600">
            {resolved === 'accept' ? '✓ Logged the alternative' : '✕ Rejected & disliked'}
          </Text>
        </View>
      ) : (
        <View className="mt-3 flex-row gap-2">
          <TouchableOpacity
            onPress={onAccept}
            disabled={busy || !conflict.suggestion}
            accessibilityRole="button"
            className={`flex-1 items-center rounded-lg py-2.5 ${
              conflict.suggestion ? 'bg-amber-600' : 'bg-gray-300'
            }`}
            activeOpacity={0.8}>
            {busy ? (
              <Spinner size="small" color="white" />
            ) : (
              <Text className="text-sm font-semibold text-white">Accept</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onReject}
            disabled={busy}
            accessibilityRole="button"
            className="flex-1 items-center rounded-lg bg-gray-200 py-2.5"
            activeOpacity={0.8}>
            <Text className="text-sm font-medium text-gray-700">Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/** Queried slots (intent: query) shown as a compact day-grouped list. */
export function SlotsCard({ slots }: { slots: MealSlot[] }) {
  if (!slots.length) return null;
  // Group by day, ordered Mon→Sun.
  const byDay = new Map<number, MealSlot[]>();
  for (const s of slots) {
    const arr = byDay.get(s.day_of_week) ?? [];
    arr.push(s);
    byDay.set(s.day_of_week, arr);
  }
  const days = Array.from(byDay.keys()).sort((a, b) => a - b);

  return (
    <View className="rounded-xl border border-gray-200 bg-white p-4">
      <Text className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
        Planned meals
      </Text>
      {days.map((d) => (
        <View key={d} className="mb-3">
          <Text className="mb-1 text-sm font-semibold text-gray-700">{dayName(d)}</Text>
          {(byDay.get(d) ?? []).map((s, i) => (
            <View key={s.id ?? `${d}-${s.meal_type}-${i}`} className="mb-1 flex-row gap-2">
              <Text className="text-sm">{MEAL_EMOJI[s.meal_type] ?? '•'}</Text>
              <Text className="flex-1 text-sm text-gray-700">
                {s.recipe_name ?? '—'}
                {s.protein_g != null ? ` · ${s.protein_g}g` : ''}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Research suggestions: recipe + macros. Handles both ResearchMeal[] and string[]. */
export function ResearchCard({ suggestions }: { suggestions: ResearchMeal[] | string[] }) {
  if (!suggestions.length) return null;

  // Plain string suggestions → simple chips.
  if (typeof suggestions[0] === 'string') {
    return (
      <View className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <Text className="mb-2 text-xs font-semibold tracking-wide text-blue-600 uppercase">
          Suggestions
        </Text>
        {(suggestions as string[]).map((s, i) => (
          <View key={i} className="mb-1 flex-row gap-2">
            <Text className="text-sm text-blue-600">•</Text>
            <Text className="flex-1 text-sm text-gray-700">{s}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="gap-2">
      {(suggestions as ResearchMeal[]).map((meal, i) => (
        <View key={i} className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="flex-1 text-sm font-semibold text-gray-900">{meal.recipe_name}</Text>
            <Text className="text-xs text-gray-500 capitalize">{meal.meal_type}</Text>
          </View>
          {meal.prep_minutes != null && (
            <Text className="mb-2 text-xs text-gray-500">⏱ {meal.prep_minutes} min</Text>
          )}

          {meal.nutrition && (
            <View className="mb-2 flex-row flex-wrap gap-x-4 gap-y-1">
              {meal.nutrition.calories != null && (
                <Macro label="kcal" value={meal.nutrition.calories} />
              )}
              {meal.nutrition.protein_g != null && (
                <Macro label="protein" value={`${meal.nutrition.protein_g}g`} />
              )}
              {meal.nutrition.carbs_g != null && (
                <Macro label="carbs" value={`${meal.nutrition.carbs_g}g`} />
              )}
              {meal.nutrition.fat_g != null && (
                <Macro label="fat" value={`${meal.nutrition.fat_g}g`} />
              )}
            </View>
          )}

          {meal.ingredients?.length > 0 && (
            <Text className="text-xs leading-relaxed text-gray-600">
              {meal.ingredients.join(', ')}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function Macro({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-row items-baseline gap-1">
      <Text className="text-sm font-semibold text-blue-700">{value}</Text>
      <Text className="text-[10px] text-gray-500 uppercase">{label}</Text>
    </View>
  );
}
