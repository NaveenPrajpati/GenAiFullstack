import ScreenHeader from '@/components/ui/ScreenHeader';
import SectionNav, { useWideNav } from '@/components/ui/SectionNav';
import { NOTE_KINDS, NoteRow } from '@/features/learning/components/Notes';
import { useLearningStore } from '@/features/learning/store';
import type { NoteKind } from '@/features/learning/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Everything the learner has written, across every roadmap — the reason to come
 * back to the app when they aren't mid-topic.
 */
export default function NotesScreen() {
  const router = useRouter();
  const { notes, notesLoading, fetchNotes, toggleNoteResolved, removeNote } = useLearningStore();
  const [kind, setKind] = useState<NoteKind | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchNotes(kind ? { kind } : undefined);
    }, [kind])
  );

  // Questions worth revisiting are the point of writing them down, so unresolved
  // ones lead regardless of when they were written.
  const open = notes.filter((n) => n.kind === 'question' && !n.resolved);
  const rest = notes.filter((n) => !(n.kind === 'question' && !n.resolved));

  const wide = useWideNav();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }} className="bg-bg">
      <ScreenHeader
        title="My notes"
        subtitle={`${notes.length} saved across your roadmaps`}
        showMenu={!wide}>
        <SectionNav />

        {/* Kind filters are a second, narrower axis than the section nav, so they
            sit under it rather than competing with it. */}
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          <TouchableOpacity
            onPress={() => setKind(null)}
            className={`rounded-lg border px-2.5 py-1 ${
              kind === null ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
            }`}
            activeOpacity={0.7}>
            <Text
              className={`text-[11px] ${
                kind === null ? 'text-primary font-medium' : 'text-ink-soft'
              }`}>
              All
            </Text>
          </TouchableOpacity>
          {NOTE_KINDS.map((k) => (
            <TouchableOpacity
              key={k.kind}
              onPress={() => setKind(k.kind)}
              className={`rounded-lg border px-2.5 py-1 ${
                kind === k.kind ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
              }`}
              activeOpacity={0.7}>
              <Text
                className={`text-[11px] ${
                  kind === k.kind ? 'text-primary font-medium' : 'text-ink-soft'
                }`}>
                {k.icon} {k.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScreenHeader>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {notesLoading && notes.length === 0 && (
          <View className="items-center py-12">
            <ActivityIndicator size="large" />
          </View>
        )}

        {!notesLoading && notes.length === 0 && (
          <View className="items-center rounded-xl border border-dashed border-gray-300 bg-white p-10">
            <Text className="mb-2 text-4xl">📝</Text>
            <Text className="mb-1 text-base font-semibold text-gray-900">Nothing saved yet</Text>
            <Text className="text-center text-sm leading-relaxed text-gray-500">
              Open a topic on any roadmap to jot a note, keep a snippet, bookmark a link, or park a
              question.
            </Text>
          </View>
        )}

        {open.length > 0 && (
          <View className="mb-4">
            <Text className="mb-2 text-xs font-bold tracking-widest text-gray-400 uppercase">
              Open questions
            </Text>
            {open.map((n) => (
              <TouchableOpacity
                key={n._id}
                activeOpacity={0.9}
                onPress={() => router.push(`/learning/${n.roadmapId}`)}>
                <NoteRow
                  note={n}
                  showSource
                  onToggleResolved={toggleNoteResolved}
                  onDelete={removeNote}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {rest.length > 0 && (
          <View>
            {open.length > 0 && (
              <Text className="mb-2 text-xs font-bold tracking-widest text-gray-400 uppercase">
                Everything else
              </Text>
            )}
            {rest.map((n) => (
              <TouchableOpacity
                key={n._id}
                activeOpacity={0.9}
                onPress={() => router.push(`/learning/${n.roadmapId}`)}>
                <NoteRow
                  note={n}
                  showSource
                  onToggleResolved={toggleNoteResolved}
                  onDelete={removeNote}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
