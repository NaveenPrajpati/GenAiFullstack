/**
 * Thin network layer for the unified Assistant (supervisor) feature.
 *
 * Targets `${BASE_URL}/assistant`. One endpoint set covers all three skills —
 * including approvals, because a pause belongs to the supervisor thread rather
 * than to the skill that raised it.
 */
import { apiClient } from '@/context/AuthContext';
import { BASE_URL } from '@/services/api';
import type {
  PendingApproval,
  QueryResponse,
  SkillsResponse,
  StreamEvent,
  SupervisorResult,
} from './types';

// BASE_URL already ends with `/api`, so the feature root is `/api/assistant`.
const ASSISTANT = `${BASE_URL}/assistant`;

type Token = string | null | undefined;

export interface QueryBody {
  text: string;
  thread_id?: string;
  /** Optional deep links forwarded to whichever skill needs them. */
  roadmapId?: string;
  plan_id?: string;
}

/** POST /query — non-streaming turn. Returns a result or an approval request. */
export async function query(token: Token, body: QueryBody): Promise<QueryResponse> {
  const res = await apiClient(token).post(`${ASSISTANT}/query`, body);
  return res.data as QueryResponse;
}

/**
 * POST /query/stream — the same turn as Server-Sent Events.
 *
 * Yields `thread` / `step` / `token` / `needs_approval` / `done` / `error` as
 * they arrive. axios cannot read a streaming body in React Native, so this uses
 * `fetch` with the same bearer header. Pass `signal` to cancel mid-flight.
 */
export async function* queryStream(
  token: Token,
  body: QueryBody,
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${ASSISTANT}/query/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Buffer across chunk boundaries so a line split mid-chunk isn't dropped.
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        yield JSON.parse(payload) as StreamEvent;
      } catch {
        // Ignore keep-alive pings / non-JSON lines.
      }
    }
  }
}

/**
 * POST /approve — resolve whatever paused this thread, whichever skill it was.
 * May itself return another approval when a multi-skill turn pauses twice.
 */
export async function approve(
  token: Token,
  threadId: string,
  decision: 'approved' | 'rejected'
): Promise<QueryResponse> {
  const res = await apiClient(token).post(`${ASSISTANT}/approve`, {
    thread_id: threadId,
    decision,
  });
  const data = res.data;
  if (data.status === 'needs_approval') return data as QueryResponse;
  return {
    status: 'done',
    thread_id: threadId,
    result: (data.result ?? {}) as SupervisorResult,
  };
}

/** GET /approvals — everything awaiting a decision, across all skills. */
export async function getApprovals(token: Token): Promise<PendingApproval[]> {
  const res = await apiClient(token).get(`${ASSISTANT}/approvals`);
  return (res.data.result ?? []) as PendingApproval[];
}

/** GET /skills — capability list, including whether the MCP server is up. */
export async function getSkills(token: Token): Promise<SkillsResponse> {
  const res = await apiClient(token).get(`${ASSISTANT}/skills`);
  return res.data.result as SkillsResponse;
}
