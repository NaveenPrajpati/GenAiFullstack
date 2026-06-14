import Spinner from '@/components/ui/Spinner';
import { usePersonalAssistantStore } from '@/features/personal-assistant/store';
import type { Note } from '@/features/personal-assistant/types';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

const UNCATEGORIZED = 'General';

export default function NotesScreen() {
  const router = useRouter();
  const { notes, notesLoading, notesError, loadNotes, addNote } = usePersonalAssistantStore();

  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadNotes();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const n of notes) {
      const key = n.category?.trim() || UNCATEGORIZED;
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [notes]);

  const handleAdd = async () => {
    if (!content.trim() || adding) return;
    setAdding(true);
    setError('');
    try {
      await addNote(content, category);
      setContent('');
      setCategory('');
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to add note.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-sm text-violet-600">← Assistant</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Notes</Text>
        <Text className="mt-0.5 text-sm text-gray-500">
          Facts the assistant remembers about you
        </Text>
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Add note */}
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <TextInput
            className="mb-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800"
            style={{ minHeight: 60, textAlignVertical: 'top' }}
            placeholder="e.g. I'm allergic to peanuts"
            placeholderTextColor="#9ca3af"
            multiline
            value={content}
            onChangeText={setContent}
            accessibilityLabel="Note content"
          />
          <TextInput
            className="mb-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800"
            placeholder="Category (optional)"
            placeholderTextColor="#9ca3af"
            value={category}
            onChangeText={setCategory}
            accessibilityLabel="Note category"
          />
          {!!error && <Text className="mb-2 text-sm text-red-700">{error}</Text>}
          <TouchableOpacity
            onPress={handleAdd}
            disabled={!content.trim() || adding}
            className={`items-center rounded-xl py-3 ${
              !content.trim() || adding ? 'bg-gray-300' : 'bg-violet-600'
            }`}
            activeOpacity={0.8}
            accessibilityRole="button">
            {adding ? (
              <Spinner size="small" color="white" />
            ) : (
              <Text className="text-sm font-semibold text-white">Add note</Text>
            )}
          </TouchableOpacity>
        </View>

        {notesLoading && notes.length === 0 && (
          <View className="items-center py-10">
            <Spinner size="large" />
          </View>
        )}

        {!!notesError && !notesLoading && (
          <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <Text className="mb-2 text-sm text-red-700">{notesError}</Text>
            <TouchableOpacity onPress={loadNotes}>
              <Text className="text-sm font-medium text-red-600">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!notesLoading && !notesError && notes.length === 0 && (
          <View className="items-center rounded-xl border border-dashed border-gray-300 bg-white p-10">
            <Text className="mb-2 text-4xl">🧠</Text>
            <Text className="text-base font-semibold text-gray-900">Nothing remembered yet</Text>
            <Text className="mt-1 text-center text-sm text-gray-500">
              Add a fact above, or tell the assistant “remember …”.
            </Text>
          </View>
        )}

        {grouped.map(([cat, items]) => (
          <View key={cat} className="mb-5">
            <Text className="mb-2 text-xs font-bold tracking-wide text-gray-500 uppercase">
              {cat}
            </Text>
            {items.map((n, i) => (
              <View key={i} className="mb-2 rounded-xl border border-gray-200 bg-white p-4">
                <Text className="text-sm text-gray-800">{n.content}</Text>
                {!!n.created_at && (
                  <Text className="mt-1 text-xs text-gray-400">
                    {new Date(n.created_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
