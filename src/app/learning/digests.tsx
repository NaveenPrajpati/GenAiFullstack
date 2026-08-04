import { useLearningStore } from '@/features/learning/store';
import type { Roadmap, TopicNode } from '@/features/learning/types';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';

/**
 * The digest archive: everything the tutor has sent, newest first.
 *
 * Filtering is two levels — a roadmap, then one of its topics — and both are
 * applied server-side. Narrowing a page that was already cut to the newest 20
 * would show an empty list for any topic that hasn't been written about lately,
 * which reads as "no digests" rather than "not on this page".
 */

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`mr-2 rounded-full border px-3 py-1.5 ${
        selected ? 'border-violet-600 bg-violet-600' : 'border-gray-200 bg-white'
      }`}
      activeOpacity={0.7}>
      <Text
        className={`text-xs font-medium ${selected ? 'text-white' : 'text-gray-600'}`}
        numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** A horizontally scrolling row of chips. Roadmap titles and topic titles are
 *  both arbitrary length, so wrapping them would push the list off-screen. */
function FilterRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { id: string | null; title: string }[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <View className="mb-2">
      <Text className="mb-1.5 text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {options.map((o) => (
          <FilterChip
            key={o.id ?? 'all'}
            label={o.title}
            selected={selected === o.id}
            onPress={() => onSelect(o.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function DigestsScreen() {
  const router = useRouter();
  const {
    digests,
    digestsLoading,
    digestsError,
    fetchDigests,
    markDigest,
    roadmaps,
    fetchRoadmaps,
  } = useLearningStore();

  const [roadmapId, setRoadmapId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);

  // The roadmap list is what the filter is built from — it carries every topic,
  // including ones whose digests are too old to be on the current page.
  useEffect(() => {
    fetchRoadmaps();
  }, []);

  useEffect(() => {
    fetchDigests({
      limit: 50,
      roadmapId: roadmapId ?? undefined,
      topicId: topicId ?? undefined,
    });
  }, [roadmapId, topicId]);

  const topics: TopicNode[] = useMemo(() => {
    const selected = roadmaps.find((r: Roadmap) => r._id === roadmapId);
    return [...(selected?.topics ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [roadmaps, roadmapId]);

  const selectRoadmap = (id: string | null) => {
    setRoadmapId(id);
    // A topic belongs to exactly one roadmap, so keeping the old one selected
    // would filter to a topic that isn't in the new list — an empty page with no
    // visible cause.
    setTopicId(null);
  };

  const filtered = !!roadmapId || !!topicId;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-sm text-violet-600">← Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Daily Digests</Text>
        <Text className="mt-1 text-sm text-gray-500">AI-curated summaries of your topics</Text>
      </View>

      {roadmaps.length > 0 && (
        <View className="border-b border-gray-200 bg-white px-5 py-3">
          <FilterRow
            label="Roadmap"
            selected={roadmapId}
            onSelect={selectRoadmap}
            options={[
              { id: null, title: 'All' },
              ...roadmaps.map((r: Roadmap) => ({ id: r._id, title: r.title })),
            ]}
          />

          {/* Topics only mean something once a roadmap is picked. */}
          {!!roadmapId && topics.length > 0 && (
            <FilterRow
              label="Topic"
              selected={topicId}
              onSelect={setTopicId}
              options={[
                { id: null, title: 'All topics' },
                ...topics.map((t) => ({ id: t.id, title: t.title })),
              ]}
            />
          )}
        </View>
      )}

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {!!digestsError && (
          <View className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <Text className="text-xs text-red-700">{digestsError}</Text>
          </View>
        )}

        {digestsLoading && (
          <View className="items-center py-12">
            <ActivityIndicator size="large" />
            <Text className="mt-3 text-sm text-gray-400">Loading digests…</Text>
          </View>
        )}

        {/* A filtered empty result is a different situation from having no
            digests at all, and offering "enable digests" for it would be wrong. */}
        {!digestsLoading && digests.length === 0 && filtered && (
          <View className="items-center rounded-xl border border-dashed border-gray-300 bg-white p-8">
            <Text className="mb-1 text-base font-semibold text-gray-900">Nothing here yet</Text>
            <Text className="mb-4 text-center text-sm leading-relaxed text-gray-500">
              No digests have been sent for {topicId ? 'this topic' : 'this roadmap'}.
            </Text>
            <TouchableOpacity
              onPress={() => selectRoadmap(null)}
              className="rounded-lg border border-gray-200 px-4 py-2"
              activeOpacity={0.7}>
              <Text className="text-sm font-medium text-gray-600">Clear filter</Text>
            </TouchableOpacity>
          </View>
        )}

        {!digestsLoading && digests.length === 0 && !filtered && (
          <View className="items-center rounded-xl border border-dashed border-gray-300 bg-white p-10">
            <Text className="mb-2 text-5xl">📰</Text>
            <Text className="mb-1 text-base font-semibold text-gray-900">No digests yet</Text>
            <Text className="mb-4 text-center text-sm leading-relaxed text-gray-500">
              Enable daily digests in Settings to receive AI-curated learning summaries.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/learning/settings')}
              className="rounded-lg bg-violet-600 px-5 py-3"
              activeOpacity={0.8}>
              <Text className="text-sm font-medium text-white">Open Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {digests.map((digest) => {
          const date = new Date(digest.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          return (
            <View
              key={digest._id}
              className={`mb-4 rounded-xl border bg-white p-4 ${
                digest.status === 'marked' ? 'border-gray-200' : 'border-violet-200'
              }`}>
              <View className="mb-2 flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-semibold text-gray-900">{digest.topicTitle}</Text>
                  {/* Which roadmap it came from, since the unfiltered list mixes
                      several and topic titles alone don't say. */}
                  {!roadmapId && !!digest.roadmapTitle && (
                    <Text className="mt-0.5 text-[11px] text-gray-400" numberOfLines={1}>
                      {digest.roadmapTitle}
                    </Text>
                  )}
                </View>
                <Text className="text-xs text-gray-400">{date}</Text>
              </View>

              {digest.bullets.map((b, i) => (
                <Text key={i} className="mb-1 text-sm leading-relaxed text-gray-600">
                  • {b}
                </Text>
              ))}

              {digest.resources.length > 0 && (
                <View className="mt-3 border-t border-gray-100 pt-3">
                  <Text className="mb-1.5 text-xs font-semibold text-gray-500">Resources</Text>
                  {digest.resources.map((r, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => Linking.openURL(r.url).catch(() => {})}
                      className="mb-1">
                      <Text className="text-sm text-violet-600 underline">{r.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {digest.status === 'marked' ? (
                <Text className="mt-3 text-xs text-gray-400">
                  ✓ Marked
                  {digest.updatedAt
                    ? ` ${new Date(digest.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}`
                    : ''}
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={() => markDigest(digest._id).catch(() => {})}
                  className="mt-3 items-center rounded-lg bg-green-600 py-2.5"
                  activeOpacity={0.8}>
                  <Text className="text-sm font-semibold text-white">✓ Got it</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
