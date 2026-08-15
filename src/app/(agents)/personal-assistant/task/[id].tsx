import { PriorityChip, formatDue } from '@/features/personal-assistant/components/common';
import { priorities, usePersonalAssistantStore } from '@/features/personal-assistant/store';
import type { Priority, Task } from '@/features/personal-assistant/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function TaskDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    tasks,
    loadTask,
    updateTask,
    completeTask,
    deleteTask,
    subtasks,
    loadSubtasks,
    tasksError,
  } = usePersonalAssistantStore();

  const task = useMemo<Task | undefined>(() => tasks.find((t) => t.id === id), [tasks, id]);
  const children = (id && subtasks[id]) || [];

  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    if (!task) loadTask(id);
    loadSubtasks(id);
  }, [id]);

  // Seed the form once the task is available (and not while editing).
  useEffect(() => {
    if (task && !dirty) {
      setTitle(task.title);
      setDetails(task.details ?? '');
      setPriority(task.priority);
    }
  }, [task]);

  const handleSave = async () => {
    if (!id || !task) return;
    setSaving(true);
    setError('');
    try {
      await updateTask(id, { title: title.trim(), details: details.trim(), priority });
      setDirty(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      await completeTask(id);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to update.');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      await deleteTask(id);
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to delete.');
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (Platform.OS === 'web') {
      // Alert has no buttons on web — fall back to confirm().
      if (typeof window !== 'undefined' && window.confirm('Delete this task permanently?')) {
        doDelete();
      }
      return;
    }
    Alert.alert('Delete task', 'Delete this task permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  if (!task) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        {tasksError ? (
          <View className="items-center px-8">
            <Text className="mb-3 text-center text-sm text-red-700">{tasksError}</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-sm font-medium text-violet-600">Go back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ActivityIndicator size="large" />
        )}
      </View>
    );
  }

  const isDone = task.status === 'done';

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-sm text-violet-600">← Tasks</Text>
        </TouchableOpacity>
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-gray-900">Task</Text>
          <View className="flex-row items-center gap-2">
            <PriorityChip priority={task.priority} />
            <View
              className={`rounded-full px-2 py-0.5 ${isDone ? 'bg-green-100' : 'bg-violet-100'}`}>
              <Text
                className={`text-xs font-medium capitalize ${isDone ? 'text-green-700' : 'text-violet-700'}`}>
                {task.status}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <Text className="mb-1 text-xs font-semibold text-gray-500">Title</Text>
          <TextInput
            className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800"
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              setDirty(true);
            }}
            accessibilityLabel="Task title"
          />

          <Text className="mb-1 text-xs font-semibold text-gray-500">Details</Text>
          <TextInput
            className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800"
            style={{ minHeight: 80, textAlignVertical: 'top' }}
            multiline
            placeholder="Add details…"
            placeholderTextColor="#9ca3af"
            value={details}
            onChangeText={(v) => {
              setDetails(v);
              setDirty(true);
            }}
            accessibilityLabel="Task details"
          />

          <Text className="mb-1 text-xs font-semibold text-gray-500">Priority</Text>
          <View className="mb-4 flex-row gap-2">
            {priorities.map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => {
                  setPriority(p);
                  setDirty(true);
                }}
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

          {!!task.due_at && (
            <Text className="mb-1 text-xs text-gray-500">Due {formatDue(task.due_at)}</Text>
          )}
          {!!task.recurrence && (
            <Text className="text-xs text-blue-600">🔁 Repeats {task.recurrence}</Text>
          )}

          {!!error && (
            <View className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <Text className="text-sm text-red-700">{error}</Text>
            </View>
          )}

          {dirty && (
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !title.trim()}
              className={`mt-3 items-center rounded-xl py-3 ${saving ? 'bg-gray-300' : 'bg-violet-600'}`}
              activeOpacity={0.8}>
              {saving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-sm font-semibold text-white">Save changes</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Actions */}
        <View className="mb-4 flex-row gap-2">
          {!isDone && (
            <TouchableOpacity
              onPress={handleComplete}
              disabled={busy}
              className="flex-1 items-center rounded-xl bg-green-600 py-3"
              activeOpacity={0.8}
              accessibilityRole="button">
              <Text className="text-sm font-semibold text-white">Mark done</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={confirmDelete}
            disabled={busy}
            className="flex-1 items-center rounded-xl border border-red-200 bg-red-50 py-3"
            activeOpacity={0.8}
            accessibilityRole="button">
            <Text className="text-sm font-medium text-red-700">Delete</Text>
          </TouchableOpacity>
        </View>

        {/* Subtasks */}
        {children.length > 0 && (
          <View className="rounded-xl border border-gray-200 bg-white p-4">
            <Text className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Subtasks · {children.length}
            </Text>
            {children.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => router.push(`/personal-assistant/task/${c.id}` as any)}
                className="mb-2 flex-row items-center gap-2"
                activeOpacity={0.7}>
                <Text className="text-sm">{c.status === 'done' ? '✅' : '⬜️'}</Text>
                <Text
                  className={`flex-1 text-sm ${
                    c.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'
                  }`}>
                  {c.title}
                </Text>
                <PriorityChip priority={c.priority} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
