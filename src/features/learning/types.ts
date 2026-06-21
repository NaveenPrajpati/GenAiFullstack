/**
 * Domain types for the Learning Tracker feature.
 *
 * These describe the roadmap/chat/quiz/memory shapes returned by the
 * `${BASE_URL}/learning` API and are shared by the store and screens.
 */

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
  /** True while tokens are still streaming into `content` from `/query/stream`. */
  streaming?: boolean;
};

/**
 * Events emitted by `POST /learning/query/stream` as Server-Sent Events
 * (`data: <json>` lines, terminated by `data: [DONE]`).
 *
 * - `token`    — an incremental chunk of the assistant's text answer.
 * - `result`   — the final structured turn result (one of the `intent` shapes).
 * - `approval` — the turn produced a roadmap proposal needing user approval.
 * - `error`    — the backend failed mid-stream.
 */
export type StreamEvent = {
  /** 'token' | 'result' | 'approval' | 'error' (others ignored). */
  type: string;
  token?: string;
  result?: any;
  proposal?: any;
  thread_id?: string;
  status?: string;
  intent?: string;
  detail?: string;
  [key: string]: any;
};
