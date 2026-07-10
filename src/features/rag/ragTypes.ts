export interface RagSource {
  citation: number;
  chunk_text: string;
  source: string;
  page_number: number | null;
  confidence_score: number | null;
  doc_id: string;
}

export interface RagEvaluation {
  retrieval_precision?: number;
  recall_score?: number;
  hallucination_rate?: number;
}

export type StageStatus = 'pending' | 'active' | 'done' | 'failed' | 'skipped';

export interface StageState {
  status: StageStatus;
  sub?: string;
}

export type PipelineState = Record<string, StageState>;

export const PIPELINE_STEPS: { key: string; label: string }[] = [
  { key: 'embed', label: 'Embed' },
  { key: 'cache', label: 'Cache' },
  { key: 'retrieve', label: 'Retrieve' },
  { key: 'rerank', label: 'Rerank' },
  { key: 'gate', label: 'Gate' },
  { key: 'stream', label: 'Stream' },
  { key: 'persist', label: 'Persist' },
];

export const initialPipeline = (): PipelineState =>
  Object.fromEntries(PIPELINE_STEPS.map((s) => [s.key, { status: 'pending' as StageStatus }]));

export interface QueryMeta {
  question?: string;
  startedAt?: number;
  durationMs?: number;
  /** Total server-side pipeline time from the `done` event (excludes network). */
  serverMs?: number | null;
  grounded?: boolean;
  cached?: boolean;
  cited?: number[];
  evaluation?: RagEvaluation | null;
  chatId?: string | null;
  sources?: RagSource[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  meta?: QueryMeta;
}
