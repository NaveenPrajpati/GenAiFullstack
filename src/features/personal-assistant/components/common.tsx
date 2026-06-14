/** Small shared presentational bits + formatters used across PA screens. */
import { Text, View } from 'react-native';
import type { Priority, Task } from '../types';

export const PRIORITY_STYLES: Record<Priority, { bg: string; text: string }> = {
  low: { bg: 'bg-gray-100', text: 'text-gray-600' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
  high: { bg: 'bg-red-100', text: 'text-red-700' },
};

export function PriorityChip({ priority }: { priority: Priority }) {
  const s = PRIORITY_STYLES[priority];
  return (
    <View className={`rounded-full px-2 py-0.5 ${s.bg}`}>
      <Text className={`text-xs font-medium capitalize ${s.text}`}>{priority}</Text>
    </View>
  );
}

export function RecurrenceBadge({ recurrence }: { recurrence?: Task['recurrence'] }) {
  if (!recurrence) return null;
  return (
    <View className="flex-row items-center rounded-md bg-blue-50 px-1.5 py-0.5">
      <Text className="text-xs text-blue-600">🔁 {recurrence}</Text>
    </View>
  );
}

/** Friendly relative-ish due date. Returns '' when no date. */
export function formatDue(due?: string): string {
  if (!due) return '';
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return due;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDue = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function isOverdue(task: Task): boolean {
  if (!task.due_at || task.status === 'done') return false;
  return new Date(task.due_at).getTime() < Date.now();
}
