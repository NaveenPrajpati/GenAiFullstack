/**
 * Thin network layer for the Personal Assistant feature.
 *
 * Every call goes through the app's existing authenticated axios client
 * (`apiClient(token)` from AuthContext, which attaches `Authorization: Bearer …`)
 * and targets `${BASE_URL}/personal-assistant`. No component or store should
 * call axios directly — they call these functions.
 */
import { apiClient } from '@/context/AuthContext';
import { BASE_URL } from '@/services/api';
import type {
  Agenda,
  AgentResult,
  MemoryItem,
  Note,
  PendingApproval,
  QueryResponse,
  Task,
  TaskFilters,
  TaskPatch,
  TaskStats,
} from './types';

// BASE_URL already ends with `/api`, so the feature root is `/api/personal-assistant`.
const PA = `${BASE_URL}/personal-assistant`;

type Token = string | null | undefined;

/** POST /query — free-text turn. May return a done result or a HITL proposal. */
export async function query(token: Token, text: string, threadId?: string): Promise<QueryResponse> {
  const res = await apiClient(token).post(`${PA}/query`, {
    text,
    ...(threadId ? { thread_id: threadId } : {}),
  });
  return res.data as QueryResponse;
}

/** POST /approve — resolve a pending HITL delete proposal. */
export async function approve(
  token: Token,
  threadId: string,
  decision: 'approved' | 'rejected'
): Promise<AgentResult> {
  const res = await apiClient(token).post(`${PA}/approve`, {
    thread_id: threadId,
    decision,
  });
  return res.data.result as AgentResult;
}

/** GET /approve — inbox of digests + pending approvals. */
export async function getApprovals(token: Token): Promise<PendingApproval[]> {
  const res = await apiClient(token).get(`${PA}/approve`);
  return (res.data.result ?? []) as PendingApproval[];
}

/** GET /tasks — optionally filtered by status / priority. */
export async function getTasks(token: Token, filters: TaskFilters = {}): Promise<Task[]> {
  const params: Record<string, string> = {};
  if (filters.status) params.status = filters.status;
  if (filters.priority) params.priority = filters.priority;
  const res = await apiClient(token).get(`${PA}/tasks`, { params });
  return (res.data.result ?? []) as Task[];
}

/** GET /tasks/agenda — bucketed overdue/today/upcoming/no_date with counts. */
export async function getAgenda(token: Token): Promise<Agenda> {
  const res = await apiClient(token).get(`${PA}/tasks/agenda`);
  return res.data.result as Agenda;
}

/** GET /tasks/stats — totals by status & priority. */
export async function getStats(token: Token): Promise<TaskStats> {
  const res = await apiClient(token).get(`${PA}/tasks/stats`);
  return res.data.result as TaskStats;
}

/** GET /tasks/{id} */
export async function getTask(token: Token, id: string): Promise<Task> {
  const res = await apiClient(token).get(`${PA}/tasks/${id}`);
  return res.data.result as Task;
}

/** GET /tasks/{id}/subtasks */
export async function getSubtasks(token: Token, id: string): Promise<Task[]> {
  const res = await apiClient(token).get(`${PA}/tasks/${id}/subtasks`);
  return (res.data.result ?? []) as Task[];
}

/** PUT /tasks/{id} */
export async function updateTask(token: Token, id: string, patch: TaskPatch): Promise<Task> {
  const res = await apiClient(token).put(`${PA}/tasks/${id}`, patch);
  return res.data.result as Task;
}

/** DELETE /tasks/{id} */
export async function deleteTask(token: Token, id: string): Promise<void> {
  await apiClient(token).delete(`${PA}/tasks/${id}`);
}

/** POST /toggle-trigger — flip the daily 8am digest. Returns the new enabled state. */
export async function toggleTrigger(token: Token): Promise<boolean> {
  const res = await apiClient(token).post(`${PA}/toggle-trigger`);
  return Boolean(res.data.enabled);
}

/** GET /notes */
export async function getNotes(token: Token): Promise<Note[]> {
  const res = await apiClient(token).get(`${PA}/notes`);
  return (res.data.result ?? []) as Note[];
}

/** POST /notes */
export async function addNote(token: Token, content: string, category?: string): Promise<Note> {
  const res = await apiClient(token).post(`${PA}/notes`, {
    content,
    ...(category ? { category } : {}),
  });
  return res.data.result as Note;
}

/** GET /memory — recallable personal facts. */
export async function getMemory(token: Token): Promise<MemoryItem[]> {
  const res = await apiClient(token).get(`${PA}/memory`);
  return (res.data.result ?? []) as MemoryItem[];
}
