import { BASE_URL } from '@/services/api';
import http, { authedFetch } from '@/services/http';
import type { DigestStatus, NoteKind, ProgressStatus, RoadmapStatus, StreamEvent } from './types';

const LR = `${BASE_URL}/learning`;

/**
 * Every call goes through `http` (axios), which attaches the bearer token and
 * refreshes it once on a 401. The streaming call can't use axios — React Native
 * can't read a streaming axios body — so it uses `authedFetch`, the fetch
 * wrapper with the same token + refresh behavior.
 */

/**
 * POST /query — one chat turn. Resolves to the whole turn at once.
 * May come back as a `needs_approval` proposal or a `needs_input` onboarding
 * prompt instead of a result.
 */
export async function query(body: { text: string; roadmapId?: string; thread_id: string }) {
  const res = await http.post(`/learning/query`, body);
  return res.data;
}

/**
 * POST /query/stream — same turn as `query`, but the answer streams back as
 * Server-Sent Events. Yields each parsed event as it arrives. Pass `signal` to
 * cancel an in-flight stream.
 */
export async function* queryStream(
  body: { text: string; roadmapId?: string; thread_id: string },
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  const res = await authedFetch(`${LR}/query/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

/** POST /approvals — resolve a pending roadmap proposal. */
export async function resolveApproval(body: {
  thread_id: string;
  decision: 'approved' | 'rejected';
}) {
  const res = await http.post(`/learning/approvals`, body);
  return res.data;
}

/**
 * POST /onboarding — answer (or skip) the first-run profile questions and let
 * the paused turn finish. Send `null` to skip; the backend records that
 * onboarding ran either way, so the prompt won't reappear.
 */
export async function submitOnboarding(body: {
  thread_id: string;
  answers: Record<string, string> | null;
}) {
  const res = await http.post(`/learning/onboarding`, body);
  return res.data;
}

/** GET /roadmaps — the user's roadmaps, newest first. Paginated server-side. */
export async function getRoadmaps(params?: {
  status?: RoadmapStatus;
  limit?: number;
  skip?: number;
}) {
  const res = await http.get(`/learning/roadmaps`, { params });
  return res.data;
}

/**
 * GET /stats — progress across all roadmaps, for the landing screen's summary.
 * Separate from /roadmaps because that endpoint is paginated: a global
 * aggregate returned with one page would read as if it described the page.
 */
export async function getStats() {
  const res = await http.get(`/learning/stats`);
  return res.data;
}

/** GET /roadmaps/:id — one roadmap plus its server-computed progress. */
export async function getRoadmap(roadmapId: string) {
  const res = await http.get(`/learning/roadmaps/${roadmapId}`);
  return res.data;
}

/** PATCH /roadmaps/:id — park, resume, or archive a roadmap. Which one is
 *  `active` decides what a bare "what should I study next?" resolves to. */
export async function updateRoadmapStatus(roadmapId: string, status: RoadmapStatus) {
  const res = await http.patch(`/learning/roadmaps/${roadmapId}`, { status });
  return res.data;
}

/**
 * DELETE /roadmaps/:id — remove a roadmap and everything stored against it:
 * digests, notes, quizzes, graded attempts, misconception analysis.
 *
 * Irreversible. `updateRoadmapStatus(id, 'archived')` is the reversible way to
 * put a roadmap down. Linked to-dos in the personal assistant are left alone and
 * come back as `result.linked_tasks`.
 */
export async function deleteRoadmap(roadmapId: string) {
  const res = await http.delete(`/learning/roadmaps/${roadmapId}`);
  return res.data;
}

/** GET /focus — what's underway and when the next digest is due. */
export async function getFocus() {
  const res = await http.get(`/learning/focus`);
  return res.data;
}

/**
 * POST /progress — set a topic's progress.
 *
 * `status` is the full vocabulary (in_progress, needs_review, skipped, …).
 * `covered` is the original boolean and is still accepted, mapping to
 * completed / not_started.
 */
export async function submitProgress(body: {
  roadmapId: string;
  topicId: string;
  status?: ProgressStatus;
  covered?: boolean;
  mastery_score?: number;
}) {
  const res = await http.post(`/learning/progress`, body);
  return res.data;
}

/**
 * POST /topics/:topicId/checkpoint — issue the active-recall check for a topic.
 * Answers are never sent to the client; grading happens server-side.
 */
export async function startCheckpoint(topicId: string, roadmapId: string, regenerate = false) {
  const res = await http.post(`/learning/topics/${topicId}/checkpoint`, {
    roadmapId,
    regenerate,
  });
  return res.data;
}

/**
 * POST /topics/:topicId/explain — the Feynman checkpoint.
 *
 * Optional and never a gate: a poor explanation costs nothing. Passing buys an
 * extra rung of the review ladder, and the judgement feeds the misconception
 * tracker with something no multiple-choice answer can give.
 *
 * `source` says whether the text was dictated. The server takes a transcript
 * either way, so swapping the device keyboard's mic for real speech-to-text is
 * a client-side change with no contract to renegotiate.
 */
export async function explainTopic(
  topicId: string,
  body: { roadmapId: string; text: string; source?: 'text' | 'voice' }
) {
  const res = await http.post(`/learning/topics/${topicId}/explain`, body);
  return res.data;
}

/** POST /checkpoint/submit — grade it. Passing is what completes the topic. */
export async function submitCheckpoint(
  quizId: string,
  answers: { question: number; answer: number }[]
) {
  const res = await http.post(`/learning/checkpoint/submit`, { quizId, answers });
  return res.data;
}

/**
 * GET /misconceptions — recurring mistakes inferred from the learner's wrong
 * answers across digest checks, checkpoints and reviews. Cached server-side;
 * the analysis runs after each graded attempt, never on this request.
 */
export async function getMisconceptions(roadmapId?: string) {
  const res = await http.get(`/learning/misconceptions`, {
    params: roadmapId ? { roadmapId } : undefined,
  });
  return res.data;
}

/** GET /reviews — topics whose spaced-repetition review has come due. */
export async function getReviews(limit = 20) {
  const res = await http.get(`/learning/reviews`, { params: { limit } });
  return res.data;
}

/** POST /submit-quiz — grade a quiz attempt. */
export async function submitQuiz(body: {
  quizId: string;
  answers: { question: number; answer: number }[];
}) {
  const res = await http.post(`/learning/submit-quiz`, body);
  return res.data;
}

/**
 * GET /notes — what the learner has written down, newest first.
 * Unfiltered this is the consolidated view; scoped to a topic it backs the
 * notes section on the roadmap screen.
 */
export async function getNotes(params?: {
  roadmapId?: string;
  topicId?: string;
  kind?: NoteKind;
  limit?: number;
  skip?: number;
}) {
  const res = await http.get(`/learning/notes`, { params });
  return res.data;
}

/** POST /notes — jot a note, snippet, link, or question against a topic. */
export async function createNote(body: {
  roadmapId: string;
  topicId: string;
  kind: NoteKind;
  body: string;
  url?: string;
}) {
  const res = await http.post(`/learning/notes`, body);
  return res.data;
}

/** PATCH /notes/:id — edit the text, or tick off a question. */
export async function updateNote(
  noteId: string,
  body: { body?: string; url?: string; resolved?: boolean }
) {
  const res = await http.patch(`/learning/notes/${noteId}`, body);
  return res.data;
}

/** DELETE /notes/:id */
export async function deleteNote(noteId: string) {
  const res = await http.delete(`/learning/notes/${noteId}`);
  return res.data;
}

/**
 * GET /digests — recent topic digests.
 *
 * `{ status: 'unread', active_only: true }` is the catch-up queue.
 * `roadmapId` and then `topicId` narrow the archive; both are filtered in the
 * query, so `limit` stays "the newest N of what you asked for".
 */
export async function getDigests(params?: {
  status?: DigestStatus;
  active_only?: boolean;
  limit?: number;
  roadmapId?: string;
  topicId?: string;
}) {
  const res = await http.get(`/learning/digests`, {
    params: { limit: 20, ...params },
  });
  return res.data;
}

/**
 * POST /digests/:id/mark — acknowledge one; returns what's next in the queue.
 *
 * `answers` is required when the digest carries a recall check (every digest
 * after the first on a topic); a wrong set comes back as 422 with the grading.
 * `generate_next` pulls the following digest in the same step.
 */
export async function markDigest(
  digestId: string,
  body: {
    answers?: { question: number; answer: number }[];
    /** Typed answers to `open` questions, keyed by position. Required when the
     *  check carries one — a blank is refused, a wrong one is not. */
    written?: Record<number, string>;
    generate_next?: boolean;
  } = {}
) {
  const res = await http.post(`/learning/digests/${digestId}/mark`, {
    answers: body.answers ?? [],
    written: body.written ?? {},
    generate_next: body.generate_next ?? false,
  });
  return res.data;
}

/** POST /digests/generate — pull the next digest now instead of waiting for the
 *  daily sweep. Declines with 409 if the current topic already has an unread one. */
export async function generateDigest(roadmapId?: string, topicId?: string) {
  const res = await http.post(`/learning/digests/generate`, null, {
    params: { roadmapId, topicId },
  });
  return res.data;
}

/** GET /memory — the user's learning profile. */
export async function getMemory() {
  const res = await http.get(`/learning/memory`);
  return res.data;
}

/** PUT /memory — update the learning profile. */
export async function saveMemory(data: Record<string, unknown>) {
  const res = await http.put(`/learning/memory`, { data });
  return res.data;
}

/** DELETE /memory — clear the learning profile. */
export async function deleteMemory() {
  const res = await http.delete(`/learning/memory`);
  return res.data;
}

/** GET /triggers — current state of the user's auto-triggers (e.g. daily digest). */
export async function getTriggers() {
  const res = await http.get(`/learning/triggers`);
  return res.data;
}

/** POST /toggle-trigger — flip the daily digest auto-trigger. */
export async function toggleTrigger() {
  const res = await http.post(`/learning/toggle-trigger`);
  return res.data;
}

/**
 * PATCH /trigger-settings — update the daily digest's enabled flag, send hour,
 * and/or timezone. Upserts, so it works even before the first toggle. The
 * backend validates the hour range and the timezone (zoneinfo).
 */
export async function updateTriggerSettings(body: {
  enabled?: boolean;
  schedule_hour?: number;
  timezone?: string;
}) {
  const res = await http.patch(`/learning/trigger-settings`, body);
  return res.data;
}
