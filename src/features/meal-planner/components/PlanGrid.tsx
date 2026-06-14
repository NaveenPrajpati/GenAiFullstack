/**
 * Responsive 7-day × breakfast/lunch/dinner plan grid.
 *
 * - Wide (web / tablet): full 7×3 table, days as rows, meals as columns.
 * - Narrow (phone): a segmented Mon→Sun selector with the chosen day's 3 meals.
 *
 * `day_of_week` is 0–6 with Monday=0, so we iterate days in that order.
 */
import { useState } from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { dayName, dayShort, MEAL_EMOJI, MEAL_TYPES } from '../copy';
import type { MealSlot, MealType } from '../types';

const DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Build a quick (day,meal) → slot lookup. */
function indexSlots(slots: MealSlot[]): Record<string, MealSlot> {
  const map: Record<string, MealSlot> = {};
  for (const s of slots) map[`${s.day_of_week}-${s.meal_type}`] = s;
  return map;
}

function SlotBody({ slot }: { slot?: MealSlot }) {
  if (!slot?.recipe_name) {
    return <Text className="text-xs text-gray-300">—</Text>;
  }
  return (
    <View>
      <Text className="text-xs font-medium text-gray-800" numberOfLines={2}>
        {slot.recipe_name}
      </Text>
      {slot.protein_g != null && (
        <Text className="mt-0.5 text-[10px] text-violet-600">{slot.protein_g}g protein</Text>
      )}
    </View>
  );
}

function FullGrid({ index }: { index: Record<string, MealSlot> }) {
  return (
    <View className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Header row */}
      <View className="flex-row border-b border-gray-200 bg-gray-50">
        <View className="w-24 px-3 py-2" />
        {MEAL_TYPES.map((m) => (
          <View key={m} className="flex-1 px-3 py-2">
            <Text className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              {MEAL_EMOJI[m]} {m}
            </Text>
          </View>
        ))}
      </View>
      {DAYS.map((d, i) => (
        <View
          key={d}
          className={`flex-row ${i < DAYS.length - 1 ? 'border-b border-gray-100' : ''}`}>
          <View className="w-24 justify-center px-3 py-3">
            <Text className="text-sm font-semibold text-gray-700">{dayName(d)}</Text>
          </View>
          {MEAL_TYPES.map((m) => (
            <View key={m} className="flex-1 border-l border-gray-100 px-3 py-3">
              <SlotBody slot={index[`${d}-${m}`]} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function DayView({ index }: { index: Record<string, MealSlot> }) {
  // Default to today if it falls inside the week, else Monday.
  const todayIdx = (new Date().getDay() + 6) % 7; // JS Sun=0 → Mon=0 scheme
  const [day, setDay] = useState<number>(todayIdx);

  return (
    <View>
      {/* Day selector */}
      <View className="mb-3 flex-row flex-wrap gap-1.5">
        {DAYS.map((d) => {
          const active = d === day;
          return (
            <TouchableOpacity
              key={d}
              onPress={() => setDay(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`min-w-11 items-center rounded-lg px-2.5 py-2 ${
                active ? 'bg-violet-600' : 'bg-gray-100'
              }`}
              activeOpacity={0.7}>
              <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-600'}`}>
                {dayShort(d)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text className="mb-2 text-sm font-semibold text-gray-700">{dayName(day)}</Text>
      <View className="gap-2">
        {MEAL_TYPES.map((m) => (
          <MealCard key={m} mealType={m} slot={index[`${day}-${m}`]} />
        ))}
      </View>
    </View>
  );
}

function MealCard({ mealType, slot }: { mealType: MealType; slot?: MealSlot }) {
  return (
    <View className="rounded-xl border border-gray-200 bg-white p-3">
      <Text className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
        {MEAL_EMOJI[mealType]} {mealType}
      </Text>
      <SlotBody slot={slot} />
    </View>
  );
}

export default function PlanGrid({ slots }: { slots: MealSlot[] }) {
  const { width } = useWindowDimensions();
  const index = indexSlots(slots);
  // ~720px is enough horizontal room for a readable 4-column table.
  return width >= 720 ? <FullGrid index={index} /> : <DayView index={index} />;
}
