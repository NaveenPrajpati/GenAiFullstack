import { User } from '@/context/AuthContext';
import { ChevronDownIcon, ChevronUpIcon, FileTextIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { QueryMeta, RagEvaluation, RagSource } from './ragTypes';

function Card({ title, badge, children }: { title: string; badge?: string; children: any }) {
  return (
    <View className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <View className="mb-3 flex-row items-center gap-1.5">
        <Text className="text-sm font-bold text-gray-900">{title}</Text>
        {badge ? <Text className="text-xs text-gray-400">{badge}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="text-xs text-gray-500">{label}</Text>
      <Text
        numberOfLines={1}
        className={`ml-3 flex-1 text-right text-xs font-medium text-gray-800 ${
          mono ? 'font-mono' : ''
        }`}>
        {value}
      </Text>
    </View>
  );
}

const EVAL_METRICS: { key: keyof RagEvaluation; label: string; dot: string; bar: string }[] = [
  {
    key: 'retrieval_precision',
    label: 'retrieval_precision',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
  },
  { key: 'recall_score', label: 'recall_score', dot: 'bg-blue-500', bar: 'bg-blue-500' },
  {
    key: 'hallucination_rate',
    label: 'hallucination_rate',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
  },
];

export function RagInsightsPanel({
  sources,
  meta,
  evaluation,
  user,
  selectedCount,
  evaluate,
  onPressSource,
}: {
  sources: RagSource[];
  meta: QueryMeta | null;
  evaluation: RagEvaluation | null;
  user: User | null;
  selectedCount: number;
  evaluate: boolean;
  onPressSource: (s: RagSource) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sources : sources.slice(0, 5);
  const cited = meta?.cited ?? [];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
      {/* Top Sources */}
      <Card title="Top Sources">
        {sources.length === 0 ? (
          <Text className="py-2 text-xs text-gray-400">
            Sources will appear here after you ask a question.
          </Text>
        ) : (
          <View className="gap-1">
            {visible.map((s, i) => {
              const isCited = cited.includes(s.citation);
              return (
                <TouchableOpacity
                  key={`${s.doc_id}-${s.citation}-${i}`}
                  onPress={() => onPressSource(s)}
                  activeOpacity={0.7}
                  className={`flex-row items-center gap-2.5 rounded-xl px-2 py-2 ${
                    isCited ? 'bg-violet-50' : ''
                  }`}>
                  <View
                    className={`h-6 w-6 items-center justify-center rounded-lg ${
                      isCited ? 'bg-violet-600' : 'bg-violet-100'
                    }`}>
                    <Text
                      className={`text-[11px] font-bold ${
                        isCited ? 'text-white' : 'text-violet-700'
                      }`}>
                      {s.citation}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text numberOfLines={1} className="text-xs font-semibold text-gray-800">
                      {s.source}
                    </Text>
                    <Text numberOfLines={1} className="text-[10px] text-gray-400">
                      {s.page_number != null ? `page ${s.page_number}` : 'source passage'}
                    </Text>
                  </View>
                  {s.confidence_score != null && (
                    <Text className="text-xs font-semibold text-gray-500">
                      {s.confidence_score.toFixed(2)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
            {sources.length > 5 && (
              <TouchableOpacity
                onPress={() => setShowAll((v) => !v)}
                className="mt-2 flex-row items-center justify-center gap-1 rounded-xl border border-gray-200 py-2">
                <Text className="text-xs font-medium text-gray-600">
                  {showAll ? 'Show Less' : `View All Sources (${sources.length})`}
                </Text>
                {showAll ? (
                  <ChevronUpIcon size={14} color="#4b5563" />
                ) : (
                  <ChevronDownIcon size={14} color="#4b5563" />
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </Card>

      {/* Query Details */}
      <Card title="Query Details">
        <DetailRow label="User" value={user?.name || user?.email || 'guest'} />
        <DetailRow
          label="Scope"
          value={
            selectedCount > 0
              ? `${selectedCount} selected doc${selectedCount > 1 ? 's' : ''}`
              : 'All documents'
          }
        />
        <DetailRow label="Evaluate" value={evaluate ? 'On' : 'Off'} />
        {meta?.chatId ? <DetailRow label="Chat ID" value={meta.chatId} mono /> : null}
        {meta?.cached != null && <DetailRow label="Cached" value={meta.cached ? 'Yes' : 'No'} />}
        {meta?.grounded != null && (
          <DetailRow label="Grounded" value={meta.grounded ? 'Yes' : 'No'} />
        )}
        {meta?.durationMs != null && (
          <DetailRow label="Latency (client)" value={`${(meta.durationMs / 1000).toFixed(2)}s`} />
        )}
        {meta?.serverMs != null && (
          <DetailRow label="Server time" value={`${(meta.serverMs / 1000).toFixed(2)}s`} />
        )}
        {meta?.startedAt != null && (
          <DetailRow label="Created At" value={new Date(meta.startedAt).toLocaleString()} />
        )}
      </Card>

      {/* Evaluation */}
      <Card title="Evaluation" badge="(Optional)">
        {!evaluation ? (
          <Text className="py-2 text-xs text-gray-400">
            {evaluate
              ? 'Metrics will appear after the next answer.'
              : 'Turn on Evaluate in the composer to score answers.'}
          </Text>
        ) : (
          <View className="gap-2.5">
            {EVAL_METRICS.map((m) => {
              const val = evaluation[m.key];
              if (val == null) return null;
              return (
                <View key={m.key}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1.5">
                      <View className={`h-2 w-2 rounded-full ${m.dot}`} />
                      <Text className="text-xs text-gray-600">{m.label}</Text>
                    </View>
                    <Text className="text-xs font-bold text-gray-800">{val.toFixed(2)}</Text>
                  </View>
                  <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <View
                      className={`h-full rounded-full ${m.bar}`}
                      style={{ width: `${Math.min(100, Math.max(0, val * 100))}%` }}
                    />
                  </View>
                </View>
              );
            })}
            <View className="mt-1 flex-row items-center gap-1.5">
              <FileTextIcon size={12} color="#9ca3af" />
              <Text className="flex-1 text-[10px] text-gray-400">
                LLM-judged metrics — treat as directional signals.
              </Text>
            </View>
          </View>
        )}
      </Card>
    </ScrollView>
  );
}
