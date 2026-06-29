/**
 * Shared API & domain types for the Personal Assistant feature.
 * Mirrors the backend contract at `${BASE_URL}/personal-assistant`.
 */

export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'done';
export type Recurrence = 'daily' | 'weekly' | 'monthly';

export interface Task {
  id: string;
  title: string;
  details?: string;
  priority: Priority;
  due_at?: string; // ISO date string
  recurrence?: Recurrence;
  parent_id?: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface Note {
  content: string;
  category?: string;
  created_at: string;
}

export interface MemoryItem {
  key: string;
  value: string;
}

/** Agenda buckets — the shape embedded in both /tasks/agenda and AgentResult.agenda. */
export interface AgendaBuckets {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  no_date: Task[];
}

export interface AgendaCounts {
  overdue: number;
  today: number;
  upcoming: number;
  no_date: number;
}

export interface Agenda {
  counts: AgendaCounts;
  buckets: AgendaBuckets;
}

export interface ResearchResult {
  summary: string;
  key_points: string[];
  sources: string[];
}

export interface TaskStats {
  total: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
}

/** Free-text agent reply. Every field but `response` is optional / intent-dependent. */
export interface AgentResult {
  response: string;
  intent?: string;
  task_status?: string;
  todos?: Task[];
  subtasks?: Task[];
  agenda?: AgendaBuckets;
  notes?: Note[];
  research?: ResearchResult;
  suggestions?: string[];
}

/** Human-in-the-loop delete proposal returned by POST /query. */
export interface DeleteProposal {
  type: 'pa_delete_task';
  approval_id: string;
  tasks: { id: string; title: string }[];
}

export type QueryResponse =
  | { status: 'done'; result: AgentResult }
  | { status: 'needs_approval'; thread_id: string; proposal: DeleteProposal };

/**
 * SSE event from POST /personal-assistant/query/stream. The PA graph uses
 * structured output (no text tokens), so streaming surfaces per-node `step`
 * progress, then a terminal `done` result or `needs_approval` proposal.
 */
export interface StreamEvent {
  /** 'thread' | 'step' | 'done' | 'needs_approval' | 'error' (others ignored). */
  type: string;
  node?: string;
  thread_id?: string;
  result?: AgentResult;
  proposal?: DeleteProposal;
  message?: string;
  [key: string]: unknown;
}

/** Loosely-typed: GET /approve returns a mix of digests and pending delete approvals. */
export interface PendingApproval {
  id?: string;
  thread_id?: string;
  type?: string;
  title?: string;
  status?: string;
  created_at?: string;
  tasks?: { id: string; title: string }[];
  [key: string]: unknown;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: Priority;
}

export type TaskPatch = Partial<Pick<Task, 'title' | 'details' | 'priority' | 'due_at' | 'status'>>;

/** A single rendered chat turn. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  /** Natural-language text — `result.response` for assistant turns. */
  text: string;
  /** Rich payload that drives card rendering (assistant turns only). */
  result?: AgentResult;
  /** Present when this turn is an inline HITL delete confirmation. */
  approval?: DeleteProposal;
  /** Set once a HITL approval has been resolved, to lock the card. */
  resolved?: 'approved' | 'rejected';
  isError?: boolean;
  /** True while a transient progress bubble is streaming step updates. */
  streaming?: boolean;
}
