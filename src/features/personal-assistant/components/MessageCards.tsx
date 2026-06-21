/** Rich cards rendered inside assistant chat bubbles. */
import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from 'react-native';
import type { AgendaBuckets, DeleteProposal, Note, ResearchResult, Task } from '../types';
import { formatDue, PriorityChip, RecurrenceBadge } from './common';

function TaskLine({ task }: { task: Task }) {
  const done = task.status === 'done';
  return (
    <View className="mb-2 flex-row items-center gap-2">
      <Text className="text-sm">{done ? '✅' : '⬜️'}</Text>
      <Text
        className={`flex-1 text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}
        numberOfLines={2}>
        {task.title}
      </Text>
      <RecurrenceBadge recurrence={task.recurrence} />
      {!!task.due_at && <Text className="text-xs text-gray-400">{formatDue(task.due_at)}</Text>}
      <PriorityChip priority={task.priority} />
    </View>
  );
}

export function TaskListCard({ title, tasks }: { title: string; tasks: Task[] }) {
  if (!tasks.length) return null;
  return (
    <View className="rounded-xl border border-gray-200 bg-white p-4">
      <Text className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
        {title} · {tasks.length}
      </Text>
      {tasks.map((t) => (
        <TaskLine key={t.id} task={t} />
      ))}
    </View>
  );
}

export function AgendaCard({ agenda }: { agenda: AgendaBuckets }) {
  const sections: { key: keyof AgendaBuckets; label: string; tint: string }[] = [
    { key: 'overdue', label: 'Overdue', tint: 'text-red-600' },
    { key: 'today', label: 'Today', tint: 'text-violet-600' },
    { key: 'upcoming', label: 'Upcoming', tint: 'text-blue-600' },
  ];
  return (
    <View className="rounded-xl border border-gray-200 bg-white p-4">
      <Text className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
        Agenda
      </Text>
      {sections.map(({ key, label, tint }) => {
        const items = agenda[key] ?? [];
        return (
          <View key={key} className="mb-3">
            <Text className={`mb-1.5 text-sm font-semibold ${tint}`}>
              {label} · {items.length}
            </Text>
            {items.length === 0 ? (
              <Text className="text-xs text-gray-400">Nothing here</Text>
            ) : (
              items.map((t) => <TaskLine key={t.id} task={t} />)
            )}
          </View>
        );
      })}
    </View>
  );
}

export function ResearchCard({ research }: { research: ResearchResult }) {
  return (
    <View className="rounded-xl border border-blue-100 bg-blue-50 p-4">
      <Text className="mb-1.5 text-xs font-semibold tracking-wide text-blue-600 uppercase">
        Research
      </Text>
      <Text className="mb-3 text-sm leading-relaxed text-gray-800">{research.summary}</Text>

      {research.key_points?.length > 0 && (
        <View className="mb-3">
          {research.key_points.map((point, i) => (
            <View key={i} className="mb-1 flex-row gap-2">
              <Text className="text-sm text-blue-600">•</Text>
              <Text className="flex-1 text-sm text-gray-700">{point}</Text>
            </View>
          ))}
        </View>
      )}

      {research.sources?.length > 0 && (
        <View>
          <Text className="mb-1 text-xs font-semibold text-gray-500">Sources</Text>
          {research.sources.map((src, i) => (
            <TouchableOpacity
              key={i}
              accessibilityRole="link"
              onPress={() => Linking.openURL(src).catch(() => {})}>
              <Text className="mb-1 text-sm text-blue-700 underline" numberOfLines={1}>
                {src}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export function NotesCard({ notes }: { notes: Note[] }) {
  if (!notes.length) return null;
  return (
    <View className="rounded-xl border border-amber-100 bg-amber-50 p-4">
      <Text className="mb-2 text-xs font-semibold tracking-wide text-amber-600 uppercase">
        What I know
      </Text>
      {notes.map((n, i) => (
        <View key={i} className="mb-1.5 flex-row gap-2">
          <Text className="text-sm text-amber-600">•</Text>
          <Text className="flex-1 text-sm text-gray-700">{n.content}</Text>
        </View>
      ))}
    </View>
  );
}

export function SuggestionsCard({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  if (!suggestions.length) return null;
  return (
    <View className="flex-row flex-wrap gap-2">
      {suggestions.map((s, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onPick(s)}
          className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5"
          activeOpacity={0.7}>
          <Text className="text-xs text-violet-700">{s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Inline Human-in-the-Loop delete confirmation. */
export function ApprovalCard({
  proposal,
  resolved,
  busy,
  onApprove,
  onReject,
}: {
  proposal: DeleteProposal;
  resolved?: 'approved' | 'rejected';
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View className="rounded-xl border border-red-200 bg-red-50 p-4">
      <Text className="mb-2 text-xs font-semibold tracking-wide text-red-600 uppercase">
        Confirm deletion
      </Text>
      {proposal.tasks.map((t) => (
        <View key={t.id} className="mb-1 flex-row gap-2">
          <Text className="text-sm text-red-500">🗑</Text>
          <Text className="flex-1 text-sm text-gray-800">{t.title}</Text>
        </View>
      ))}

      {resolved ? (
        <View className="mt-3 rounded-lg bg-white/70 py-2">
          <Text className="text-center text-sm font-medium text-gray-600 capitalize">
            {resolved === 'approved' ? '✓ Deleted' : '✕ Kept'}
          </Text>
        </View>
      ) : (
        <View className="mt-3 flex-row gap-2">
          <TouchableOpacity
            onPress={onApprove}
            disabled={busy}
            accessibilityRole="button"
            className="flex-1 items-center rounded-lg bg-red-600 py-2.5"
            activeOpacity={0.8}>
            {busy ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-sm font-semibold text-white">Delete</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onReject}
            disabled={busy}
            accessibilityRole="button"
            className="flex-1 items-center rounded-lg bg-gray-200 py-2.5"
            activeOpacity={0.8}>
            <Text className="text-sm font-medium text-gray-700">Keep</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
