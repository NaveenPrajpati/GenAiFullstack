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
import * as api from './learningApi';
import type {
  ChatMessage,
  ChatResultData,
  Digest,
  LearningStats,
  Memory,
  OnboardingPrompt,
  ProgressStatus,
  Proposal,
  QuizQuestion,
  QuizResult,
  Roadmap,
  SelectedTopic,
  Trigger,
} from './types';

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
      content: `Next topic: ${result.next_topic}`,
      msgData: {
        intent: 'query_roadmap',
        next_topic: result.next_topic,
        progress: result.progress,
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
  setRoadmapStatus: (roadmapId: string, status: Roadmap['status']) => Promise<void>;

  stats: LearningStats | null;
  fetchStats: () => Promise<void>;

  /** The topic tapped on the roadmap screen; scopes the chat panel's actions. */
  selectedTopic: SelectedTopic | null;
  setSelectedTopic: (topic: SelectedTopic | null) => void;

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

  activeQuiz: { questions: QuizQuestion[]; quizId: string } | null;
  quizResult: QuizResult | null;
  setActiveQuiz: (quiz: QuizQuestion[], quizId: string) => void;
  submitQuiz: (
    quizId: string,
    answers: { question: number; answer: number }[]
  ) => Promise<void>;
  clearQuiz: () => void;

  digests: Digest[];
  digestsLoading: boolean;
  fetchDigests: () => Promise<void>;

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

export const useLearningStore = create<LearningState>((set, get) => ({
  roadmaps: [],
  roadmapsLoading: false,
  roadmapsError: '',
  fetchRoadmaps: async () => {
    set({ roadmapsLoading: true, roadmapsError: '' });
    try {
      const data = await api.getRoadmaps();
      set({ roadmaps: data.result ?? [] });
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
              topics: r.topics.map((t) =>
                t.id === topicId ? { ...t, progress_status: status } : t
              ),
            }
          : r
      ),
    }));
  },
  submitProgress: async (roadmapId, topicId, status) => {
    const previous = get()
      .roadmaps.find((r) => r._id === roadmapId)
      ?.topics.find((t) => t.id === topicId)?.progress_status;
    get().optimisticUpdateTopic(roadmapId, topicId, status);
    try {
      await api.submitProgress({ roadmapId, topicId, status });
    } catch {
      get().optimisticUpdateTopic(roadmapId, topicId, previous ?? 'not_started');
      throw new Error('Failed to update progress');
    }
  },
  setRoadmapStatus: async (roadmapId, status) => {
    await api.updateRoadmapStatus(roadmapId, status);
    set((s) => ({
      roadmaps: s.roadmaps.map((r) => (r._id === roadmapId ? { ...r, status } : r)),
    }));
  },

  stats: null,
  fetchStats: async () => {
    try {
      const data = await api.getStats();
      set({ stats: data.result ?? null });
    } catch {
      // The summary strip is decorative — a failure here must not take the
      // roadmap list down with it.
    }
  },

  selectedTopic: null,
  setSelectedTopic: (topic) => set({ selectedTopic: topic }),

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

    // Switch the card that raised this proposal to a confirmation, so the same
    // roadmap can't be approved twice from a stale bubble.
    set((s) => ({
      pendingProposal: null,
      pendingProposalMessageId: null,
      chatMessages: s.chatMessages.map((m) =>
        m.id === messageId && m.data && 'type' in m.data && m.data.type === 'approval_request'
          ? { ...m, data: { ...m.data, decision, savedRoadmapId } }
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
  fetchDigests: async () => {
    set({ digestsLoading: true });
    try {
      const data = await api.getDigests(20);
      set({ digests: data.result ?? [] });
    } finally {
      set({ digestsLoading: false });
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
}));
