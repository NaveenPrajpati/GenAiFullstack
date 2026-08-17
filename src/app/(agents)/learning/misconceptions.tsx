import { SectionLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, DashedCard } from '@/components/ui/Card';
import { PageBody } from '@/components/ui/Page';
import ScreenHeader from '@/components/ui/ScreenHeader';
import SectionNav, { useWideNav } from '@/components/ui/SectionNav';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useLearningStore } from '@/features/learning/store';
import type { MisconceptionReport } from '@/features/learning/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * What the learner keeps getting wrong, and why it looks that way.
 *
 * Inferred from their wrong answers across digest recall checks, checkpoints and
 * reviews — a wrong multiple-choice answer says which option someone tapped, but
 * several of them together say what they believe. This screen is the only place
 * that reading is visible; everywhere else it works invisibly, steering what the
 * digests teach and what the next checkpoint asks.
 *
 * Read-only on purpose. The analysis runs server-side after each graded attempt,
 * and a "re-analyse" button would offer the learner a way to spend an LLM call on
 * evidence that hasn't changed.
 *
 * `probe` — how a future question will catch each misunderstanding — is stripped
 * by the API and never arrives here. A learner who reads it knows what's coming.
 */

/** One inferred misunderstanding. The label leads; the detail is the part worth
 *  reading, so it isn't hidden behind a tap. */
function PatternRow({ label, detail }: { label: string; detail: string }) {
  return (
    <View className="border-line mt-2.5 border-t pt-2.5">
      <View className="flex-row gap-2">
        <Text className="text-warning text-[15px] leading-relaxed">•</Text>
        <View className="flex-1">
          <Text className="text-ink text-[15px] font-semibold">{label}</Text>
          <Text className="text-ink-soft mt-0.5 text-[13px] leading-relaxed">{detail}</Text>
        </View>
      </View>
    </View>
  );
}

/** Everything inferred about one topic. */
function TopicCard({ entry, onOpen }: { entry: MisconceptionReport; onOpen: () => void }) {
  return (
    <Card className="mb-3">
      <TouchableOpacity onPress={onOpen} activeOpacity={0.7} accessibilityRole="button">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-ink text-[17px] font-bold">
              {entry.topicTitle ?? 'This topic'}
            </Text>
            {!!entry.roadmapTitle && (
              <Text className="text-ink-faint mt-0.5 text-[13px]" numberOfLines={1}>
                {entry.roadmapTitle}
              </Text>
            )}
          </View>
          <Text className="text-ink-faint text-[13px]">→</Text>
        </View>
      </TouchableOpacity>

      {entry.patterns.map((p, i) => (
        <PatternRow key={i} label={p.label} detail={p.detail} />
      ))}

      {/* Says where this came from, so it doesn't read as the app having formed
          an opinion out of nowhere. */}
      <Text className="text-ink-faint mt-2.5 text-[13px]">
        From {entry.misses_analyzed} wrong answer{entry.misses_analyzed === 1 ? '' : 's'} across
        your checks on this topic
      </Text>
    </Card>
  );
}

export default function MisconceptionsScreen() {
  const router = useRouter();
  const { misconceptions, misconceptionsLoading, fetchMisconceptions, roadmaps, fetchRoadmaps } =
    useLearningStore();
  const [roadmapId, setRoadmapId] = useState<string | null>(null);
  const wide = useWideNav();

  useFocusEffect(
    useCallback(() => {
      fetchRoadmaps();
      fetchMisconceptions(roadmapId ?? undefined);
    }, [roadmapId])
  );

  const patternCount = misconceptions.reduce((n, m) => n + m.patterns.length, 0);
  const filtering = !!roadmapId;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }} className="bg-bg">
      <ScreenHeader
        title="What's tripping you up"
        subtitle={
          patternCount > 0
            ? `${patternCount} pattern${patternCount === 1 ? '' : 's'} across ${
                misconceptions.length
              } topic${misconceptions.length === 1 ? '' : 's'}`
            : 'Spotted from your wrong answers'
        }
        showMenu={!wide}
        right={<ThemeToggle />}>
        <SectionNav />

        {/* Only worth offering once there's more than one roadmap to separate. */}
        {roadmaps.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-2"
            contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
            {[{ _id: null, title: 'All' }, ...roadmaps].map((r) => {
              const selected = roadmapId === r._id;
              return (
                <TouchableOpacity
                  key={r._id ?? 'all'}
                  onPress={() => setRoadmapId(r._id)}
                  className={`rounded-full border px-3.5 py-1.5 ${
                    selected ? 'border-primary bg-primary' : 'border-line bg-surface'
                  }`}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}>
                  <Text
                    className={`text-[13px] font-semibold ${
                      selected ? 'text-on-primary' : 'text-ink-soft'
                    }`}
                    numberOfLines={1}>
                    {r.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </ScreenHeader>

      <ScrollView className="flex-1">
        <PageBody>
          {misconceptionsLoading && misconceptions.length === 0 && (
            <View className="items-center py-12">
              <ActivityIndicator size="large" />
            </View>
          )}

          {!misconceptionsLoading && misconceptions.length === 0 && (
            <DashedCard className="items-center p-8">
              <Text className="mb-2 text-4xl">🎯</Text>
              <Text className="text-ink mb-1 text-[17px] font-bold">
                {filtering ? 'Nothing here' : 'Nothing to report'}
              </Text>
              {/* An empty result here is good news, and has to read that way —
                  an insight screen that looks broken when you're doing well is
                  worse than no screen. */}
              <Text className="text-ink-soft mb-4 text-center text-[15px] leading-relaxed">
                {filtering
                  ? 'No recurring mistakes on this roadmap.'
                  : "Nothing you've got wrong so far points at a recurring misunderstanding. This fills in as you take more checks."}
              </Text>
              {filtering && (
                <Button
                  label="Show all roadmaps"
                  variant="secondary"
                  onPress={() => setRoadmapId(null)}
                />
              )}
            </DashedCard>
          )}

          {misconceptions.length > 0 && (
            <>
              <Card className="border-primary/40 mb-3 border-dashed">
                <Text className="text-ink-soft text-[13px] leading-relaxed">
                  These come from the answers you got wrong, not from anything you said. Your
                  digests already explain against them, and later checkpoints come back to them — so
                  this is a record of what&apos;s being worked on, not a to-do list.
                </Text>
              </Card>

              <SectionLabel>By topic</SectionLabel>
              {misconceptions.map((entry) => (
                <TopicCard
                  key={`${entry.roadmapId}:${entry.topicId}`}
                  entry={entry}
                  onOpen={() => router.push(`/learning/${entry.roadmapId}`)}
                />
              ))}
            </>
          )}
        </PageBody>
      </ScrollView>
    </SafeAreaView>
  );
}
