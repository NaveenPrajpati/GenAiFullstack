import {
  PriorityChip,
  RecurrenceBadge,
  formatDue,
} from '@/features/personal-assistant/components/common';
import { usePersonalAssistantStore } from '@/features/personal-assistant/store';
import type { AgendaBuckets, Task } from '@/features/personal-assistant/types';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const SECTIONS: {
  key: keyof AgendaBuckets;
  label: string;
  warn?: boolean;
}[] = [
  { key: 'overdue', label: 'Overdue', warn: true },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
];

function TaskRow({ task, warn }: { task: Task; warn?: boolean }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push(`/personal-assistant/task/${task.id}` as any)}
      className={`mb-2 rounded-xl border p-3 ${warn ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}
      activeOpacity={0.7}
      accessibilityRole="button">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-sm font-medium text-gray-900" numberOfLines={2}>
          {task.title}
        </Text>
        <PriorityChip priority={task.priority} />
      </View>
      <View className="mt-1 flex-row items-center gap-2">
        {!!task.due_at && (
          <Text className={`text-xs ${warn ? 'text-red-600' : 'text-gray-400'}`}>
            {formatDue(task.due_at)}
          </Text>
        )}
        <RecurrenceBadge recurrence={task.recurrence} />
      </View>
    </TouchableOpacity>
  );
}

export default function AgendaScreen() {
  const router = useRouter();
  const { agenda, agendaLoading, agendaError, loadAgenda } = usePersonalAssistantStore();

  useEffect(() => {
    loadAgenda();
  }, []);

  const counts = agenda?.counts;
  const total = (counts?.overdue ?? 0) + (counts?.today ?? 0) + (counts?.upcoming ?? 0);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-sm text-violet-600">← Assistant</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Agenda</Text>
        {counts && (
          <View className="mt-2 flex-row gap-4">
            <Text className="text-xs font-medium text-red-600">{counts.overdue} overdue</Text>
            <Text className="text-xs font-medium text-violet-600">{counts.today} today</Text>
            <Text className="text-xs font-medium text-blue-600">{counts.upcoming} upcoming</Text>
          </View>
        )}
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 24 }}>
        {agendaLoading && !agenda && (
          <View className="items-center py-12">
            <ActivityIndicator size="large" />
            <Text className="mt-3 text-sm text-gray-400">Loading agenda…</Text>
          </View>
        )}

        {!!agendaError && !agendaLoading && (
          <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <Text className="mb-2 text-sm text-red-700">{agendaError}</Text>
            <TouchableOpacity onPress={loadAgenda}>
              <Text className="text-sm font-medium text-red-600">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {agenda && total === 0 && !agendaLoading && (
          <View className="items-center rounded-xl border border-dashed border-gray-300 bg-white p-10">
            <Text className="mb-2 text-4xl">🎉</Text>
            <Text className="text-base font-semibold text-gray-900">All caught up</Text>
            <Text className="mt-1 text-center text-sm text-gray-500">
              Nothing overdue, due today, or coming up.
            </Text>
          </View>
        )}

        {agenda &&
          SECTIONS.map(({ key, label, warn }) => {
            const items = agenda.buckets[key] ?? [];
            if (items.length === 0) return null;
            return (
              <View key={key} className="mb-5">
                <Text
                  className={`mb-2 text-sm font-bold ${warn ? 'text-red-600' : 'text-gray-700'}`}>
                  {label} · {items.length}
                </Text>
                {items.map((t) => (
                  <TaskRow key={t.id} task={t} warn={warn} />
                ))}
              </View>
            );
          })}
      </ScrollView>
    </View>
  );
}
