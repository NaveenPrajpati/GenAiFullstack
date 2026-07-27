/**
 * The visible trace of a turn: which skills the supervisor engaged, and what it
 * is doing right now.
 *
 * This is the one place the multi-agent architecture surfaces in the UI — the
 * point being that the user (and anyone being shown the app) can see a single
 * message fan out to a learning coach, a task assistant, and a meal planner.
 */
import { ActivityIndicator, Text, View } from 'react-native';
import type { Skill } from '../types';

export const SKILL_META: Record<Skill, { label: string; emoji: string; chip: string; text: string }> =
  {
    learning: {
      label: 'Learning coach',
      emoji: '🎓',
      chip: 'bg-amber-50 border-amber-200',
      text: 'text-amber-700',
    },
    assistant: {
      label: 'Personal assistant',
      emoji: '🪄',
      chip: 'bg-sky-50 border-sky-200',
      text: 'text-sky-700',
    },
    meal: {
      label: 'Meal planner',
      emoji: '🥗',
      chip: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
    },
  };

export function SkillChip({ skill, small }: { skill: Skill; small?: boolean }) {
  const meta = SKILL_META[skill];
  return (
    <View
      className={`flex-row items-center gap-1 rounded-full border px-2 py-0.5 ${meta.chip}`}
      accessibilityLabel={`${meta.label} used`}>
      <Text className={small ? 'text-[10px]' : 'text-xs'}>{meta.emoji}</Text>
      <Text className={`${small ? 'text-[10px]' : 'text-xs'} font-medium ${meta.text}`}>
        {meta.label}
      </Text>
    </View>
  );
}

export default function SkillTrail({
  skills,
  step,
  streaming,
}: {
  skills?: Skill[];
  step?: string;
  streaming?: boolean;
}) {
  const hasSkills = !!skills?.length;
  if (!hasSkills && !step) return null;

  return (
    <View className="mb-1.5 flex-row flex-wrap items-center gap-1.5">
      {skills?.map((s) => <SkillChip key={s} skill={s} />)}
      {streaming && !!step && (
        <View className="flex-row items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1">
          <ActivityIndicator size="small" />
          <Text className="text-xs text-gray-500">{step}</Text>
        </View>
      )}
    </View>
  );
}
