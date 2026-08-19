/**
 * Makes the learner profile visible on the thing it shaped: the pace it implies,
 * what it actually contributed, and whether it has moved on since.
 */
import { Button } from '@/components/ui/Button';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import type { RoadmapInsights } from '../types';

const FIELD_LABELS: Record<string, string> = {
  skill_level: 'Level',
  goals: 'Goals',
  preferred_resource_types: 'Resources',
  preferred_explanation_style: 'Explanation style',
  preferred_quiz_difficulty: 'Quiz difficulty',
  availability: 'Time',
  known_topics: 'Already known',
};

/** Renders one personalization input as "Level: beginner". */
function describeField(key: string, value: any): string | null {
  if (value == null || (Array.isArray(value) && value.length === 0)) return null;
  const label = FIELD_LABELS[key] ?? key;
  if (key === 'availability') {
    const mins = value?.minutes_per_day;
    if (!mins) return null;
    const days = value?.days_per_week;
    return `${label}: ${mins} min/day${days && days < 7 ? `, ${days} days/wk` : ''}`;
  }
  return `${label}: ${Array.isArray(value) ? value.join(', ') : value}`;
}

export function PersonalizationPanel({
  insights,
  onRetune,
}: {
  insights: RoadmapInsights;
  onRetune: (prompt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { forecast, personalization, profile_changes, current_personalization } = insights;
  const applied = Object.entries(personalization ?? {})
    .map(([k, v]) => describeField(k, v))
    .filter(Boolean) as string[];

  const targetDate = forecast
    ? new Date(forecast.target_date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;
  const weeks = forecast ? Math.max(Math.round(forecast.calendar_days / 7), 0) : 0;

  const retunePrompt = () => {
    const now = Object.entries(current_personalization)
      .map(([k, v]) => describeField(k, v))
      .filter(Boolean)
      .join('; ');
    return `Update this roadmap for my current profile — ${now}. Keep the topics I've already completed.`;
  };

  if (!forecast && applied.length === 0 && profile_changes.length === 0) return null;

  return (
    <View className="border-line mt-3 border-t pt-3">
      {!!forecast && (
        <Text className="text-ink-soft text-[13px]">
          At {forecast.minutes_per_day} min/day ·{' '}
          <Text className="text-ink font-semibold">
            {forecast.calendar_days <= 10 ? `${forecast.calendar_days} days` : `~${weeks} weeks`}
          </Text>{' '}
          · done by {targetDate}
        </Text>
      )}
      {forecast?.on_track === false && (
        <Text className="text-warning mt-0.5 text-[13px]">
          That&apos;s past your target date — more time per day, or a shorter roadmap, would close
          the gap.
        </Text>
      )}

      {applied.length > 0 && (
        <TouchableOpacity onPress={() => setOpen((o) => !o)} activeOpacity={0.7} className="mt-2">
          <Text className="text-primary text-[13px] font-semibold">
            ✨ Personalized for you {open ? '▴' : '▾'}
          </Text>
        </TouchableOpacity>
      )}
      {open && (
        <View className="bg-surface-alt mt-2 rounded-xl p-3">
          {applied.map((line) => (
            <Text key={line} className="text-ink-soft text-[13px]">
              • {line}
            </Text>
          ))}
        </View>
      )}

      {profile_changes.length > 0 && (
        <View className="border-warning bg-warning-soft mt-3 rounded-xl border p-3">
          <Text className="text-ink-soft mb-2 text-[13px]">
            Your profile changed since this was built (
            {profile_changes.map((f) => (FIELD_LABELS[f] ?? f).toLowerCase()).join(', ')}).
          </Text>
          <Button label="Update this roadmap" size="sm" onPress={() => onRetune(retunePrompt())} />
        </View>
      )}
    </View>
  );
}
