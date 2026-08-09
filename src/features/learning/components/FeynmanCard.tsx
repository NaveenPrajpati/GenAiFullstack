/**
 * The Feynman checkpoint: "explain this topic in your own words".
 *
 * Sits beside the multiple-choice checkpoint at the moment a topic is completed
 * — the highest-stakes point, and so the one where a learner is most willing to
 * spend thirty seconds. It is optional and cannot cost them anything: a poor
 * explanation is never recorded against the topic, because an exercise that can
 * lose you progress is one nobody volunteers for. It pays out instead, through
 * the review ladder.
 *
 * Voice-first by way of the keyboard's dictation key rather than a recorder we
 * own: on both platforms that is a one-tap "speak it" with no permission prompt,
 * no upload, and no audio to store. The server takes a transcript either way, so
 * swapping in real speech-to-text later changes only this file.
 */
import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useColors } from '@/components/ui/theme';
import type { ExplanationResult } from '../types';

const VERDICT_TONE: Record<string, string> = {
  solid: 'text-success',
  partial: 'text-warning',
  missing: 'text-ink-faint',
  wrong: 'text-danger',
};

export function FeynmanCard({
  title,
  minWords,
  result,
  busy,
  error,
  onSubmit,
  onDismiss,
}: {
  title: string;
  minWords: number;
  result: ExplanationResult | null;
  busy: boolean;
  error: string;
  onSubmit: (text: string) => void;
  onDismiss: () => void;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const colors = useColors();

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const enough = words >= minWords;

  if (result) return <FeynmanResult result={result} onDismiss={onDismiss} />;

  // Collapsed to a single line until asked for. The checkpoint is the thing that
  // has to be done here; this is the thing worth doing, and putting a text box in
  // front of someone mid-quiz is how an optional exercise becomes an obstacle.
  if (!open) {
    return (
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button">
        <Card className="border-primary/40 mt-3 border-dashed">
          <Text className="text-ink text-[15px] font-semibold">
            🎙 Explain {title} in your own words
          </Text>
          <Text className="text-ink-soft mt-1 text-[13px] leading-relaxed">
            Optional, about 30 seconds. Say it as you would to a friend — do it well and this topic
            won&apos;t come back for review as soon.
          </Text>
        </Card>
      </TouchableOpacity>
    );
  }

  return (
    <Card className="border-primary/40 mt-3">
      <Text className="text-ink text-[15px] font-semibold">
        🎙 Explain {title} in your own words
      </Text>
      <Text className="text-ink-soft mt-1 mb-3 text-[13px] leading-relaxed">
        Tap the mic on your keyboard and just talk. Rambling is fine — this is graded on whether you
        have the idea, not on how it&apos;s phrased.
      </Text>

      <TextInput
        value={text}
        onChangeText={setText}
        editable={!busy}
        multiline
        textAlignVertical="top"
        placeholder="It's basically…"
        placeholderTextColor={colors.inkFaint}
        className="border-line bg-surface text-ink min-h-[120px] rounded-xl border p-3 text-[15px] leading-relaxed"
        accessibilityLabel={`Explain ${title} in your own words`}
      />

      <View className="mt-2 flex-row items-center justify-between">
        <Text className={`text-[11px] ${enough ? 'text-success' : 'text-ink-faint'}`}>
          {words === 0
            ? `about ${minWords} words is plenty`
            : enough
              ? `${words} words — ready`
              : `${words} / ${minWords} words`}
        </Text>
        {!!error && <Text className="text-danger flex-1 pl-3 text-[11px]">{error}</Text>}
      </View>

      <View className="mt-3 flex-row gap-2">
        <Button
          label="Submit"
          full
          disabled={!enough}
          loading={busy}
          loadingLabel="Reading it…"
          onPress={() => onSubmit(text.trim())}
        />
        <Button label="Skip" variant="secondary" onPress={() => setOpen(false)} />
      </View>
    </Card>
  );
}

function FeynmanResult({
  result,
  onDismiss,
}: {
  result: ExplanationResult;
  onDismiss: () => void;
}) {
  // Outcomes they actually got wrong lead; ones they simply didn't mention are
  // listed after, because "you didn't say" and "you said, incorrectly" are
  // different pieces of news and running them together reads as harsher.
  const wrong = result.outcomes.filter((o) => o.verdict === 'wrong');
  const missing = result.outcomes.filter((o) => o.verdict === 'missing');
  const solid = result.outcomes.filter((o) => o.verdict === 'solid');

  return (
    <Card className={`mt-3 ${result.passed ? 'border-success' : 'border-warning'}`}>
      <Text className={`text-[17px] font-bold ${result.passed ? 'text-success' : 'text-warning'}`}>
        {result.passed ? '✓ You can explain it' : `Not quite there — ${result.score}%`}
      </Text>

      {!!result.feedback && (
        <Text className="text-ink-soft mt-1 text-[15px] leading-relaxed">{result.feedback}</Text>
      )}

      {/* The payout, named. An incentive nobody is told about incentivises nothing. */}
      {result.ladder_bonus > 0 && (
        <View className="bg-success-soft mt-3 rounded-xl p-3">
          <Text className="text-success text-[13px] font-semibold">
            🪜 Next review pushed back a step — you earned it by explaining this.
          </Text>
        </View>
      )}

      {solid.length > 0 && (
        <Text className="text-ink-soft mt-3 text-[13px]">
          <Text className="text-success font-semibold">Got across: </Text>
          {solid.map((o) => o.outcome).join(' · ')}
        </Text>
      )}

      {wrong.length > 0 && (
        <View className="mt-2">
          <Text className="text-danger text-[13px] font-semibold">Worth rethinking</Text>
          {wrong.map((o, i) => (
            <Text key={i} className={`mt-0.5 text-[13px] ${VERDICT_TONE[o.verdict]}`}>
              • {o.outcome}
            </Text>
          ))}
        </View>
      )}

      {missing.length > 0 && (
        <Text className="text-ink-faint mt-2 text-[13px]">
          Didn&apos;t come up: {missing.map((o) => o.outcome).join(' · ')}
        </Text>
      )}

      <View className="mt-3">
        <Button label="Done" variant="secondary" onPress={onDismiss} />
      </View>
    </Card>
  );
}
