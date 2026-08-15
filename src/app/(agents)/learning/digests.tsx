import { SectionLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, DashedCard } from '@/components/ui/Card';
import { PageBody } from '@/components/ui/Page';
import ScreenHeader from '@/components/ui/ScreenHeader';
import SectionNav, { useWideNav } from '@/components/ui/SectionNav';
import { useColors } from '@/components/ui/theme';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useLearningStore } from '@/features/learning/store';
import type { Digest, Roadmap, TopicNode } from '@/features/learning/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      className={`rounded-full border px-3.5 py-1.5 ${
        selected ? 'border-primary bg-primary' : 'border-line bg-surface'
      }`}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <Text
        className={`text-[13px] font-semibold ${selected ? 'text-on-primary' : 'text-ink-soft'}`}
        numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** A horizontally scrolling row of chips. Roadmap titles and topic titles are
 *  both arbitrary length, so wrapping them would push the list off-screen. */
function FilterRow({
  options,
  selected,
  onSelect,
}: {
  options: { id: string | null; title: string }[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-3"
      contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
      {options.map((o) => (
        <FilterChip
          key={o.id ?? 'all'}
          label={o.title}
          selected={selected === o.id}
          onPress={() => onSelect(o.id)}
        />
      ))}
    </ScrollView>
  );
}

/**
 * "Today" / "Yesterday" / "Mon 4 Aug" — the heading a digest is filed under.
 *
 * Grouping is by calendar day rather than elapsed hours: a digest sent at 11pm
 * and read at 1am belongs to the day it was written, not to "2 hours ago".
 */
function dayKey(iso: string): string {
  const at = new Date(iso);
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(at)) / 86_400_000);

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return at.toLocaleDateString(undefined, { weekday: 'long' });
  return at.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(at.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  });
}

function groupByDay(digests: Digest[]) {
  const groups: { day: string; items: Digest[] }[] = [];
  for (const d of digests) {
    const day = dayKey(d.createdAt);
    const last = groups[groups.length - 1];
    // The list arrives newest-first, so same-day digests are already adjacent —
    // no map/sort needed, and the server's ordering is preserved exactly.
    if (last?.day === day) last.items.push(d);
    else groups.push({ day, items: [d] });
  }
  return groups;
}

/** One archived digest. Acknowledged ones recede rather than disappear — the
 *  archive's job is to show everything that was sent, read or not. */
function ArchiveCard({
  digest,
  showRoadmap,
  startOpen = false,
  onMark,
  onAnswer,
}: {
  digest: Digest;
  showRoadmap: boolean;
  /** Open on arrival. Set when the screen was deep-linked to one topic: that's
   *  someone sent here to read something specific, not to scan the archive. */
  startOpen?: boolean;
  onMark: () => void;
  /** The archive lists digests; it doesn't sit checks. Sends the learner to the
   *  screen that does. */
  onAnswer: () => void;
}) {
  const [open, setOpen] = useState(startOpen);
  const marked = digest.status === 'marked';
  const date = new Date(digest.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card className={`mb-2.5 ${marked ? 'opacity-70' : ''}`}>
      <TouchableOpacity onPress={() => setOpen((v) => !v)} activeOpacity={0.7}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-ink text-[17px] font-bold">{digest.topicTitle}</Text>
            {/* Which roadmap it came from, since the unfiltered list mixes
                several and topic titles alone don't say. */}
            {showRoadmap && !!digest.roadmapTitle && (
              <Text className="text-ink-faint mt-0.5 text-[13px]" numberOfLines={1}>
                {digest.roadmapTitle}
              </Text>
            )}
          </View>
          <Text className="text-ink-faint text-[13px]">{date}</Text>
        </View>
      </TouchableOpacity>

      {/* Collapsed by default: the archive is scanned far more often than it is
          read, and five open digests bury the sixth. */}
      {open && (
        <View className="mt-3 gap-1.5">
          {digest.bullets.map((b, i) => (
            <View key={i} className="flex-row gap-2">
              <Text className="text-ink-faint text-[15px] leading-relaxed">•</Text>
              <Text className="text-ink-soft flex-1 text-[15px] leading-relaxed">{b}</Text>
            </View>
          ))}

          {digest.resources.length > 0 && (
            <View className="border-line mt-2 border-t pt-2.5">
              {digest.resources.map((r, i) => (
                <TouchableOpacity
                  key={i}
                  disabled={!r.url}
                  onPress={() => r.url && Linking.openURL(r.url).catch(() => {})}
                  activeOpacity={0.7}>
                  <Text className="text-primary mb-0.5 text-[13px] underline" numberOfLines={1}>
                    {r.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      <View className="mt-3 flex-row items-center justify-between gap-2">
        <TouchableOpacity onPress={() => setOpen((v) => !v)} activeOpacity={0.7}>
          <Text className="text-ink-faint text-[13px] font-medium">
            {open ? 'Hide' : `${digest.bullets.length} tips`} {open ? '▴' : '▾'}
          </Text>
        </TouchableOpacity>

        {marked ? (
          <Text className="text-success text-[13px] font-semibold">✓ Acknowledged</Text>
        ) : (digest.quiz?.length ?? 0) > 0 ? (
          // Acknowledging this one means passing its recall check, and the check
          // isn't rendered here. "Got it" could only ever be refused, so it says
          // what to do instead.
          <Button label="Answer the check" size="sm" variant="secondary" onPress={onAnswer} />
        ) : (
          <Button label="Got it" size="sm" onPress={onMark} />
        )}
      </View>
    </Card>
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

  // Seeded from the route so other screens can send a learner to one topic's
  // digests — "go read your revision tips" has to land on the tips, not on a
  // list of everything with them somewhere in it.
  const params = useLocalSearchParams<{ roadmapId?: string; topicId?: string }>();
  const [roadmapId, setRoadmapId] = useState<string | null>(params.roadmapId ?? null);
  const [topicId, setTopicId] = useState<string | null>(params.topicId ?? null);
  // Marking can be refused — the recall check, a digest deleted with its
  // roadmap. Swallowing that left "Got it" doing nothing with no explanation.
  const [markError, setMarkError] = useState('');
  const colors = useColors();
  const wide = useWideNav();

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
  const days = groupByDay(digests);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View className="bg-bg flex-1">
        <ScreenHeader
          title="Daily Digests"
          subtitle="Every AI-curated summary, in one place"
          showMenu={!wide}
          actions={<ThemeToggle />}>
          <SectionNav />
        </ScreenHeader>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
          <PageBody className="pt-3">
            {roadmaps.length > 0 && (
              <FilterRow
                selected={roadmapId}
                onSelect={selectRoadmap}
                options={[
                  { id: null, title: 'All' },
                  ...roadmaps.map((r: Roadmap) => ({ id: r._id, title: r.title })),
                ]}
              />
            )}

            {/* Topics only mean something once a roadmap is picked. */}
            {!!roadmapId && topics.length > 0 && (
              <FilterRow
                selected={topicId}
                onSelect={setTopicId}
                options={[
                  { id: null, title: 'All topics' },
                  ...topics.map((t) => ({ id: t.id, title: t.title })),
                ]}
              />
            )}

            {!!(digestsError || markError) && (
              <View className="border-danger bg-danger-soft mb-3 rounded-xl border p-3">
                <Text className="text-danger text-[13px]">{digestsError || markError}</Text>
              </View>
            )}

            {digestsLoading && (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="text-ink-faint mt-3 text-[13px]">Loading digests…</Text>
              </View>
            )}

            {/* A filtered empty result is a different situation from having no
                digests at all, and offering "enable digests" for it would be wrong. */}
            {!digestsLoading && digests.length === 0 && filtered && (
              <DashedCard className="items-center px-6 py-8">
                <Text className="text-ink mb-1 text-[20px] font-bold">Nothing here yet</Text>
                <Text className="text-ink-soft mb-4 text-center text-[15px] leading-relaxed">
                  No digests have been sent for {topicId ? 'this topic' : 'this roadmap'}.
                </Text>
                <Button
                  label="Clear filter"
                  variant="secondary"
                  onPress={() => selectRoadmap(null)}
                />
              </DashedCard>
            )}

            {!digestsLoading && digests.length === 0 && !filtered && (
              <DashedCard className="items-center px-6 py-10">
                <Text className="mb-2 text-5xl">📰</Text>
                <Text className="text-ink mb-1 text-[20px] font-bold">No digests yet</Text>
                <Text className="text-ink-soft mb-4 text-center text-[15px] leading-relaxed">
                  Turn on daily digests in Settings to start receiving AI-curated summaries.
                </Text>
                <Button label="Open Settings" onPress={() => router.push('/learning/settings')} />
              </DashedCard>
            )}

            {days.map(({ day, items }) => (
              <View key={day} className="mb-2">
                <SectionLabel>{day}</SectionLabel>
                {items.map((digest) => (
                  <ArchiveCard
                    key={digest._id}
                    digest={digest}
                    showRoadmap={!roadmapId}
                    startOpen={!!topicId && digest.status !== 'marked'}
                    onMark={() => {
                      setMarkError('');
                      markDigest(digest._id).catch((e) =>
                        setMarkError(e?.message ?? 'Could not mark that digest.')
                      );
                    }}
                    onAnswer={() => router.push('/learning')}
                  />
                ))}
              </View>
            ))}
          </PageBody>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
