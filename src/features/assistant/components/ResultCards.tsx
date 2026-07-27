/**
 * Per-skill result cards shown under a reply.
 *
 * The reply text already says what happened in prose, so these stay deliberately
 * thin: only the things worth *acting on* (open the roadmap, see the plan, follow
 * a source) or worth trusting at a glance (counts, progress). Anything the
 * sentence already covers is not repeated as a card.
 */
import { useRouter } from 'expo-router';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import type { AssistantSummary, LearningSummary, MealSummary, SkillResults } from '../types';

function CardShell({
  title,
  tint,
  border,
  children,
}: {
  title: string;
  tint: string;
  border: string;
  children: React.ReactNode;
}) {
  return (
    <View className={`rounded-xl border ${border} bg-white p-4`}>
      <Text className={`mb-2 text-xs font-semibold tracking-wide uppercase ${tint}`}>{title}</Text>
      {children}
    </View>
  );
}

function LinkButton({ label, onPress, tone }: { label: string; onPress: () => void; tone: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      className={`mt-3 self-start rounded-lg px-3 py-2 ${tone}`}
      activeOpacity={0.8}>
      <Text className="text-xs font-semibold text-white">{label}</Text>
    </TouchableOpacity>
  );
}

function LearningCard({ data }: { data: LearningSummary }) {
  const router = useRouter();
  const progress = data.progress;
  const hasBody =
    data.roadmap_title || progress || data.resources?.length || data.quiz_questions;
  if (!hasBody) return null;

  return (
    <CardShell title="Learning" tint="text-amber-600" border="border-amber-100">
      {!!data.roadmap_title && (
        <>
          <Text className="text-sm font-semibold text-gray-900">{data.roadmap_title}</Text>
          <Text className="mt-0.5 text-xs text-gray-500">
            {data.topic_count ? `${data.topic_count} topics` : ''}
            {data.tasks_added_to_todo_list
              ? ` · ${data.tasks_added_to_todo_list} added to your tasks`
              : ''}
          </Text>
        </>
      )}

      {!!progress && (
        <View className="mt-1">
          <View className="mb-1 flex-row justify-between">
            <Text className="text-xs text-gray-500">
              {progress.covered_count ?? 0}/{progress.total ?? 0} done
            </Text>
            <Text className="text-xs font-semibold text-amber-700">{progress.percent ?? 0}%</Text>
          </View>
          <View className="h-1.5 overflow-hidden rounded-full bg-amber-100">
            <View
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${Math.min(100, Math.max(0, progress.percent ?? 0))}%` }}
            />
          </View>
          {!!progress.next_topic && (
            <Text className="mt-2 text-xs text-gray-600">Next: {progress.next_topic}</Text>
          )}
        </View>
      )}

      {!!data.quiz_questions && (
        <Text className="text-sm text-gray-700">{data.quiz_questions}-question quiz ready</Text>
      )}

      {!!data.resources?.length && (
        <View className="mt-1">
          {data.resources.slice(0, 5).map((r, i) => {
            const isUrl = /^https?:\/\//.test(r);
            return isUrl ? (
              <TouchableOpacity
                key={i}
                accessibilityRole="link"
                onPress={() => Linking.openURL(r).catch(() => {})}>
                <Text className="mb-1 text-sm text-blue-700 underline" numberOfLines={1}>
                  {r}
                </Text>
              </TouchableOpacity>
            ) : (
              <View key={i} className="mb-1 flex-row gap-2">
                <Text className="text-sm text-amber-600">•</Text>
                <Text className="flex-1 text-sm text-gray-700">{r}</Text>
              </View>
            );
          })}
        </View>
      )}

      {!!data.roadmapId && (
        <LinkButton
          label="Open roadmap"
          tone="bg-amber-600"
          onPress={() => router.push(`/learning/${data.roadmapId}` as any)}
        />
      )}
    </CardShell>
  );
}

function AssistantCard({ data }: { data: AssistantSummary }) {
  const router = useRouter();
  const research = data.research;
  const hasBody = data.tasks?.length || data.subtasks?.length || data.agenda_counts || research;
  if (!hasBody) return null;

  return (
    <CardShell title="Tasks" tint="text-sky-600" border="border-sky-100">
      {!!data.agenda_counts && (
        <View className="mb-2 flex-row flex-wrap gap-2">
          {Object.entries(data.agenda_counts).map(([bucket, count]) => (
            <View key={bucket} className="rounded-lg bg-sky-50 px-2.5 py-1">
              <Text className="text-xs text-sky-700">
                {bucket.replace('_', ' ')}: {count}
              </Text>
            </View>
          ))}
        </View>
      )}

      {data.tasks?.slice(0, 8).map((t, i) => (
        <View key={i} className="mb-1.5 flex-row items-center gap-2">
          <Text className="text-sm">⬜️</Text>
          <Text className="flex-1 text-sm text-gray-800" numberOfLines={1}>
            {t.title}
          </Text>
          {!!t.priority && (
            <Text className="text-[11px] text-gray-400 capitalize">{t.priority}</Text>
          )}
        </View>
      ))}

      {data.subtasks?.map((title, i) => (
        <View key={i} className="mb-1 flex-row gap-2">
          <Text className="text-xs font-semibold text-sky-600">{i + 1}.</Text>
          <Text className="flex-1 text-sm text-gray-700">{title}</Text>
        </View>
      ))}

      {!!research && (
        <View className="mt-1">
          {research.key_points?.slice(0, 4).map((point, i) => (
            <View key={i} className="mb-1 flex-row gap-2">
              <Text className="text-sm text-sky-600">•</Text>
              <Text className="flex-1 text-sm text-gray-700">{point}</Text>
            </View>
          ))}
          {research.sources?.slice(0, 3).map((src, i) => (
            <TouchableOpacity
              key={i}
              accessibilityRole="link"
              onPress={() => Linking.openURL(src).catch(() => {})}>
              <Text className="mb-1 text-xs text-blue-700 underline" numberOfLines={1}>
                {src}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!!data.tasks?.length && (
        <LinkButton
          label="All tasks"
          tone="bg-sky-600"
          onPress={() => router.push('/personal-assistant/tasks' as any)}
        />
      )}
    </CardShell>
  );
}

function MealCard({ data }: { data: MealSummary }) {
  const router = useRouter();
  if (data.error) {
    return (
      <View className="rounded-xl border border-red-100 bg-red-50 p-4">
        <Text className="text-sm text-red-700">{data.error}</Text>
      </View>
    );
  }
  if (!data.plan_id) return null;

  return (
    <CardShell title="Meal plan" tint="text-emerald-600" border="border-emerald-100">
      <Text className="text-sm text-gray-700">
        {data.meals_saved ? `${data.meals_saved} meals saved` : 'Plan updated'}
      </Text>
      <View className="flex-row gap-2">
        <LinkButton
          label="View plan"
          tone="bg-emerald-600"
          onPress={() => router.push(`/meal-planner/plan/${data.plan_id}` as any)}
        />
        <LinkButton
          label="Grocery list"
          tone="bg-gray-700"
          onPress={() => router.push(`/meal-planner/grocery/${data.plan_id}` as any)}
        />
      </View>
    </CardShell>
  );
}

export default function ResultCards({ results }: { results?: SkillResults }) {
  if (!results) return null;
  return (
    <View className="w-full max-w-md gap-2">
      {!!results.learning && <LearningCard data={results.learning} />}
      {!!results.assistant && <AssistantCard data={results.assistant} />}
      {!!results.meal && <MealCard data={results.meal} />}
    </View>
  );
}
