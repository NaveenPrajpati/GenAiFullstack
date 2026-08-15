import { Badge, SectionLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useColors } from '@/components/ui/theme';
import { DigestMarkdown } from '@/features/learning/components/Markdown';
import type { Digest, DigestCheckFailure } from '@/features/learning/types';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Text, TextInput, TouchableOpacity, View } from 'react-native';

function DigestCard({
  digest,
  failure,
  onMark,
  busy,
}: {
  digest: Digest;
  failure?: DigestCheckFailure;
  onMark: (
    answers: { question: number; answer: number }[],
    written: Record<number, string>,
    generateNext: boolean
  ) => void;
  busy: boolean;
}) {
  const router = useRouter();
  const questions = digest.quiz ?? [];
  const [selected, setSelected] = useState<(number | null)[]>([]);
  // Sources are collapsed by default: they're a side door out of the digest,
  // not the thing being read.
  const [showSources, setShowSources] = useState(false);
  const colors = useColors();

  // From the fourth digest one question is answered in a sentence instead of
  // tapped. Kept apart from `selected`, which is indexed by option.
  const [written, setWritten] = useState<Record<number, string>>({});

  useEffect(() => {
    setSelected(new Array(questions.length).fill(null));
    setWritten({});
  }, [digest._id, questions.length]);

  const taps = questions.filter((q) => q.kind !== 'open');
  const answered = selected.filter((s, i) => s !== null && questions[i]?.kind !== 'open').length;
  const writtenDone = questions.every(
    (q, i) => q.kind !== 'open' || (written[i] ?? '').trim().length > 0
  );
  const ready = questions.length === 0 || (answered === taps.length && writtenDone);
  const answers = selected
    .map((a, i) =>
      a !== null && questions[i]?.kind !== 'open' ? { question: i, answer: a } : null
    )
    .filter((x): x is { question: number; answer: number } => x !== null);

  const sources = digest.resources.filter((r) => !!r.url);

  return (
    <Card className="mb-3">
      {/* A re-teach or a revision digest covers ground already sent. Saying so is
          the point of having generated it — unlabelled, it reads as the tutor
          repeating itself. */}
      {digest.kind === 'reteach' && (
        <View className="bg-primary-soft mb-2 self-start rounded-lg px-2.5 py-1">
          <Text className="text-primary text-[11px] font-semibold">
            ✍️ Explained a different way
          </Text>
        </View>
      )}
      {digest.kind === 'revision' && (
        <View className="bg-warning-soft mb-2 self-start rounded-lg px-2.5 py-1">
          <Text className="text-warning text-[11px] font-semibold">
            🔁 Revision before your retry
          </Text>
        </View>
      )}

      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-ink text-[17px] font-bold">{digest.topicTitle}</Text>
          <Text className="text-ink-faint mt-0.5 text-[13px]">
            {digest.roadmapTitle ? `${digest.roadmapTitle} · ` : ''}
            {digest.sequence ? `Digest #${digest.sequence} · ` : ''}
            {new Date(digest.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
        <Badge label={digest.kind === 'revision' ? 'REVISION' : 'NEW'} tone="primary" square />
      </View>

      <View className="mt-3 gap-1.5">
        {digest.bullets.map((b, i) => (
          <View key={i} className="flex-row gap-2">
            <Text className="text-ink-faint text-[15px] leading-relaxed">•</Text>

            {/* `flex-1` sits on a wrapping View, not on the renderer: it needs a
                definite width to wrap against, and a point sized to its own
                content would run past the card on anything long. */}
            <View className="flex-1">
              <DigestMarkdown markdown={b} />
            </View>
          </View>
        ))}
      </View>

      {sources.length > 0 && (
        <View className="mt-3">
          <TouchableOpacity onPress={() => setShowSources((v) => !v)} activeOpacity={0.7}>
            <Text className="text-primary text-[13px] font-semibold">
              {sources.length} source{sources.length === 1 ? '' : 's'} {showSources ? '▾' : '↗'}
            </Text>
          </TouchableOpacity>
          {showSources && (
            <View className="mt-1.5 gap-1">
              {sources.map((r, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => Linking.openURL(r.url).catch(() => {})}
                  activeOpacity={0.7}>
                  <Text className="text-primary text-[13px] underline" numberOfLines={1}>
                    {r.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {questions.length > 0 && (
        <View className="border-line mt-3 border-t pt-3">
          <SectionLabel>Quick check</SectionLabel>
          {questions.map((q, qIdx) => (
            <View key={qIdx} className="mb-2">
              <Text className="text-ink mb-2 text-[15px] font-medium">
                {questions.length > 1 ? `${qIdx + 1}. ` : ''}
                {q.question}
              </Text>

              {/* One sentence, in their own words. It has to be attempted, but
                  being wrong doesn't block the mark — the taps are the gate, and
                  this is here for what it shows about how they're thinking. */}
              {q.kind === 'open' && (
                <>
                  <TextInput
                    value={written[qIdx] ?? ''}
                    onChangeText={(v) => setWritten((prev) => ({ ...prev, [qIdx]: v }))}
                    editable={!busy}
                    multiline
                    textAlignVertical="top"
                    placeholder="In your own words…"
                    placeholderTextColor={colors.inkFaint}
                    className="border-line bg-surface text-ink min-h-[64px] rounded-xl border p-3 text-[15px] leading-relaxed"
                    accessibilityLabel={q.question}
                  />
                  <Text className="text-ink-faint mt-1 text-[11px]">
                    A sentence is plenty — the keyboard mic works too.
                  </Text>
                </>
              )}

              {q.options.map((opt, optIdx) => {
                const isSel = selected[qIdx] === optIdx;
                return (
                  <TouchableOpacity
                    key={optIdx}
                    disabled={busy}
                    onPress={() =>
                      setSelected((prev) => {
                        const next = [...prev];
                        next[qIdx] = optIdx;
                        return next;
                      })
                    }
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSel }}
                    className={`mb-1.5 flex-row items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                      isSel ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
                    }`}
                    activeOpacity={0.7}>
                    <View
                      className={`h-4 w-4 items-center justify-center rounded-full border-2 ${
                        isSel ? 'border-primary' : 'border-line'
                      }`}>
                      {isSel && <View className="bg-primary h-2 w-2 rounded-full" />}
                    </View>
                    <Text className="text-ink flex-1 text-[15px]">{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          {/* Two failures on one check and the agent stops asking them to re-read
              the same tips — it re-explains the material a different way. Saying
              so is the difference between "you keep failing" and "that one's on
              us", and the learner needs to know a new explanation is coming
              rather than grinding the same questions. */}
          {!!failure &&
            (failure.reteaching ? (
              <View className="bg-primary-soft mt-1 rounded-xl p-3">
                <Text className="text-primary text-[13px] font-semibold">
                  ✍️ That one&apos;s on us, not you
                </Text>
                <Text className="text-ink-soft mt-0.5 text-[13px] leading-relaxed">
                  We&apos;re writing this up a different way — it&apos;ll appear in your digests
                  shortly, and the check will follow the new explanation.
                </Text>
              </View>
            ) : (
              <Text className="text-danger text-[13px]">
                {failure.quiz_result.correct}/{failure.quiz_result.total} right — look back over the
                tips and try again.
              </Text>
            ))}
        </View>
      )}

      {digest.coverage_complete && (
        <TouchableOpacity
          onPress={() => router.push(`/learning/${digest.roadmapId}`)}
          className="bg-success-soft mt-3 rounded-xl p-3"
          activeOpacity={0.8}>
          <Text className="text-success text-[13px] font-semibold">
            ✓ That covers this topic — take the checkpoint to complete it →
          </Text>
        </TouchableOpacity>
      )}

      <View className="mt-4 flex-row gap-2.5">
        <Button
          label="Mark"
          variant="secondary"
          onPress={() => onMark(answers, written, false)}
          disabled={!ready}
          loading={busy}
          full
        />
        {/* Generating costs a search and an LLM call, so it stays an explicit
            choice rather than something every acknowledgement triggers. */}
        <Button
          label="Mark & next"
          onPress={() => onMark(answers, written, true)}
          disabled={busy || !ready || digest.coverage_complete}
          full
        />
      </View>
    </Card>
  );
}

export default DigestCard;
