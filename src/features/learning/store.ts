/**
 * Single Zustand store for the Learning Tracker feature.
 *
 * Auth note: actions take the current `token` as their first argument (pushed
 * down from screens via `useAuth()`); the store never reads React context.
 *
 * All network access is delegated to `learningApi` — no axios/fetch here.
 */
import { create } from 'zustand';
import * as api from './learningApi';
import type {
  ChatMessage,
  ChatResultData,
  Digest,
  Memory,
  Proposal,
  QuizQuestion,
  QuizResult,
  Roadmap,
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
  if (result?.intent === 'quiz') {
    return {
      content: 'Here is a quiz for you!',
      msgData: { intent: 'quiz', quiz: result.quiz ?? [], quizId: result.quizId ?? '' },
    };
  }
  if (result?.intent === 'find_resources') {
    return {
      content: 'Here are some resources:',
      msgData: { intent: 'find_resources', suggestions: result.suggestions ?? [] },
    };
  }
  if (result?.intent === 'query_roadmap') {
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

type LearningState = {
  roadmaps: Roadmap[];
  roadmapsLoading: boolean;
  roadmapsError: string;
  fetchRoadmaps: (token: string) => Promise<void>;
  optimisticUpdateTopic: (roadmapId: string, topicId: string, covered: boolean) => void;
  submitProgress: (
    token: string,
    roadmapId: string,
    topicId: string,
    covered: boolean
  ) => Promise<void>;

  chatMessages: ChatMessage[];
  chatThreadId: string;
  chatLoading: boolean;
  chatError: string;
  pendingProposal: Proposal | null;
  sendChatMessage: (token: string, text: string, roadmapId?: string) => Promise<void>;
  resolveProposal: (
    token: string,
    decision: 'approved' | 'rejected'
  ) => Promise<string | undefined>;
  resetChat: () => void;

  activeQuiz: { questions: QuizQuestion[]; quizId: string } | null;
  quizResult: QuizResult | null;
  setActiveQuiz: (quiz: QuizQuestion[], quizId: string) => void;
  submitQuiz: (
    token: string,
    quizId: string,
    answers: { question: number; answer: number }[]
  ) => Promise<void>;
  clearQuiz: () => void;

  digests: Digest[];
  digestsLoading: boolean;
  fetchDigests: (token: string) => Promise<void>;

  memory: Memory | null;
  memoryLoading: boolean;
  fetchMemory: (token: string) => Promise<void>;
  saveMemory: (token: string, data: Partial<Memory>) => Promise<void>;
  deleteMemory: (token: string) => Promise<void>;

  digestEnabled: boolean;
  toggleDigest: (token: string) => Promise<void>;
};

export const useLearningStore = create<LearningState>((set, get) => ({
  roadmaps: [],
  roadmapsLoading: false,
  roadmapsError: '',
  fetchRoadmaps: async (token) => {
    set({ roadmapsLoading: true, roadmapsError: '' });
    try {
      const data = await api.getRoadmaps(token);
      set({ roadmaps: data.result ?? [] });
    } catch (e: any) {
      set({ roadmapsError: e?.response?.data?.detail ?? 'Failed to load roadmaps' });
    } finally {
      set({ roadmapsLoading: false });
    }
  },
  optimisticUpdateTopic: (roadmapId, topicId, covered) => {
    set((s) => ({
      roadmaps: s.roadmaps.map((r) =>
        r._id === roadmapId
          ? { ...r, topics: r.topics.map((t) => (t.id === topicId ? { ...t, covered } : t)) }
          : r
      ),
    }));
  },
  submitProgress: async (token, roadmapId, topicId, covered) => {
    get().optimisticUpdateTopic(roadmapId, topicId, covered);
    try {
      await api.submitProgress(token, { roadmapId, topicId, covered });
    } catch {
      get().optimisticUpdateTopic(roadmapId, topicId, !covered);
      throw new Error('Failed to update progress');
    }
  },

  chatMessages: [],
  chatThreadId: genId(),
  chatLoading: false,
  chatError: '',
  pendingProposal: null,
  sendChatMessage: async (token, text, roadmapId) => {
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

    try {
      let streamedText = '';
      let handledStructured = false;

      for await (const event of api.queryStream(token, {
        text,
        ...(roadmapId ? { roadmapId } : {}),
        thread_id: threadId,
      })) {
        if (event.type === 'token') {
          ensureAssistant();
          streamedText += event.token ?? '';
          patch({ content: streamedText });
        } else if (event.type === 'approval' || event.status === 'needs_approval') {
          ensureAssistant();
          handledStructured = true;
          const proposal: Proposal = {
            type: event.proposal?.type,
            approvalId: event.proposal?.approvalId,
            roadmap: event.proposal?.roadmap,
            threadId: event.thread_id ?? threadId,
          };
          set((s) => ({
            pendingProposal: proposal,
            chatThreadId: event.thread_id ?? s.chatThreadId,
          }));
          patch({
            content: "I've prepared a roadmap for you. Please review it below.",
            data: { type: 'approval_request', proposal },
            streaming: false,
          });
        } else if (event.type === 'result' || event.intent || event.result) {
          ensureAssistant();
          handledStructured = true;
          const result = event.result ?? event;
          const { content, msgData } = interpretResult(result);
          patch({ content, data: msgData, streaming: false });
          if (result?.intent === 'quiz') {
            set({ activeQuiz: { questions: result.quiz ?? [], quizId: result.quizId ?? '' } });
          } else if (result?.intent === 'update_progress' && result.roadmap) {
            set((s) => ({
              roadmaps: s.roadmaps.map((r) =>
                r._id === result.roadmap._id ? result.roadmap : r
              ),
            }));
          }
        } else if (event.type === 'error') {
          throw new Error(event.detail ?? 'Stream error');
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
  resolveProposal: async (token, decision) => {
    const proposal = get().pendingProposal;
    if (!proposal) return undefined;
    const data = await api.resolveApproval(token, {
      thread_id: proposal.threadId,
      decision,
    });
    set({ pendingProposal: null });
    if (decision === 'approved') {
      await get().fetchRoadmaps(token);
      return data.result?.roadmapId as string | undefined;
    }
    return undefined;
  },
  resetChat: () =>
    set({ chatMessages: [], chatThreadId: genId(), chatError: '', pendingProposal: null }),

  activeQuiz: null,
  quizResult: null,
  setActiveQuiz: (questions, quizId) => set({ activeQuiz: { questions, quizId }, quizResult: null }),
  submitQuiz: async (token, quizId, answers) => {
    const data = await api.submitQuiz(token, { quizId, answers });
    set({ quizResult: data.result });
  },
  clearQuiz: () => set({ activeQuiz: null, quizResult: null }),

  digests: [],
  digestsLoading: false,
  fetchDigests: async (token) => {
    set({ digestsLoading: true });
    try {
      const data = await api.getDigests(token, 20);
      set({ digests: data.result ?? [] });
    } finally {
      set({ digestsLoading: false });
    }
  },

  memory: null,
  memoryLoading: false,
  fetchMemory: async (token) => {
    set({ memoryLoading: true });
    try {
      const data = await api.getMemory(token);
      set({ memory: data.result ?? {} });
    } finally {
      set({ memoryLoading: false });
    }
  },
  saveMemory: async (token, data) => {
    await api.saveMemory(token, data);
    set((s) => ({ memory: { ...s.memory, ...data } }));
  },
  deleteMemory: async (token) => {
    await api.deleteMemory(token);
    set({ memory: null });
  },

  digestEnabled: false,
  toggleDigest: async (token) => {
    const data = await api.toggleTrigger(token);
    set({ digestEnabled: data.enabled });
  },
}));
