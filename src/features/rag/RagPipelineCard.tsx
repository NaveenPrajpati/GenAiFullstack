import { CheckIcon, XIcon } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { PIPELINE_STEPS, PipelineState, StageStatus } from './ragTypes';

const STATUS_STYLES: Record<
  StageStatus,
  { box: string; badge: string; label: string; sub: string }
> = {
  done: {
    box: 'border-emerald-200 bg-emerald-50/60',
    badge: 'bg-emerald-500',
    label: 'text-emerald-900',
    sub: 'text-emerald-600',
  },
  active: {
    box: 'border-violet-400 bg-violet-50',
    badge: 'bg-violet-600',
    label: 'text-violet-900',
    sub: 'text-violet-600',
  },
  failed: {
    box: 'border-red-200 bg-red-50',
    badge: 'bg-red-500',
    label: 'text-red-900',
    sub: 'text-red-600',
  },
  skipped: {
    box: 'border-gray-200 bg-gray-50',
    badge: 'bg-gray-300',
    label: 'text-gray-500',
    sub: 'text-gray-400',
  },
  pending: {
    box: 'border-gray-200 bg-white',
    badge: 'bg-gray-200',
    label: 'text-gray-400',
    sub: 'text-gray-300',
  },
};

const LEGEND: { label: string; dot: string; status: StageStatus }[] = [
  { label: 'Completed', dot: 'bg-emerald-500', status: 'done' },
  { label: 'In Progress', dot: 'bg-violet-600', status: 'active' },
  { label: 'Skipped', dot: 'bg-gray-300', status: 'skipped' },
  { label: 'Failed', dot: 'bg-red-500', status: 'failed' },
];

export function RagPipelineCard({ pipeline, live }: { pipeline: PipelineState; live: boolean }) {
  return (
    <View className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <View className="mb-3 flex-row items-center gap-2">
        <Text className="text-sm font-bold text-gray-900">RAG Pipeline</Text>
        <Text className="text-xs text-gray-400">{live ? '(Live)' : '(Last run)'}</Text>
        {live && <View className="h-2 w-2 rounded-full bg-violet-600" />}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row items-center">
          {PIPELINE_STEPS.map((step, idx) => {
            const state = pipeline[step.key] ?? { status: 'pending' as StageStatus };
            const s = STATUS_STYLES[state.status];
            return (
              <View key={step.key} className="flex-row items-center">
                <View
                  className={`w-[92px] items-center rounded-xl border px-2 py-3 ${s.box}`}>
                  <View
                    className={`mb-1.5 h-5 w-5 items-center justify-center rounded-full ${s.badge}`}>
                    {state.status === 'done' ? (
                      <CheckIcon size={12} color="#fff" strokeWidth={3} />
                    ) : state.status === 'failed' ? (
                      <XIcon size={12} color="#fff" strokeWidth={3} />
                    ) : (
                      <Text className="text-[10px] font-bold text-white">{idx + 1}</Text>
                    )}
                  </View>
                  <Text className={`text-xs font-semibold ${s.label}`}>{step.label}</Text>
                  <Text numberOfLines={1} className={`mt-0.5 text-[10px] ${s.sub}`}>
                    {state.sub ?? (state.status === 'active' ? 'Running…' : ' ')}
                  </Text>
                </View>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <Text className="px-1 text-gray-300">→</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-1">
        {LEGEND.map((l) => (
          <View key={l.label} className="flex-row items-center gap-1.5">
            <View className={`h-2 w-2 rounded-full ${l.dot}`} />
            <Text className="text-[11px] text-gray-500">{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
