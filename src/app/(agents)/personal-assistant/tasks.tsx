import {
  PriorityChip,
  RecurrenceBadge,
  formatDue,
  isOverdue,
} from '@/features/personal-assistant/components/common';
import { priorities, usePersonalAssistantStore } from '@/features/personal-assistant/store';
import type { Priority, TaskStatus } from '@/features/personal-assistant/types';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

type Segment = 'all' | TaskStatus;
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'done', label: 'Done' },
];

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 items-center rounded-xl border border-gray-200 bg-white py-2.5">
      <Text className="text-lg font-bold text-gray-900">{value}</Text>
      <Text className="text-xs text-gray-500">{label}</Text>
    </View>
  );
}

function RowSkeleton() {
  return (
    <View className="mb-2 rounded-xl border border-gray-100 bg-white p-4">
      <View className="mb-2 h-4 w-2/3 rounded bg-gray-100" />
      <View className="h-3 w-1/3 rounded bg-gray-100" />
    </View>
  );
}

export default function TasksScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('all');
  const [priority, setPriority] = useState<Priority | 'all'>('all');

  const { tasks, tasksLoading, tasksError, loadTasks, stats, loadStats } =
    usePersonalAssistantStore();

  const refresh = () =>
    loadTasks({
      ...(segment !== 'all' ? { status: segment } : {}),
      ...(priority !== 'all' ? { priority } : {}),
    });

  useEffect(() => {
    refresh();
  }, [segment, priority]);

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-sm text-violet-600">← Assistant</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Tasks</Text>

        {stats && (
          <View className="mt-3 flex-row gap-2">
            <StatChip label="Total" value={stats.total} />
            <StatChip label="Pending" value={stats.by_status?.pending ?? 0} />
            <StatChip label="Done" value={stats.by_status?.done ?? 0} />
            <StatChip label="High" value={stats.by_priority?.high ?? 0} />
          </View>
        )}
      </View>

      {/* Filters */}
      <View className="border-b border-gray-100 bg-white px-4 py-3">
        <View className="mb-2 flex-row rounded-lg bg-gray-100 p-1">
          {SEGMENTS.map((s) => (
            <TouchableOpacity
              key={s.key}
              onPress={() => setSegment(s.key)}
              className={`flex-1 items-center rounded-md py-1.5 ${
                segment === s.key ? 'bg-white' : ''
              }`}
              activeOpacity={0.7}>
              <Text
                className={`text-sm font-medium ${
                  segment === s.key ? 'text-violet-700' : 'text-gray-500'
                }`}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View className="flex-row gap-2">
          {(['all', ...priorities] as const).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPriority(p)}
              className={`rounded-full border px-3 py-1 ${
                priority === p ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-white'
              }`}
              activeOpacity={0.7}>
              <Text
                className={`text-xs font-medium capitalize ${
                  priority === p ? 'text-violet-700' : 'text-gray-500'
                }`}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 24 }}>
        {tasksLoading && tasks.length === 0 && (
          <>
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </>
        )}

        {!!tasksError && !tasksLoading && (
          <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <Text className="mb-2 text-sm text-red-700">{tasksError}</Text>
            <TouchableOpacity onPress={refresh}>
              <Text className="text-sm font-medium text-red-600">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!tasksLoading && !tasksError && tasks.length === 0 && (
          <View className="items-center rounded-xl border border-dashed border-gray-300 bg-white p-10">
            <Text className="mb-2 text-4xl">📋</Text>
            <Text className="text-base font-semibold text-gray-900">No tasks here</Text>
            <Text className="mt-1 text-center text-sm text-gray-500">
              Ask the assistant to add one for you.
            </Text>
          </View>
        )}

        {tasks.map((task) => {
          const overdue = isOverdue(task);
          return (
            <TouchableOpacity
              key={task.id}
              onPress={() => router.push(`/personal-assistant/task/${task.id}` as any)}
              className="mb-2 rounded-xl border border-gray-200 bg-white p-4"
              activeOpacity={0.7}
              accessibilityRole="button">
              <View className="flex-row items-center gap-2">
                <Text className="text-base">{task.status === 'done' ? '✅' : '⬜️'}</Text>
                <Text
                  className={`flex-1 text-sm font-medium ${
                    task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'
                  }`}
                  numberOfLines={2}>
                  {task.title}
                </Text>
                <PriorityChip priority={task.priority} />
              </View>
              <View className="mt-1.5 flex-row items-center gap-2 pl-7">
                {!!task.due_at && (
                  <Text className={`text-xs ${overdue ? 'text-red-600' : 'text-gray-400'}`}>
                    {overdue ? 'Overdue · ' : ''}
                    {formatDue(task.due_at)}
                  </Text>
                )}
                <RecurrenceBadge recurrence={task.recurrence} />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
