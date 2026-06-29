/**
 * Thin network layer for the Meal Planner feature.
 *
 * Every call goes through the app's existing authenticated axios client
 * (`apiClient(token)` from AuthContext, which attaches `Authorization: Bearer …`)
 * and targets `${BASE_URL}/meal-planner`. No component or store should call axios
 * directly — they call these functions.
 */
import { apiClient } from '@/context/AuthContext';
import { BASE_URL } from '@/services/api';
import type {
  ApprovalDecision,
  ApproveResult,
  ConflictDecision,
  GroceryItem,
  MealSlot,
  MealType,
  PendingApproval,
  Plan,
  QueryResponse,
  StreamEvent,
} from './types';

// BASE_URL already ends with `/api`, so the feature root is `/api/meal-planner`.
const MP = `${BASE_URL}/meal-planner`;

type Token = string | null | undefined;

/**
 * POST /query — free-text turn. May return a `done` result or a `needs_approval`
 * plan proposal. `planId` is required for update/change/redo/modify/regenerate
 * requests (the API 400s without it, 403s on an unknown id).
 */
export async function query(
  token: Token,
  text: string,
  opts: { planId?: string | null; threadId?: string } = {}
): Promise<QueryResponse> {
  const res = await apiClient(token).post(`${MP}/query`, {
    text,
    ...(opts.planId ? { plan_id: opts.planId } : {}),
    ...(opts.threadId ? { thread_id: opts.threadId } : {}),
  });
  return res.data as QueryResponse;
}

/**
 * POST /query/stream — same turn as `query`, streamed as Server-Sent Events.
 * Yields each parsed event (`thread` / `step` / `done` / `needs_approval` /
 * `error`) as it arrives. axios can't read a streaming body in React Native, so
 * this uses `fetch` directly with the same `Authorization: Bearer …` header.
 * Pass `signal` to cancel an in-flight stream.
 */
export async function* queryStream(
  token: Token,
  body: { text: string; plan_id?: string | null; thread_id?: string },
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${MP}/query/stream`, {
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

/** POST /approve — resolve a pending plan/update proposal. */
export async function approve(
  token: Token,
  threadId: string,
  decision: ApprovalDecision
): Promise<ApproveResult> {
  const res = await apiClient(token).post(`${MP}/approve`, {
    thread_id: threadId,
    decision,
  });
  return res.data.result as ApproveResult;
}

/** GET /approve — all pending approvals for the user. */
export async function getApprovals(token: Token): Promise<PendingApproval[]> {
  const res = await apiClient(token).get(`${MP}/approve`);
  return (res.data.result ?? []) as PendingApproval[];
}

/**
 * POST /resolve-conflict — accept the suggested alternative (logs it) or reject
 * it (records a dislike). Returns the logged slot on accept.
 */
export async function resolveConflict(
  token: Token,
  body: {
    plan_id: string;
    recipe: string;
    day_of_week: number;
    meal_type: MealType;
    decision: ConflictDecision;
  }
): Promise<{ status: string; log_status: string; slot?: MealSlot }> {
  const res = await apiClient(token).post(`${MP}/resolve-conflict`, body);
  return res.data;
}

/** GET /plans — the user's weekly meal plans. */
export async function getPlans(token: Token): Promise<Plan[]> {
  const res = await apiClient(token).get(`${MP}/plans`);
  return (res.data.result ?? []) as Plan[];
}

/** GET /meal-slots/{planId} — all slots for a plan. */
export async function getSlots(token: Token, planId: string): Promise<MealSlot[]> {
  const res = await apiClient(token).get(`${MP}/meal-slots/${planId}`);
  return (res.data.slots ?? []) as MealSlot[];
}

/** GET /grocery-list/{planId}. */
export async function getGrocery(token: Token, planId: string): Promise<GroceryItem[]> {
  const res = await apiClient(token).get(`${MP}/grocery-list/${planId}`);
  return (res.data.result ?? []) as GroceryItem[];
}

/** GET /disliked — disliked dish names. */
export async function getDisliked(token: Token): Promise<string[]> {
  const res = await apiClient(token).get(`${MP}/disliked`);
  return (res.data.result ?? []) as string[];
}

/** POST /disliked — add a dish; returns the updated list. */
export async function addDisliked(token: Token, dish: string): Promise<string[]> {
  const res = await apiClient(token).post(`${MP}/disliked`, { dish });
  return (res.data.result ?? []) as string[];
}

/** DELETE /disliked — remove a dish; returns the updated list. */
export async function removeDisliked(token: Token, dish: string): Promise<string[]> {
  const res = await apiClient(token).delete(`${MP}/disliked`, { data: { dish } });
  return (res.data.result ?? []) as string[];
}

/** POST /toggle-trigger — flip the weekly Sun 18:30 auto-plan digest. */
export async function toggleTrigger(token: Token): Promise<void> {
  await apiClient(token).post(`${MP}/toggle-trigger`);
}
