/**
 * Inline human-in-the-loop cards.
 *
 * Three different agents can pause a turn — the learning tracker before saving a
 * roadmap, the personal assistant before deleting tasks, the meal planner before
 * saving a week of meals. They arrive on one endpoint with three payload shapes,
 * so `ApprovalCard` dispatches on `type` and each variant renders what that
 * decision actually affects.
 */
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type {
  DeleteTaskProposal,
  MealPlanProposal,
  MealSlot,
  Proposal,
  RoadmapProposal,
} from '../types';

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'] as const;
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Actions {
  resolved?: 'approved' | 'rejected';
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}

/** Shared footer: the two buttons, or the locked outcome once decided. */
function Decision({
  resolved,
  busy,
  onApprove,
  onReject,
  approveLabel,
  rejectLabel,
  approvedText,
  rejectedText,
  tone,
}: Actions & {
  approveLabel: string;
  rejectLabel: string;
  approvedText: string;
  rejectedText: string;
  tone: string;
}) {
  if (resolved) {
    return (
      <View className="mt-3 rounded-lg bg-white/70 py-2">
        <Text className="text-center text-sm font-medium text-gray-600">
          {resolved === 'approved' ? `✓ ${approvedText}` : `✕ ${rejectedText}`}
        </Text>
      </View>
    );
  }
  return (
    <View className="mt-3 flex-row gap-2">
      <TouchableOpacity
        onPress={onApprove}
        disabled={busy}
        accessibilityRole="button"
        className={`flex-1 items-center rounded-lg py-2.5 ${tone}`}
        activeOpacity={0.8}>
        {busy ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text className="text-sm font-semibold text-white">{approveLabel}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onReject}
        disabled={busy}
        accessibilityRole="button"
        className="flex-1 items-center rounded-lg bg-gray-200 py-2.5"
        activeOpacity={0.8}>
        <Text className="text-sm font-medium text-gray-700">{rejectLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function RoadmapCard({ proposal, ...actions }: { proposal: RoadmapProposal } & Actions) {
  const { roadmap } = proposal;
  const topics = roadmap.topics ?? [];
  return (
    <View className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <Text className="mb-1 text-xs font-semibold tracking-wide text-amber-700 uppercase">
        {proposal.type === 'update_roadmap' ? 'Update roadmap' : 'New learning roadmap'}
      </Text>
      <Text className="text-base font-semibold text-gray-900">{roadmap.title}</Text>
      {!!roadmap.summary && (
        <Text className="mt-1 text-sm leading-relaxed text-gray-600">{roadmap.summary}</Text>
      )}

      <View className="mt-2 flex-row flex-wrap gap-2">
        <Text className="text-xs text-amber-700">{topics.length} topics</Text>
        {!!roadmap.total_estimated_hours && (
          <Text className="text-xs text-amber-700">· ~{roadmap.total_estimated_hours}h total</Text>
        )}
      </View>

      {/* Long roadmaps scroll inside the card rather than pushing the buttons
          off screen. */}
      <ScrollView className="mt-3 max-h-56" nestedScrollEnabled>
        {topics.map((t, i) => (
          <View key={t.id ?? i} className="mb-2 flex-row gap-2">
            <Text className="text-xs font-semibold text-amber-600">{i + 1}.</Text>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-800">{t.title}</Text>
              {!!t.estimated_hours && (
                <Text className="text-[11px] text-gray-400">~{t.estimated_hours}h</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <Decision
        {...actions}
        approveLabel="Save roadmap"
        rejectLabel="Discard"
        approvedText="Saved — steps added to your tasks"
        rejectedText="Discarded"
        tone="bg-amber-600"
      />
    </View>
  );
}

function DeleteTasksCard({ proposal, ...actions }: { proposal: DeleteTaskProposal } & Actions) {
  return (
    <View className="rounded-xl border border-red-200 bg-red-50 p-4">
      <Text className="mb-2 text-xs font-semibold tracking-wide text-red-600 uppercase">
        Confirm deletion
      </Text>
      {(proposal.tasks ?? []).map((t) => (
        <View key={t.id} className="mb-1 flex-row gap-2">
          <Text className="text-sm text-red-500">🗑</Text>
          <Text className="flex-1 text-sm text-gray-800">{t.title}</Text>
        </View>
      ))}
      <Decision
        {...actions}
        approveLabel="Delete"
        rejectLabel="Keep"
        approvedText="Deleted"
        rejectedText="Kept"
        tone="bg-red-600"
      />
    </View>
  );
}

function MealPlanCard({ proposal, ...actions }: { proposal: MealPlanProposal } & Actions) {
  const slots = proposal.plan ?? [];
  // Group by day so the week reads as a week, not a flat list of 21 rows.
  const byDay = new Map<number, MealSlot[]>();
  for (const slot of slots) {
    const day = slot.day_of_week ?? 0;
    byDay.set(day, [...(byDay.get(day) ?? []), slot]);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <View className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <Text className="mb-1 text-xs font-semibold tracking-wide text-emerald-700 uppercase">
        Weekly meal plan
      </Text>
      <Text className="mb-2 text-xs text-gray-500">
        Week of {proposal.week_start} · {slots.length} meals
      </Text>

      <ScrollView className="max-h-64" nestedScrollEnabled>
        {days.map((day) => {
          const meals = byDay.get(day) ?? [];
          const ordered = [...meals].sort(
            (a, b) =>
              MEAL_ORDER.indexOf(a.meal_type as any) - MEAL_ORDER.indexOf(b.meal_type as any)
          );
          return (
            <View key={day} className="mb-2.5">
              <Text className="mb-1 text-xs font-semibold text-emerald-800">
                {DAY_SHORT[day] ?? `Day ${day}`}
              </Text>
              {ordered.map((slot, i) => (
                <View key={i} className="mb-0.5 flex-row items-center gap-2">
                  <Text className="w-16 text-[11px] text-gray-400 capitalize">
                    {slot.meal_type}
                  </Text>
                  <Text className="flex-1 text-sm text-gray-800" numberOfLines={1}>
                    {slot.recipe_name}
                  </Text>
                  {slot.protein_g != null && (
                    <Text className="text-[11px] text-emerald-600">{slot.protein_g}g</Text>
                  )}
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      <Decision
        {...actions}
        approveLabel="Save plan"
        rejectLabel="Discard"
        approvedText="Saved to your week"
        rejectedText="Discarded"
        tone="bg-emerald-600"
      />
    </View>
  );
}

export default function ApprovalCard({
  proposal,
  ...actions
}: { proposal: Proposal } & Actions) {
  switch (proposal.type) {
    case 'pa_delete_task':
      return <DeleteTasksCard proposal={proposal} {...actions} />;
    case 'supervisor_save_meal_plan':
      return <MealPlanCard proposal={proposal} {...actions} />;
    case 'save_roadmap':
    case 'update_roadmap':
      return <RoadmapCard proposal={proposal} {...actions} />;
    default:
      return null;
  }
}
