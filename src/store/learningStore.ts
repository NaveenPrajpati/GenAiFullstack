import { apiClient } from '@/context/AuthContext';
import { LearningApis } from '@/services/api';
import { create } from 'zustand';

export type TopicNode = {
  id: string;
  order: number;
  title: string;
  description: string;
  prerequisites: string[];
  estimated_hours?: number;
  resources?: string[];
  covered?: boolean;
};

export type Roadmap = {
  _id: string;
  title: string;
  summary: string;
  status: 'active' | 'archived' | 'completed';
  total_estimated_hours?: number;
  stages: string[];
  topics: TopicNode[];
  userId?: string;
  createdAt?: string;
};

export type Digest = {
  _id: string;
  roadmapId: string;
  topicId: string;
  topicTitle: string;
  bullets: string[];
  resources: { title: string; url: string }[];
  createdAt: string;
};

export type Memory = {
  skill_level?: string;
  preferred_resource_types?: string[];
  goals?: string[];
  availability?: string;
  known_topics?: string[];
};

export type QuizQuestion = {
  question: string;
  options: string[];
};

export type QuizResult = {
  total: number;
  correct: number;
  review: {
    question: number;
    selected: number;
    correctAnswer: number;
    correctOption: string;
  }[];
};

export type RoadmapProgress = {
  next_topic: string;
  next_topic_id: string;
  covered_count: number;
  remaining: number;
  total: number;
  percent: number;
};

export type Proposal = {
  type: 'save_roadmap' | 'update_roadmap';
  approvalId: string;
  roadmap: Omit<Roadmap, '_id'>;
  threadId: string;
};

export type ChatResultData =
  | { intent: 'explain'; topic_explaination: string }
  | { intent: 'quiz'; quiz: QuizQuestion[]; quizId: string }
  | { intent: 'find_resources'; suggestions: string[] }
  | { intent: 'query_roadmap'; next_topic: string; progress: RoadmapProgress }
  | { intent: 'update_progress'; log_status: string; roadmap: Roadmap }
  | { type: 'approval_request'; proposal: Proposal }
  | { type: 'plain'; text: string };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: ChatResultData;
};

const genId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

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
      const res = await apiClient(token).get(LearningApis.roadmaps);
      set({ roadmaps: res.data.result ?? [] });
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
      await apiClient(token).post(LearningApis.progress, { roadmapId, topicId, covered });
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
    try {
      const res = await apiClient(token).post(LearningApis.query, {
        text,
        ...(roadmapId ? { roadmapId } : {}),
        thread_id: threadId,
      });
      const data = res.data;

      if (data.status === 'needs_approval') {
        const proposal: Proposal = {
          type: data.proposal?.type,
          approvalId: data.proposal?.approvalId,
          roadmap: data.proposal?.roadmap,
          threadId: data.thread_id ?? threadId,
        };
        set((s) => ({
          pendingProposal: proposal,
          chatThreadId: data.thread_id ?? s.chatThreadId,
          chatMessages: [
            ...s.chatMessages,
            {
              id: genId(),
              role: 'assistant',
              content: "I've prepared a roadmap for you. Please review it below.",
              data: { type: 'approval_request', proposal },
            },
          ],
        }));
        return;
      }

      const result = data.result;
      let content = '';
      let msgData: ChatResultData;

      if (result?.intent === 'explain') {
        content = result.topic_explaination ?? '';
        msgData = { intent: 'explain', topic_explaination: content };
      } else if (result?.intent === 'quiz') {
        content = 'Here is a quiz for you!';
        msgData = { intent: 'quiz', quiz: result.quiz ?? [], quizId: result.quizId ?? '' };
        set({ activeQuiz: { questions: result.quiz ?? [], quizId: result.quizId ?? '' } });
      } else if (result?.intent === 'find_resources') {
        content = 'Here are some resources:';
        msgData = { intent: 'find_resources', suggestions: result.suggestions ?? [] };
      } else if (result?.intent === 'query_roadmap') {
        content = `Next topic: ${result.next_topic}`;
        msgData = {
          intent: 'query_roadmap',
          next_topic: result.next_topic,
          progress: result.progress,
        };
      } else if (result?.intent === 'update_progress') {
        content = result.log_status === 'updated' ? 'Progress updated!' : 'Topic not found.';
        msgData = {
          intent: 'update_progress',
          log_status: result.log_status,
          roadmap: result.roadmap,
        };
        if (result.roadmap) {
          set((s) => ({
            roadmaps: s.roadmaps.map((r) =>
              r._id === result.roadmap._id ? result.roadmap : r
            ),
          }));
        }
      } else {
        content = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        msgData = { type: 'plain', text: content };
      }

      set((s) => ({
        chatMessages: [
          ...s.chatMessages,
          { id: genId(), role: 'assistant', content, data: msgData },
        ],
      }));
    } catch (e: any) {
      const errText = e?.response?.data?.detail ?? 'Something went wrong. Please try again.';
      set((s) => ({
        chatError: errText,
        chatMessages: [...s.chatMessages, { id: genId(), role: 'assistant', content: errText }],
      }));
    } finally {
      set({ chatLoading: false });
    }
  },
  resolveProposal: async (token, decision) => {
    const proposal = get().pendingProposal;
    if (!proposal) return undefined;
    const res = await apiClient(token).post(LearningApis.approvals, {
      thread_id: proposal.threadId,
      decision,
    });
    set({ pendingProposal: null });
    if (decision === 'approved') {
      await get().fetchRoadmaps(token);
      return res.data.result?.roadmapId as string | undefined;
    }
    return undefined;
  },
  resetChat: () =>
    set({ chatMessages: [], chatThreadId: genId(), chatError: '', pendingProposal: null }),

  activeQuiz: null,
  quizResult: null,
  setActiveQuiz: (questions, quizId) => set({ activeQuiz: { questions, quizId }, quizResult: null }),
  submitQuiz: async (token, quizId, answers) => {
    const res = await apiClient(token).post(LearningApis.submitQuiz, { quizId, answers });
    set({ quizResult: res.data.result });
  },
  clearQuiz: () => set({ activeQuiz: null, quizResult: null }),

  digests: [],
  digestsLoading: false,
  fetchDigests: async (token) => {
    set({ digestsLoading: true });
    try {
      const res = await apiClient(token).get(`${LearningApis.digests}?limit=20`);
      set({ digests: res.data.result ?? [] });
    } finally {
      set({ digestsLoading: false });
    }
  },

  memory: null,
  memoryLoading: false,
  fetchMemory: async (token) => {
    set({ memoryLoading: true });
    try {
      const res = await apiClient(token).get(LearningApis.memory);
      set({ memory: res.data.result ?? {} });
    } finally {
      set({ memoryLoading: false });
    }
  },
  saveMemory: async (token, data) => {
    await apiClient(token).put(LearningApis.memory, { data });
    set((s) => ({ memory: { ...s.memory, ...data } }));
  },
  deleteMemory: async (token) => {
    await apiClient(token).delete(LearningApis.memory);
    set({ memory: null });
  },

  digestEnabled: false,
  toggleDigest: async (token) => {
    const res = await apiClient(token).post(LearningApis.toggleTrigger);
    set({ digestEnabled: res.data.enabled });
  },
}));
