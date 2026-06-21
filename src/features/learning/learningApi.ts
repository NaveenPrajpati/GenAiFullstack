import { apiClient } from '@/context/AuthContext';
import { BASE_URL } from '@/services/api';
import type { StreamEvent } from './types';

const LR = `${BASE_URL}/learning`;

type Token = string | null | undefined;

/**
 * POST /query/stream — same turn as `query`, but the answer streams back as
 * Server-Sent Events. Yields each parsed event as it arrives.
 *
 * axios can't read a streaming body in React Native, so this uses `fetch`
 * directly and attaches the same `Authorization: Bearer …` header `apiClient`
 * would. Pass `signal` to cancel an in-flight stream.
 */
export async function* queryStream(
  token: Token,
  body: { text: string; roadmapId?: string; thread_id: string },
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${LR}/query/stream`, {
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

/** GET /roadmaps — the user's roadmaps. */
export async function getRoadmaps(token: Token) {
  const res = await apiClient(token).get(`${LR}/roadmaps`);
  return res.data;
}

/** POST /progress — mark a topic covered/uncovered. */
export async function submitProgress(
  token: Token,
  body: { roadmapId: string; topicId: string; covered: boolean }
) {
  const res = await apiClient(token).post(`${LR}/progress`, body);
  return res.data;
}

/** POST /query — free-text chat turn; may return a `needs_approval` proposal. */
export async function query(
  token: Token,
  body: { text: string; roadmapId?: string; thread_id: string }
) {
  const res = await apiClient(token).post(`${LR}/query`, body);
  return res.data;
}

/** POST /approvals — resolve a pending roadmap proposal. */
export async function resolveApproval(
  token: Token,
  body: { thread_id: string; decision: 'approved' | 'rejected' }
) {
  const res = await apiClient(token).post(`${LR}/approvals`, body);
  return res.data;
}

/** POST /submit-quiz — grade a quiz attempt. */
export async function submitQuiz(
  token: Token,
  body: { quizId: string; answers: { question: number; answer: number }[] }
) {
  const res = await apiClient(token).post(`${LR}/submit-quiz`, body);
  return res.data;
}

/** GET /digests — recent topic digests. */
export async function getDigests(token: Token, limit = 20) {
  const res = await apiClient(token).get(`${LR}/digests?limit=${limit}`);
  return res.data;
}

/** GET /memory — the user's learning profile. */
export async function getMemory(token: Token) {
  const res = await apiClient(token).get(`${LR}/memory`);
  return res.data;
}

/** PUT /memory — update the learning profile. */
export async function saveMemory(token: Token, data: Record<string, unknown>) {
  const res = await apiClient(token).put(`${LR}/memory`, { data });
  return res.data;
}

/** DELETE /memory — clear the learning profile. */
export async function deleteMemory(token: Token) {
  const res = await apiClient(token).delete(`${LR}/memory`);
  return res.data;
}

/** POST /toggle-trigger — flip the daily digest auto-trigger. */
export async function toggleTrigger(token: Token) {
  const res = await apiClient(token).post(`${LR}/toggle-trigger`);
  return res.data;
}
