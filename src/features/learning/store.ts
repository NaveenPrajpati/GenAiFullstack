/**
 * Single Zustand store for the Learning Tracker feature.
 *
 * Auth note: nothing here (or in `learningApi`) handles tokens. Every request
 * goes through the `http` axios instance, whose interceptor attaches the bearer
 * token and refreshes it on a 401.
 *
 * All network access is delegated to `learningApi` — no axios/fetch here.
 */
import { create } from 'zustand';
import { isOfflineError } from '../../services/http';
import { loadOutbox, loadSnapshot, saveOutbox, type QueuedMark } from './cache';
import * as api from './learningApi';
import { syncDigestWidget } from './widgets/sync';
import type {
  Briefing,
  ChatMessage,
  ChatResultData,
  Checkpoint,
  CheckpointBlocked,
  CheckpointOutcome,
  Digest,
  DigestCheckFailure,
  DigestMarkResult,
  DigestStatus,
  DueReview,
  LearningFocus,
  LearningNote,
  ExplanationResult,
  LearningStats,
  Memory,
  MisconceptionReport,
  NoteKind,
  OnboardingPrompt,
  PracticeDeck,
  PracticeResult,
  ProgressStatus,
  Proposal,
  QuizQuestion,
  QuizResult,
  Roadmap,
  RoadmapInsights,
  SelectedTopic,
  Trigger,
} from './types';

/** "Try again in 12 min" / "…tomorrow at 09:00" — a refusal has to say when. */
function retryHint(at?: string): string {
  if (!at) return '';
  const mins = Math.round((new Date(at).getTime() - Date.now()) / 60_000);
  if (mins <= 0) return '';
  if (mins < 60) return `Try again in ${mins} min.`;
  const when = new Date(at).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Try again ${when}.`;
}

const genId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/** Maps a structured turn `result` into the bubble's display text + `data`. Pure. */
function interpretResult(result: any): { content: string; msgData: ChatResultData } {
  if (result?.intent === 'explain') {
    const content = result.topic_explaination ?? '';
    return { content, msgData: { intent: 'explain', topic_explaination: content } };
  }
  // The fallback agent answers greetings, capability questions, and anything
  // off-scope. It writes prose into the same field the tutor uses.
  if (result?.intent === 'chitchat' || result?.intent === 'fallback') {
    const content = result.topic_explaination ?? '';
    return { content, msgData: { type: 'plain', text: content } };
  }
  if (result?.intent === 'take_action') {
    const content = result.topic_explaination ?? 'Done.';
    return {
      content,
      msgData: {
        intent: 'take_action',
        text: content,
        actions_taken: result.actions_taken ?? [],
      },
    };
  }
  if (result?.intent === 'quiz') {
    return {
      content: 'Here is a quiz for you!',
      msgData: { intent: 'quiz', quiz: result.quiz ?? [], quizId: result.quizId ?? '' },
    };
  }
  if (result?.intent === 'submit_quiz') {
    const r = result.quiz_result;
    return {
      content: r ? `You scored ${r.correct}/${r.total}.` : "I couldn't find that quiz.",
      msgData: r
        ? { intent: 'submit_quiz', quiz_result: r }
        : { type: 'plain', text: "I couldn't find a quiz to grade." },
    };
  }
  if (result?.intent === 'find_resources') {
    return {
      content: 'Here are some resources:',
      msgData: { intent: 'find_resources', suggestions: result.suggestions ?? [] },
    };
  }
  if (result?.intent === 'query_roadmap') {
    if (!result.progress?.total) {
      return {
        content: "You don't have a roadmap yet. Ask me to build one!",
        msgData: { type: 'plain', text: "You don't have a roadmap yet. Ask me to build one!" },
      };
    }
    return {
      // The coached sentence leads when there is one: it's the answer to what
      // they asked, and "Next topic: X" is the label on the card below it.
      content: result.guidance?.trim() || `Next topic: ${result.next_topic}`,
      msgData: {
        intent: 'query_roadmap',
        next_topic: result.next_topic,
        progress: result.progress,
        guidance: result.guidance,
      },
    };
  }
  if (result?.intent === 'update_progress') {
    return {
      content: result.log_status === 'updated' ? 'Progress updated!' : 'Topic not found.',
      msgData: {
        intent: 'update_progress',
        log_status: result.log_status,
        roadmap: result.roadmap,
      },
    };
  }
  const content = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  return { content, msgData: { type: 'plain', text: content } };
}

/**
 * Maps ANY turn response into what the bubble should show: a finished result, a
 * roadmap awaiting approval, or the onboarding questions.
 *
 * Every path goes through here — the first message, a stream event, and the
 * resume that follows onboarding. That last one matters: answering onboarding
 * runs straight into roadmap generation, so it comes back as an approval pause.
 * Handling that only in `sendChatMessage` is what made the very first turn of a
 * session render raw JSON instead of the roadmap card.
 */
function interpretTurn(
  data: any,
  fallbackThreadId: string
): { content: string; msgData: ChatResultData } {
  const kind = data?.status ?? data?.type;

  if (kind === 'needs_input') {
    return {
      content: 'Before we start, tell me a little about how you learn.',
      msgData: {
        type: 'onboarding',
        prompt: {
          questions: data.proposal?.questions ?? [],
          skippable: data.proposal?.skippable,
          threadId: data.thread_id ?? fallbackThreadId,
        },
      },
    };
  }

  if (kind === 'needs_approval' || kind === 'approval') {
    return {
      content: "I've prepared a roadmap for you. Please review it below.",
      msgData: {
        type: 'approval_request',
        proposal: {
          type: data.proposal?.type,
          approvalId: data.proposal?.approvalId,
          roadmap: data.proposal?.roadmap,
          threadId: data.thread_id ?? fallbackThreadId,
        },
      },
    };
  }

  return interpretResult(data?.result ?? data);
}

type LearningState = {
  roadmaps: Roadmap[];
  roadmapsLoading: boolean;
  roadmapsError: string;
  fetchRoadmaps: () => Promise<void>;
  optimisticUpdateTopic: (roadmapId: string, topicId: string, status: ProgressStatus) => void;
  submitProgress: (roadmapId: string, topicId: string, status: ProgressStatus) => Promise<void>;
  /** Park, resume, or archive. Rejects with the server's message when resuming
   *  would exceed the active cap, so the caller can show it verbatim. */
  setRoadmapStatus: (roadmapId: string, status: Roadmap['status']) => Promise<void>;
  /** Delete a roadmap and everything stored against it. Irreversible — the
   *  caller is responsible for confirming first. Resolves to the number of
   *  linked to-dos left behind in the personal assistant. */
  removeRoadmap: (roadmapId: string) => Promise<number>;

  stats: LearningStats | null;
  fetchStats: () => Promise<void>;

  reviews: DueReview[];
  fetchReviews: () => Promise<void>;

  /** What the learner keeps getting wrong, inferred from their attempt history.
   *  Read-only — the analysis runs server-side after each graded attempt. */
  misconceptions: MisconceptionReport[];
  misconceptionsLoading: boolean;
  fetchMisconceptions: (roadmapId?: string) => Promise<void>;

  /** Profile-derived extras per roadmap, keyed by id. Separate from `roadmaps`
   *  because it's derived server-side and refreshes on different triggers. */
  insights: Record<string, RoadmapInsights>;
  fetchInsights: (roadmapId: string) => Promise<void>;

  /** One list, filtered by the caller. The topic notes section and the
   *  consolidated view are the same query with different scopes. */
  notes: LearningNote[];
  notesLoading: boolean;
  fetchNotes: (params?: { roadmapId?: string; topicId?: string; kind?: NoteKind }) => Promise<void>;
  addNote: (note: {
    roadmapId: string;
    topicId: string;
    kind: NoteKind;
    body: string;
    url?: string;
  }) => Promise<void>;
  toggleNoteResolved: (noteId: string) => Promise<void>;
  removeNote: (noteId: string) => Promise<void>;

  /** The checkpoint currently open in a topic card, keyed by topic id. */
  checkpoint: Checkpoint | null;
  checkpointLoading: boolean;
  checkpointOutcome: CheckpointOutcome | null;
  checkpointError: string;
  /** A refused attempt — the revision gate, the cooldown, the daily cap. Kept
   *  apart from `checkpointError` and tagged with the topic it belongs to,
   *  because a refusal means no checkpoint opens, and the card that would have
   *  shown the error never mounts. Without this the learner taps and nothing
   *  happens at all. */
  checkpointBlocked: (CheckpointBlocked & { topicId: string }) | null;
  startCheckpoint: (topicId: string, roadmapId: string, regenerate?: boolean) => Promise<void>;
  submitCheckpoint: (
    answers: { question: number; answer: number }[]
  ) => Promise<CheckpointOutcome | null>;
  closeCheckpoint: () => void;

  /** The topic tapped on the roadmap screen; scopes the chat panel's actions. */
  selectedTopic: SelectedTopic | null;
  setSelectedTopic: (topic: SelectedTopic | null) => void;

  /**
   * Whether the tutor panel is open, and anything queued to say on its behalf.
   *
   * Lived in the panel's own state until the briefing needed to open it: an
   * action like "ask me to explain this" has to reach a component that isn't its
   * parent and isn't on the same screen. `chatPrompt` is one-shot — the panel
   * sends it and clears it, so re-opening later doesn't re-ask.
   */
  chatOpen: boolean;
  chatPrompt: string | null;
  openChat: (prompt?: string) => void;
  closeChat: () => void;
  consumeChatPrompt: () => string | null;

  chatMessages: ChatMessage[];
  chatThreadId: string;
  chatLoading: boolean;
  chatError: string;
  pendingProposal: Proposal | null;
  /** Which bubble holds the live proposal, so it can be switched to a
   *  confirmation once the decision lands instead of offering the buttons again. */
  pendingProposalMessageId: string | null;
  pendingOnboarding: OnboardingPrompt | null;
  sendChatMessage: (text: string, roadmapId?: string, stream?: boolean) => Promise<void>;
  /** Side effects of a rendered turn (pending proposal, quiz, roadmap refresh). */
  applyTurnEffects: (msgData: ChatResultData, messageId: string | null) => void;
  /** Renders a turn that arrived from resuming a paused run. */
  appendTurn: (data: any) => void;
  resolveProposal: (decision: 'approved' | 'rejected') => Promise<string | undefined>;
  resolveOnboarding: (answers: Record<string, string> | null) => Promise<void>;
  resetChat: () => void;

  /** The mixed-topic practice deck, and how it went. Kept apart from `activeQuiz`
   *  — that one is a chat-issued quiz on a single topic, and the two differ in
   *  what they're scored against and where they're taken. */
  practice: PracticeDeck | null;
  practiceResult: PracticeResult | null;
  practiceLoading: boolean;
  practiceError: string;
  startPractice: () => Promise<PracticeDeck | null>;
  submitPractice: (answers: { question: number; answer: number }[]) => Promise<void>;
  clearPractice: () => void;

  activeQuiz: { questions: QuizQuestion[]; quizId: string } | null;
  quizResult: QuizResult | null;
  setActiveQuiz: (quiz: QuizQuestion[], quizId: string) => void;
  submitQuiz: (quizId: string, answers: { question: number; answer: number }[]) => Promise<void>;
  clearQuiz: () => void;

  digests: Digest[];
  digestsLoading: boolean;
  digestsError: string;
  /** The digest archive. `roadmapId`/`topicId` narrow it server-side. */
  fetchDigests: (params?: {
    status?: DigestStatus;
    active_only?: boolean;
    limit?: number;
    roadmapId?: string;
    topicId?: string;
  }) => Promise<void>;
  /** Outstanding digests across active roadmaps — the catch-up queue. */
  unreadDigests: Digest[];
  fetchUnreadDigests: () => Promise<void>;
  /** What's underway and when the next digest is due. */
  focus: LearningFocus | null;
  fetchFocus: () => Promise<void>;

  /** The assistant's read on what to do next. Server-generated per situation,
   *  so refetching on focus is cheap — see `getBriefing`. */
  briefing: Briefing | null;
  briefingLoading: boolean;
  fetchBriefing: () => Promise<void>;
  markDigest: (
    digestId: string,
    opts?: {
      answers?: { question: number; answer: number }[];
      /** Typed answers to open questions, keyed by position. */
      written?: Record<number, string>;
      generateNext?: boolean;
    }
  ) => Promise<DigestMarkResult>;
  /** The offline half of `markDigest`: bank the mark locally and owe it to the
   *  server. Rejects when the digest cannot be honoured without a connection —
   *  see the implementation for which ones those are. Not called directly by
   *  screens; `markDigest` routes here when the request never lands. */
  queueMark: (
    digestId: string,
    opts: {
      answers?: { question: number; answer: number }[];
      written?: Record<number, string>;
      generateNext?: boolean;
    }
  ) => Promise<DigestMarkResult>;
  /** Submit a Feynman explanation. Optional and never a gate — resolves to the
   *  judgement, rejects only when the call itself failed. */
  explainTopic: (
    topicId: string,
    body: { roadmapId: string; text: string; source?: 'text' | 'voice' }
  ) => Promise<ExplanationResult>;
  /** Grading of the last failed recall check, keyed by digest id, so the card
   *  can show what was wrong without the store owning per-card state. */
  digestQuizFailures: Record<string, DigestCheckFailure>;
  generatingDigest: boolean;
  digestError: string;
  generateNextDigest: (roadmapId?: string, topicId?: string) => Promise<Digest | null>;

  memory: Memory | null;
  memoryLoading: boolean;
  fetchMemory: () => Promise<void>;
  saveMemory: (data: Partial<Memory>) => Promise<void>;
  deleteMemory: () => Promise<void>;

  digestEnabled: boolean;
  digestHour: number;
  digestTimezone: string;
  digestLoading: boolean;
  digestSaving: boolean;
  fetchTriggers: () => Promise<void>;
  toggleDigest: () => Promise<void>;
  saveTriggerSettings: (body: { schedule_hour?: number; timezone?: string }) => Promise<void>;

  /* ─── offline cache ─── */

  /** False until the on-disk snapshot has been read. Screens use it to tell
   *  "nothing to show" apart from "nothing loaded yet" — the two look identical
   *  in an empty store and want opposite empty states. */
  hydrated: boolean;
  /** When the snapshot hydrated from disk was written, if there was one. Says
   *  how old the cached content is; on its own it does *not* mean the screen is
   *  stale — pair it with `reachedServer`. */
  cacheSavedAt: string | null;
  /** True once any request has come back this session. The two flags are
   *  separate because either can happen first: a fetch can land before the disk
   *  read finishes, and collapsing them into one field made a live-but-empty
   *  Today indistinguishable from a cached one. */
  reachedServer: boolean;
  /** Marks made offline, oldest first, mirrored to disk on every change. */
  pendingMarks: QueuedMark[];
  /** Reads the snapshot and the outbox into the store. Safe to call more than
   *  once; it never overwrites state a fetch has already filled. */
  hydrateFromCache: () => Promise<void>;
  /** Replays the outbox against the server, oldest first. Resolves to how many
   *  marks are still queued afterwards. */
  flushPendingMarks: () => Promise<number>;
};

/** The daily-digest trigger out of a `{ result: Trigger[] }` GET /triggers response. */
function findDigest(triggers: Trigger[]): Trigger | undefined {
  return triggers.find((t) => t.action_type === 'learning_digest');
}

/** Best-effort device IANA timezone, used as the default before any is saved. */
const deviceTimezone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
})();

/** In-flight outbox drain, if any. Module-scoped rather than store state: it is
 *  a concurrency guard, and putting it in the store would re-render every
 *  subscriber twice per flush to say nothing they can use. */
let flushing: Promise<number> | null = null;

export const useLearningStore = create<LearningState>((set, get) => ({
  roadmaps: [],
  roadmapsLoading: false,
  roadmapsError: '',
  fetchRoadmaps: async () => {
    set({ roadmapsLoading: true, roadmapsError: '' });
    try {
      const data = await api.getRoadmaps();
      set({ roadmaps: data.result ?? [], reachedServer: true });
    } catch (e: any) {
      set({ roadmapsError: e?.response?.data?.detail ?? 'Failed to load roadmaps' });
    } finally {
      set({ roadmapsLoading: false });
    }
  },
  optimisticUpdateTopic: (roadmapId, topicId, status) => {
    set((s) => ({
      roadmaps: s.roadmaps.map((r) =>
        r._id === roadmapId
          ? {
              ...r,
              topics: r.topics.map((t) => {
                if (t.id === topicId) return { ...t, progress_status: status };
                // Starting a topic is a swap, not a set — the server hands the
                // slot over in one write (`start_topic`), so mirroring only the
                // tapped topic left the roadmap showing two things underway
                // until something happened to refetch it.
                if (status === 'in_progress' && t.progress_status === 'in_progress') {
                  return { ...t, progress_status: 'not_started' as const };
                }
                return t;
              }),
            }
          : r
      ),
    }));
  },
  submitProgress: async (roadmapId, topicId, status) => {
    // The whole list, because starting a topic moves two of them.
    const previous = get().roadmaps.find((r) => r._id === roadmapId)?.topics;
    get().optimisticUpdateTopic(roadmapId, topicId, status);
    try {
      await api.submitProgress({ roadmapId, topicId, status });
      // "This week" is derived server-side from completed_at, so it only moves
      // once the write lands. Refreshing here is what makes that counter feel
      // live — without it it sits at its old value
      // until the learner happens to return to the landing screen, which reads
      // as though the tracker isn't recording anything. (The streak comes from
      // marked digests, not from this.) Not awaited: the tick should feel
      // instant.
      get().fetchStats();
    } catch {
      if (previous) {
        set((s) => ({
          roadmaps: s.roadmaps.map((r) => (r._id === roadmapId ? { ...r, topics: previous } : r)),
        }));
      }
      throw new Error('Failed to update progress');
    }
  },
  setRoadmapStatus: async (roadmapId, status) => {
    try {
      await api.updateRoadmapStatus(roadmapId, status);
    } catch (e: any) {
      // 409 is the active-roadmap cap, and its detail is an object carrying the
      // message plus which roadmaps hold the slots. Anything else is a string.
      const detail = e?.response?.data?.detail;
      throw new Error(
        (typeof detail === 'string' ? detail : detail?.message) ?? 'Could not change that roadmap.'
      );
    }
    set((s) => ({
      roadmaps: s.roadmaps.map((r) => (r._id === roadmapId ? { ...r, status } : r)),
    }));
    // Both are keyed off which roadmaps are active: the summary counts them and
    // the home screen shows one card each. Leaving them stale is what makes a
    // pause look like it didn't take.
    get().fetchStats();
    get().fetchFocus();
  },

  removeRoadmap: async (roadmapId) => {
    let linked = 0;
    try {
      const data = await api.deleteRoadmap(roadmapId);
      linked = data?.result?.linked_tasks ?? 0;
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      throw new Error(
        (typeof detail === 'string' ? detail : detail?.message) ?? 'Could not delete that roadmap.'
      );
    }
    // Drop it locally rather than refetching the list: the row should go the
    // moment the server confirms, not a round trip later.
    set((s) => ({
      roadmaps: s.roadmaps.filter((r) => r._id !== roadmapId),
      // Its digests went with it server-side; leaving them queued here would
      // offer the learner tips for a roadmap that no longer exists.
      unreadDigests: s.unreadDigests.filter((d) => d.roadmapId !== roadmapId),
      digests: s.digests.filter((d) => d.roadmapId !== roadmapId),
      reviews: s.reviews.filter((r) => r.roadmapId !== roadmapId),
    }));
    syncDigestWidget(get().unreadDigests);
    get().fetchStats();
    get().fetchFocus();
    return linked;
  },

  stats: null,
  fetchStats: async () => {
    try {
      const data = await api.getStats();
      set({ stats: data.result ?? null, reachedServer: true });
    } catch {
      // The summary strip is decorative — a failure here must not take the
      // roadmap list down with it.
    }
  },

  misconceptions: [],
  misconceptionsLoading: false,
  fetchMisconceptions: async (roadmapId) => {
    set({ misconceptionsLoading: true });
    try {
      const data = await api.getMisconceptions(roadmapId);
      set({ misconceptions: data.result ?? [] });
    } catch {
      // An insight screen that can't load is a blank screen, not a broken app —
      // the empty state already reads as "nothing to show yet".
      set({ misconceptions: [] });
    } finally {
      set({ misconceptionsLoading: false });
    }
  },

  reviews: [],
  fetchReviews: async () => {
    try {
      const data = await api.getReviews();
      set({ reviews: data.result ?? [], reachedServer: true });
    } catch {
      // Surfacing reviews is additive; never let it break the screen.
    }
  },

  insights: {},
  fetchInsights: async (roadmapId) => {
    try {
      const r = await api.getRoadmap(roadmapId).then((d) => d.result);
      set((s) => ({
        insights: {
          ...s.insights,
          [roadmapId]: {
            forecast: r.forecast ?? null,
            personalization: r.personalization ?? null,
            profile_changes: r.profile_changes ?? [],
            current_personalization: r.current_personalization ?? {},
            note_counts: r.note_counts ?? {},
            topic_mastery: r.topic_mastery ?? {},
          },
        },
      }));
    } catch {
      // Derived extras — the roadmap itself renders fine without them.
    }
  },

  notes: [],
  notesLoading: false,
  fetchNotes: async (params) => {
    set({ notesLoading: true });
    try {
      const data = await api.getNotes(params);
      set({ notes: data.result ?? [] });
    } catch {
      // Leave whatever is on screen rather than blanking the list.
    } finally {
      set({ notesLoading: false });
    }
  },
  addNote: async (note) => {
    const data = await api.createNote(note);
    // Prepend rather than refetch: the list is newest-first, and a note the
    // learner just typed should appear the instant they save it.
    set((s) => ({ notes: [data.result, ...s.notes] }));
    // The per-topic badge counts live with the roadmap insights.
    get().fetchInsights(note.roadmapId);
  },
  toggleNoteResolved: async (noteId) => {
    const note = get().notes.find((n) => n._id === noteId);
    if (!note) return;
    const resolved = !note.resolved;
    set((s) => ({
      notes: s.notes.map((n) => (n._id === noteId ? { ...n, resolved } : n)),
    }));
    try {
      await api.updateNote(noteId, { resolved });
    } catch {
      set((s) => ({
        notes: s.notes.map((n) => (n._id === noteId ? { ...n, resolved: !resolved } : n)),
      }));
    }
  },
  removeNote: async (noteId) => {
    const previous = get().notes;
    const note = previous.find((n) => n._id === noteId);
    set({ notes: previous.filter((n) => n._id !== noteId) });
    try {
      await api.deleteNote(noteId);
      if (note) get().fetchInsights(note.roadmapId);
    } catch {
      set({ notes: previous });
    }
  },

  checkpoint: null,
  checkpointLoading: false,
  checkpointOutcome: null,
  checkpointError: '',
  checkpointBlocked: null,
  startCheckpoint: async (topicId, roadmapId, regenerate = false) => {
    set({
      checkpointLoading: true,
      checkpointError: '',
      checkpointBlocked: null,
      checkpointOutcome: null,
    });
    try {
      const data = await api.startCheckpoint(topicId, roadmapId, regenerate);
      set({ checkpoint: { ...data.result, roadmapId } });
    } catch (e: any) {
      // A refusal here carries an OBJECT detail — 429 for the cooldown or the
      // daily cap, 409 while revision is owed. Assigning it straight to a string
      // field put an object where a <Text> child was expected.
      const detail = e?.response?.data?.detail;
      const blocked: CheckpointBlocked | null =
        detail && typeof detail === 'object' ? detail : null;
      set({
        // Tagged with the topic and kept apart from `checkpointError`: a refusal
        // opens no checkpoint, so the card that would have shown the error never
        // mounts. Computing this and then not storing it is what made tapping
        // "take the checkpoint" do nothing visible at all.
        checkpointBlocked: blocked
          ? {
              ...blocked,
              topicId,
              // The refusal has to say when. Folded into the message so the card
              // renders one sentence rather than reaching for a formatter.
              message: [blocked.message, retryHint(blocked.retry_at)].filter(Boolean).join(' '),
            }
          : null,
        // The set on screen belongs to the attempt that was just refused. Left
        // mounted, its Submit button still posts the old quizId — answering a
        // refusal by grading the very set the refusal was protecting.
        checkpoint: null,
        checkpointError: blocked
          ? ''
          : ((typeof detail === 'string' ? detail : null) ??
            'Could not load the checkpoint. Try again.'),
      });
    } finally {
      set({ checkpointLoading: false });
    }
  },
  submitCheckpoint: async (answers) => {
    const checkpoint = get().checkpoint;
    if (!checkpoint) return null;
    set({ checkpointLoading: true, checkpointError: '' });
    try {
      const data = await api.submitCheckpoint(checkpoint.quizId, answers);
      const outcome: CheckpointOutcome = data.result;
      set({ checkpointOutcome: outcome });

      // The checkpoint is the only thing that can complete a topic, so its
      // result is what moves the roadmap — reflect it locally, then refresh the
      // derived counters (streak, this week, reviews due) from the server.
      get().optimisticUpdateTopic(
        checkpoint.roadmapId,
        checkpoint.topicId,
        outcome.progress_status
      );

      // A failure opened a revision debt server-side. Carried onto the local
      // topic or `revisionOwed` keeps reading false: the card goes on offering a
      // retry, the server goes on refusing it, and the learner is told to revise
      // by nothing at all.
      if (outcome.needs_revision) {
        set((s) => ({
          roadmaps: s.roadmaps.map((r) =>
            r._id === checkpoint.roadmapId
              ? {
                  ...r,
                  topics: r.topics.map((t) =>
                    t.id === checkpoint.topicId
                      ? {
                          ...t,
                          checkpoint_attempts: (t.checkpoint_attempts ?? 0) + 1,
                          weak_points: outcome.weak_points ?? t.weak_points,
                        }
                      : t
                  ),
                }
              : r
          ),
        }));
      }
      // Completing a topic closes whatever it still had waiting. Pulled again
      // rather than filtered locally: the server decides what closed, and the
      // refetch re-syncs the home-screen widget with it.
      if (outcome.digests_closed) get().fetchUnreadDigests();
      get().fetchStats();
      get().fetchReviews();
      // The forecast counts remaining minutes, so finishing a topic moves the
      // target date — refresh it with everything else the write derives.
      get().fetchInsights(checkpoint.roadmapId);
      // Passing hands the in-progress slot to the next topic server-side; the
      // local copy has to be refetched or the roadmap shows nothing underway.
      if (outcome.advanced_to) get().fetchRoadmaps();
      return outcome;
    } catch (e: any) {
      // 409 refuses a set that has already been graded, and its detail is an
      // object. Assigning one of those straight to a string field is how an
      // object ends up as a <Text> child.
      const detail = e?.response?.data?.detail;
      set({
        checkpointError:
          (typeof detail === 'string' ? detail : detail?.message) ??
          'Could not grade that. Try again.',
        // A graded set is spent. Leaving it on screen invites the learner to
        // change an answer and press Submit again, which is the loop the server
        // just closed.
        ...(detail?.blocked_reason === 'already_graded' ? { checkpoint: null } : {}),
      });
      return null;
    } finally {
      set({ checkpointLoading: false });
    }
  },
  closeCheckpoint: () =>
    set({
      checkpoint: null,
      checkpointOutcome: null,
      checkpointError: '',
      checkpointBlocked: null,
    }),

  explainTopic: async (topicId, body) => {
    try {
      const data = await api.explainTopic(topicId, body);
      // The topic now carries the ladder credit; reflect it so the card can stop
      // offering the exercise it has already been given.
      if (data?.result?.passed) {
        set((s) => ({
          roadmaps: s.roadmaps.map((r) =>
            r._id === body.roadmapId
              ? {
                  ...r,
                  topics: r.topics.map((t) =>
                    t.id === topicId
                      ? { ...t, feynman_passed: true, feynman_score: data.result.score }
                      : t
                  ),
                }
              : r
          ),
        }));
      }
      return data.result as ExplanationResult;
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      throw new Error(
        (typeof detail === 'string' ? detail : detail?.message) ??
          "Couldn't read that just now — try again shortly."
      );
    }
  },

  selectedTopic: null,
  setSelectedTopic: (topic) => set({ selectedTopic: topic }),

  chatOpen: false,
  chatPrompt: null,
  openChat: (prompt) => set({ chatOpen: true, chatPrompt: prompt ?? null }),
  closeChat: () => set({ chatOpen: false }),
  consumeChatPrompt: () => {
    const prompt = get().chatPrompt;
    if (prompt) set({ chatPrompt: null });
    return prompt;
  },

  chatMessages: [],
  chatThreadId: genId(),
  chatLoading: false,
  chatError: '',
  pendingProposal: null,
  pendingProposalMessageId: null,
  pendingOnboarding: null,
  sendChatMessage: async (text, roadmapId, stream = false) => {
    const threadId = get().chatThreadId;
    set((s) => ({
      chatMessages: [...s.chatMessages, { id: genId(), role: 'user', content: text }],
      chatLoading: true,
      chatError: '',
    }));

    // The assistant bubble is created lazily on the first event so the loading
    // spinner shows until something actually arrives. `patch` updates it in place.
    let assistantId: string | null = null;
    const ensureAssistant = () => {
      if (assistantId) return;
      assistantId = genId();
      const id = assistantId;
      set((s) => ({
        chatLoading: false,
        chatMessages: [...s.chatMessages, { id, role: 'assistant', content: '', streaming: true }],
      }));
    };
    const patch = (p: Partial<ChatMessage>) =>
      set((s) => ({
        chatMessages: s.chatMessages.map((m) => (m.id === assistantId ? { ...m, ...p } : m)),
      }));

    // Renders whatever the turn produced — result, approval, or onboarding —
    // and applies its side effects. One path for streaming and non-streaming.
    const applyTurn = (event: any) => {
      ensureAssistant();
      const { content, msgData } = interpretTurn(event, threadId);
      patch({ content, data: msgData, streaming: false });
      get().applyTurnEffects(msgData, assistantId);
    };

    try {
      const body = { text, ...(roadmapId ? { roadmapId } : {}), thread_id: threadId };

      // Non-streaming path: one POST /query that returns the whole turn at once.
      if (!stream) {
        applyTurn(await api.query(body));
        return;
      }

      let streamedText = '';
      let handledStructured = false;

      for await (const event of api.queryStream(body)) {
        // The pause events carry their kind in `type`, matching /query's `status`.
        if (event.type === 'token') {
          ensureAssistant();
          streamedText += event.token ?? '';
          patch({ content: streamedText });
        } else if (
          event.type === 'needs_input' ||
          event.type === 'needs_approval' ||
          event.type === 'approval' ||
          event.type === 'done' ||
          event.type === 'result' ||
          event.result
        ) {
          handledStructured = true;
          applyTurn(event);
        } else if (event.type === 'error') {
          throw new Error(event.message ?? event.detail ?? 'Stream error');
        }
      }

      // Pure token stream (e.g. a plain explanation) with no structured event:
      // finalize the accumulated text as a plain bubble.
      if (!handledStructured) {
        ensureAssistant();
        patch({ data: { type: 'plain', text: streamedText }, streaming: false });
      }
    } catch (e: any) {
      const errText =
        e?.response?.data?.detail ?? e?.message ?? 'Something went wrong. Please try again.';
      ensureAssistant();
      patch({ content: errText, streaming: false });
      set({ chatError: errText });
    } finally {
      set({ chatLoading: false });
    }
  },
  applyTurnEffects: (msgData, messageId) => {
    if ('type' in msgData && msgData.type === 'approval_request') {
      set((s) => ({
        pendingProposal: msgData.proposal,
        pendingProposalMessageId: messageId,
        chatThreadId: msgData.proposal.threadId ?? s.chatThreadId,
      }));
    } else if ('type' in msgData && msgData.type === 'onboarding') {
      set((s) => ({
        pendingOnboarding: msgData.prompt,
        chatThreadId: msgData.prompt.threadId ?? s.chatThreadId,
      }));
    } else if ('intent' in msgData && msgData.intent === 'take_action') {
      // The tutor changed something server-side, so whatever it touched is now
      // stale on screen. Driven off the tool names rather than refetching
      // everything: a saved note shouldn't cost a roadmap re-read, and the
      // briefing is the one thing every action invalidates — its whole subject is
      // the situation that just moved.
      const ran = new Set(msgData.actions_taken);
      const refresh = get();
      if (ran.size > 0) refresh.fetchBriefing();
      if (ran.has('start_topic')) {
        refresh.fetchRoadmaps();
        refresh.fetchFocus();
      }
      if (ran.has('pull_next_lesson')) {
        refresh.fetchUnreadDigests();
        refresh.fetchFocus();
      }
      if (ran.has('pause_roadmap') || ran.has('resume_roadmap')) {
        refresh.fetchRoadmaps();
        refresh.fetchStats();
        refresh.fetchFocus();
      }
      if (ran.has('save_note')) refresh.fetchNotes();
      if (ran.has('set_digest_time')) {
        refresh.fetchTriggers();
        refresh.fetchFocus();
      }
    } else if ('intent' in msgData && msgData.intent === 'quiz') {
      set({ activeQuiz: { questions: msgData.quiz, quizId: msgData.quizId } });
    } else if ('intent' in msgData && msgData.intent === 'submit_quiz') {
      set({ quizResult: msgData.quiz_result });
    } else if ('intent' in msgData && msgData.intent === 'update_progress' && msgData.roadmap) {
      const updated = msgData.roadmap;
      set((s) => ({
        roadmaps: s.roadmaps.map((r) => (r._id === updated._id ? updated : r)),
      }));
    }
  },
  /** Appends a turn that arrived outside `sendChatMessage` — i.e. from resuming
   *  a paused run — as a new assistant bubble. */
  appendTurn: (data) => {
    const { content, msgData } = interpretTurn(data, get().chatThreadId);
    const id = genId();
    set((s) => ({
      chatMessages: [...s.chatMessages, { id, role: 'assistant', content, data: msgData }],
    }));
    get().applyTurnEffects(msgData, id);
  },
  resolveProposal: async (decision) => {
    const proposal = get().pendingProposal;
    if (!proposal) return undefined;
    const messageId = get().pendingProposalMessageId;

    const data = await api.resolveApproval({ thread_id: proposal.threadId, decision });
    const savedRoadmapId = data.result?.roadmapId as string | undefined;
    // The server parks a new roadmap when the active slots are full, and reports
    // it on the saved model's own status rather than in a separate flag.
    const savedParked = data.result?.roadmap?.status === 'paused';

    // Switch the card that raised this proposal to a confirmation, so the same
    // roadmap can't be approved twice from a stale bubble.
    set((s) => ({
      pendingProposal: null,
      pendingProposalMessageId: null,
      chatMessages: s.chatMessages.map((m) =>
        m.id === messageId && m.data && 'type' in m.data && m.data.type === 'approval_request'
          ? { ...m, data: { ...m.data, decision, savedRoadmapId, savedParked } }
          : m
      ),
    }));

    if (decision === 'approved') {
      await get().fetchRoadmaps();
      return savedRoadmapId;
    }
    return undefined;
  },
  resolveOnboarding: async (answers) => {
    const prompt = get().pendingOnboarding;
    if (!prompt) return;
    set({ chatLoading: true });
    try {
      const data = await api.submitOnboarding({ thread_id: prompt.threadId, answers });
      set({ pendingOnboarding: null });
      // Resuming finishes the turn the learner originally sent. On a first run
      // that means it went straight on to build a roadmap, so this is usually
      // another approval pause rather than a finished result — `appendTurn`
      // handles either.
      get().appendTurn(data);
      // Reflect the saved profile so the questions don't reappear this session.
      set((s) => ({ memory: { ...(s.memory ?? {}), ...(answers ?? {}), onboarded: true } }));
    } finally {
      set({ chatLoading: false });
    }
  },
  resetChat: () =>
    set({
      chatMessages: [],
      chatThreadId: genId(),
      chatError: '',
      pendingProposal: null,
      pendingProposalMessageId: null,
      pendingOnboarding: null,
    }),

  practice: null,
  practiceResult: null,
  practiceLoading: false,
  practiceError: '',
  startPractice: async () => {
    set({ practiceLoading: true, practiceError: '', practiceResult: null, practice: null });
    try {
      const data = await api.startPractice();
      set({ practice: data.result ?? null });
      return data.result ?? null;
    } catch (e: any) {
      // A 409 here is "you haven't finished a topic yet", which the server words
      // for us — it's the honest answer, not an error to paper over.
      const detail = e?.response?.data?.detail;
      set({
        practiceError:
          (typeof detail === 'string' ? detail : detail?.message) ??
          'Could not put a practice set together.',
      });
      return null;
    } finally {
      set({ practiceLoading: false });
    }
  },
  submitPractice: async (answers) => {
    const deck = get().practice;
    if (!deck) return;
    set({ practiceLoading: true, practiceError: '' });
    try {
      const data = await api.submitPractice(deck.quizId, answers);
      set({ practiceResult: data.result ?? null });
      // Practice is kept out of mastery on purpose, but it does move the
      // misconception picture — and the briefing reads that.
      get().fetchBriefing();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      set({
        practiceError:
          (typeof detail === 'string' ? detail : detail?.message) ?? 'Could not grade that.',
      });
    } finally {
      set({ practiceLoading: false });
    }
  },
  clearPractice: () => set({ practice: null, practiceResult: null, practiceError: '' }),

  activeQuiz: null,
  quizResult: null,
  setActiveQuiz: (questions, quizId) =>
    set({ activeQuiz: { questions, quizId }, quizResult: null }),
  submitQuiz: async (quizId, answers) => {
    const data = await api.submitQuiz({ quizId, answers });
    set({ quizResult: data.result });
  },
  clearQuiz: () => set({ activeQuiz: null, quizResult: null }),

  digests: [],
  digestsLoading: false,
  digestsError: '',
  fetchDigests: async (params) => {
    set({ digestsLoading: true, digestsError: '' });
    try {
      const data = await api.getDigests(params);
      set({ digests: data.result ?? [], reachedServer: true });
    } catch (e: any) {
      // Every filter tap is a fetch now, so a failure has to land somewhere the
      // screen can show it rather than as an unhandled rejection.
      set({ digestsError: e?.response?.data?.detail ?? 'Could not load digests.' });
    } finally {
      set({ digestsLoading: false });
    }
  },

  unreadDigests: [],
  fetchUnreadDigests: async () => {
    try {
      const data = await api.getDigests({ status: 'unread', active_only: true, limit: 50 });
      set({ unreadDigests: data.result ?? [], reachedServer: true });
      syncDigestWidget(get().unreadDigests);
    } catch {
      // The catch-up prompt is additive; never let it break the screen.
    }
  },
  focus: null,
  fetchFocus: async () => {
    try {
      const data = await api.getFocus();
      set({ focus: data.result ?? null, reachedServer: true });
    } catch {
      // The home screen still renders the queue without it.
    }
  },

  briefing: null,
  briefingLoading: false,
  fetchBriefing: async () => {
    // Loading is only reported on the first fetch. On every later one the
    // previous briefing stays on screen while the new one is fetched: the
    // situation rarely changes between two opens, so tearing the card down to a
    // spinner would flicker it away and back with the same words in it.
    set((s) => ({ briefingLoading: s.briefing === null }));
    try {
      const data = await api.getBriefing();
      set({ briefing: data.result ?? null });
    } catch {
      // Advisory, and the screen below it answers the same question in more
      // words. Never let it take the home screen down.
    } finally {
      set({ briefingLoading: false });
    }
  },

  digestQuizFailures: {},
  markDigest: async (digestId, opts = {}) => {
    // No optimistic removal here: a digest carrying a recall check can be
    // rejected, and yanking it out of the queue before the server accepts it
    // would flash it away and back again. (The offline path below *does* remove
    // it optimistically — see the note there for why that case is different.)
    try {
      const data = await api.markDigest(digestId, {
        answers: opts.answers,
        written: opts.written,
        generate_next: opts.generateNext,
      });
      const result: DigestMarkResult = data.result;

      set((s) => ({
        unreadDigests: [
          ...s.unreadDigests.filter((d) => d._id !== digestId),
          ...(result.generated ? [result.generated] : []),
        ],
        digests: s.digests.map((d) =>
          d._id === digestId ? { ...d, status: 'marked' as const } : d
        ),
        digestQuizFailures: Object.fromEntries(
          Object.entries(s.digestQuizFailures).filter(([k]) => k !== digestId)
        ),
      }));
      syncDigestWidget(get().unreadDigests);
      // Acknowledging a digest is what the streak counts, so this is the moment
      // it moves. Without the refresh the 🔥 tile keeps yesterday's number until
      // the learner leaves the screen and comes back — on the one action the
      // counter exists to reward. Not awaited, as in submitProgress: the tick
      // should feel instant.
      get().fetchStats();
      return result;
    } catch (e: any) {
      if (isOfflineError(e)) return await get().queueMark(digestId, opts);
      // 422 means the recall check was wrong, and the body carries the grading —
      // plus, once they've failed the same check enough times, the news that the
      // agent is re-explaining the material rather than asking them to re-read it.
      const detail = e?.response?.data?.detail;
      if (detail?.quiz_result) {
        set((s) => ({
          digestQuizFailures: { ...s.digestQuizFailures, [digestId]: detail },
        }));
        throw new Error(detail.message ?? 'Not quite — try again.');
      }
      throw new Error(
        (typeof detail === 'string' ? detail : detail?.message) ?? 'Could not mark that digest.'
      );
    }
  },

  queueMark: async (digestId, opts) => {
    const state = get();
    const digest =
      state.unreadDigests.find((d) => d._id === digestId) ??
      state.digests.find((d) => d._id === digestId);

    // A recall check is graded server-side, and there is no honest way to bank
    // one offline: accepting it would tell the learner they had passed a check
    // that might fail on replay, and moving the digest out of the queue on that
    // basis is exactly the flash-away-and-back the online path avoids. Refusing
    // is the smaller cost — the tips are still readable, only the acknowledgement
    // has to wait.
    if (digest && digest.quizId && (digest.quiz?.length ?? 0) > 0) {
      throw new Error("You're offline — this recall check needs a connection to grade.");
    }
    // Nothing known about it locally means nothing to reconcile against later,
    // and a queue entry that cannot name its topic cannot produce a result the
    // caller can use.
    if (!digest) throw new Error("You're offline — that digest can't be marked right now.");

    const queued: QueuedMark = {
      digestId,
      topicId: digest.topicId,
      roadmapId: digest.roadmapId,
      answers: opts.answers,
      written: opts.written,
      generateNext: opts.generateNext,
      queuedAt: new Date().toISOString(),
    };
    const pendingMarks = [...state.pendingMarks.filter((m) => m.digestId !== digestId), queued];

    // Disk first, and awaited. Everything below tells the learner the digest is
    // done; if the promise the app is making on the server's behalf cannot be
    // written down, that has to surface before the UI clears the card.
    try {
      await saveOutbox(pendingMarks);
    } catch {
      throw new Error("You're offline and this couldn't be saved — try again in a moment.");
    }

    // Now the optimistic removal the online path deliberately avoids. It is safe
    // here precisely because of the guard above: with no check to fail, the
    // server has no grounds to refuse this on replay, so the queue will not
    // spring back.
    set((s) => ({
      pendingMarks,
      unreadDigests: s.unreadDigests.filter((d) => d._id !== digestId),
      digests: s.digests.map((d) => (d._id === digestId ? { ...d, status: 'marked' as const } : d)),
    }));
    syncDigestWidget(get().unreadDigests);

    // Shaped like the server's reply so callers need no second code path, but
    // `queued` marks every derived field as a placeholder — see `DigestMarkResult`.
    return {
      digestId,
      topicId: digest.topicId,
      roadmapId: digest.roadmapId,
      quiz_result: null,
      generated: null,
      next: null,
      remaining: get().unreadDigests.length,
      coverage_complete: false,
      queued: true,
    };
  },

  generatingDigest: false,
  digestError: '',
  generateNextDigest: async (roadmapId, topicId) => {
    set({ generatingDigest: true, digestError: '' });
    try {
      const data = await api.generateDigest(roadmapId, topicId);
      const digest: Digest = data.result;
      set((s) => ({
        unreadDigests: [digest, ...s.unreadDigests],
        digests: [digest, ...s.digests],
      }));
      syncDigestWidget(get().unreadDigests);
      return digest;
    } catch (e: any) {
      // A refusal here carries an OBJECT detail — "revision tips are already
      // waiting", or the coverage/cap declines. Assigning it straight to a string
      // field sent an object to a <Text> child.
      const detail = e?.response?.data?.detail;
      set({
        digestError:
          (typeof detail === 'string' ? detail : detail?.message) ??
          'Could not fetch a new digest.',
      });
      return null;
    } finally {
      set({ generatingDigest: false });
    }
  },

  memory: null,
  memoryLoading: false,
  fetchMemory: async () => {
    set({ memoryLoading: true });
    try {
      const data = await api.getMemory();
      set({ memory: data.result ?? {} });
    } finally {
      set({ memoryLoading: false });
    }
  },
  saveMemory: async (data) => {
    await api.saveMemory(data);
    set((s) => ({ memory: { ...s.memory, ...data } }));
  },
  deleteMemory: async () => {
    await api.deleteMemory();
    set({ memory: null });
  },

  digestEnabled: false,
  digestHour: 8,
  digestTimezone: deviceTimezone,
  digestLoading: false,
  digestSaving: false,
  fetchTriggers: async () => {
    set({ digestLoading: true });
    try {
      const data = await api.getTriggers();
      const digest = findDigest(data.result ?? []);
      set({
        digestEnabled: !!digest?.enabled,
        // Keep the current defaults when the server hasn't stored these yet.
        ...(digest?.schedule_hour != null ? { digestHour: digest.schedule_hour } : {}),
        ...(digest?.timezone ? { digestTimezone: digest.timezone } : {}),
      });
    } catch {
      // Leave digest state untouched if the trigger state can't be loaded.
    } finally {
      set({ digestLoading: false });
    }
  },
  toggleDigest: async () => {
    const data = await api.toggleTrigger();
    set({ digestEnabled: data.enabled });
  },
  saveTriggerSettings: async (body) => {
    set({ digestSaving: true });
    try {
      await api.updateTriggerSettings(body);
      // PATCH succeeded → reflect the saved values locally.
      set({
        ...(body.schedule_hour != null ? { digestHour: body.schedule_hour } : {}),
        ...(body.timezone ? { digestTimezone: body.timezone } : {}),
      });
    } finally {
      set({ digestSaving: false });
    }
  },

  /* ─── offline cache ─── */

  hydrated: false,
  cacheSavedAt: null,
  reachedServer: false,
  pendingMarks: [],

  hydrateFromCache: async () => {
    const [snapshot, outbox] = await Promise.all([loadSnapshot(), loadOutbox()]);

    set((s) => {
      // A fetch can beat the disk read — AsyncStorage is a bridge round trip and
      // the screens fire their requests on mount. Whatever a response has
      // already put in the store is newer than anything here by definition, so
      // each slice is filled only where it is still untouched.
      const stale = snapshot
        ? {
            roadmaps: s.roadmaps.length ? s.roadmaps : snapshot.roadmaps,
            unreadDigests: s.unreadDigests.length ? s.unreadDigests : snapshot.unreadDigests,
            digests: s.digests.length ? s.digests : snapshot.digests,
            focus: s.focus ?? snapshot.focus,
            stats: s.stats ?? snapshot.stats,
            reviews: s.reviews.length ? s.reviews : snapshot.reviews,
          }
        : {};
      return {
        ...stale,
        pendingMarks: outbox,
        hydrated: true,
        // Records the age of what came off disk, nothing more. Whether that is
        // what the learner is actually looking at is `reachedServer`'s job.
        cacheSavedAt: snapshot?.savedAt ?? null,
      };
    });

    // The widget reads its own persisted payload, but a cold start with digests
    // on disk and no network would otherwise leave it on "not synced yet" while
    // the app itself is showing the queue.
    if (get().unreadDigests.length > 0) syncDigestWidget(get().unreadDigests);
  },

  flushPendingMarks: async () => {
    // One drain at a time. Hydration, app-foreground and a successful fetch can
    // all ask for this within the same tick, and replaying a mark twice risks
    // the second attempt being refused for reasons the first one caused.
    if (flushing) return flushing;
    if (get().pendingMarks.length === 0) return 0;

    flushing = (async () => {
      const remaining = [...get().pendingMarks];
      let sent = 0;

      while (remaining.length > 0) {
        const mark = remaining[0];
        try {
          await api.markDigest(mark.digestId, {
            answers: mark.answers,
            written: mark.written,
            generate_next: mark.generateNext,
          });
          sent += 1;
        } catch (e) {
          // Still no network: stop, keep the whole queue, try again next time.
          if (isOfflineError(e)) break;
          // The server answered and refused. It will refuse the same request
          // again — most often because the digest is already marked, which is
          // this queue's own work arriving twice. Dropping it is what keeps a
          // permanently-rejected entry from blocking everything behind it.
        }
        remaining.shift();
      }

      set({ pendingMarks: remaining });
      try {
        await saveOutbox(remaining);
      } catch {
        // In-memory state is already correct; the next queue or flush rewrites it.
      }

      if (sent > 0) {
        // Replay changed the backlog, the streak and possibly the topic's state.
        // Refetching is how the local guesses made offline get reconciled with
        // what the server actually did with them.
        await get().fetchUnreadDigests();
        get().fetchFocus();
        get().fetchStats();
      }
      return remaining.length;
    })();

    try {
      return await flushing;
    } finally {
      flushing = null;
    }
  },
}));
