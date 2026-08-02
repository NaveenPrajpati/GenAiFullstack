/**
 * Note rendering shared by the per-topic section and the consolidated view, so
 * a snippet looks like a snippet in both places.
 */
import { useState } from 'react';
import { Linking, Text, TextInput, TouchableOpacity, View } from 'react-native';

import type { LearningNote, NoteKind } from '../types';

export const NOTE_KINDS: { kind: NoteKind; label: string; icon: string }[] = [
  { kind: 'note', label: 'Note', icon: '📝' },
  { kind: 'snippet', label: 'Code', icon: '⌨️' },
  { kind: 'link', label: 'Link', icon: '🔖' },
  { kind: 'question', label: 'Question', icon: '❓' },
];

const ICONS: Record<NoteKind, string> = Object.fromEntries(
  NOTE_KINDS.map((k) => [k.kind, k.icon])
) as Record<NoteKind, string>;

export function NoteRow({
  note,
  showSource,
  onToggleResolved,
  onDelete,
}: {
  note: LearningNote;
  /** The consolidated view needs to say which topic a note came from. */
  showSource?: boolean;
  onToggleResolved: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <View
      className={`mb-2 rounded-lg border p-3 ${
        note.resolved ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'
      }`}>
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-[10px] text-gray-400">
          {ICONS[note.kind]}{' '}
          {showSource && note.topicTitle
            ? `${note.topicTitle} · ${note.roadmapTitle ?? ''}`
            : new Date(note.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
        </Text>
        <View className="flex-row gap-3">
          {note.kind === 'question' && (
            <TouchableOpacity onPress={() => onToggleResolved(note._id)}>
              <Text className="text-[10px] font-medium text-violet-600">
                {note.resolved ? 'Reopen' : 'Answered'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => onDelete(note._id)}>
            <Text className="text-[10px] text-gray-400">Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {note.kind === 'snippet' ? (
        <View className="rounded bg-gray-900 p-2.5">
          <Text className="font-mono text-[11px] leading-relaxed text-gray-100">
            {note.body}
          </Text>
        </View>
      ) : note.kind === 'link' ? (
        <TouchableOpacity
          disabled={!note.url}
          onPress={() => note.url && Linking.openURL(note.url).catch(() => {})}>
          <Text className="text-xs text-blue-600 underline" numberOfLines={2}>
            {note.body}
          </Text>
          {!!note.url && (
            <Text className="text-[10px] text-gray-400" numberOfLines={1}>
              {note.url}
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <Text
          className={`text-xs leading-relaxed ${
            note.resolved ? 'text-gray-400 line-through' : 'text-gray-700'
          }`}>
          {note.body}
        </Text>
      )}
    </View>
  );
}

export function NoteComposer({
  onSave,
  saving,
}: {
  onSave: (note: { kind: NoteKind; body: string; url?: string }) => void;
  saving: boolean;
}) {
  const [kind, setKind] = useState<NoteKind>('note');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');

  const canSave = body.trim().length > 0 && !saving;

  const placeholder =
    kind === 'snippet'
      ? 'Paste a snippet…'
      : kind === 'link'
        ? 'What is this link?'
        : kind === 'question'
          ? "Something you want to come back to…"
          : 'Jot something down…';

  return (
    <View>
      <View className="mb-2 flex-row gap-1.5">
        {NOTE_KINDS.map((k) => (
          <TouchableOpacity
            key={k.kind}
            onPress={() => setKind(k.kind)}
            className={`rounded-lg border px-2.5 py-1 ${
              kind === k.kind ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white'
            }`}
            activeOpacity={0.7}>
            <Text
              className={`text-[11px] ${
                kind === k.kind ? 'font-medium text-violet-700' : 'text-gray-500'
              }`}>
              {k.icon} {k.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        className={`rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 ${
          kind === 'snippet' ? 'font-mono' : ''
        }`}
        style={{ minHeight: kind === 'snippet' ? 70 : 44, maxHeight: 160 }}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        multiline
        value={body}
        onChangeText={setBody}
      />
      {kind === 'link' && (
        <TextInput
          className="mt-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800"
          placeholder="https://…"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          keyboardType="url"
          value={url}
          onChangeText={setUrl}
        />
      )}

      <TouchableOpacity
        onPress={() => {
          onSave({ kind, body: body.trim(), url: url.trim() || undefined });
          setBody('');
          setUrl('');
        }}
        disabled={!canSave}
        className={`mt-2 items-center rounded-lg py-2 ${
          canSave ? 'bg-violet-600' : 'bg-gray-200'
        }`}
        activeOpacity={0.8}>
        <Text className={`text-xs font-semibold ${canSave ? 'text-white' : 'text-gray-400'}`}>
          Save
        </Text>
      </TouchableOpacity>
    </View>
  );
}
