/**
 * Domain types for the Learning Tracker feature.
 *
 * These describe the roadmap/chat/quiz/memory shapes returned by the
 * `${BASE_URL}/learning` API and are shared by the store and screens.
 *
 * Two roadmap shapes exist and they are not interchangeable:
 *  - `Roadmap` is a *stored* roadmap. The server owns its ids, `status`, and
 *    every progress field.
 *  - `RoadmapDraft` is what the model *proposes*, and is what arrives inside an
 *    approval. It has no ids, no status, and no progress — those are assigned
 *    only once the user approves it.
 */

export type ResourceType =
  | 'article'
  | 'video'
  | 'course'
  | 'documentation'
  | 'book'
  | 'exercise'
  | 'project'
  | 'other';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type ProgressStatus =
  | 'not_started'
  | 'in_progress'
  | 'needs_review'
  | 'completed'
  | 'skipped';

export type RoadmapStatus = 'draft' | 'active' | 'paused' | 'archived' | 'completed';

export type Resource = {
  title: string;
  url?: string;
  resource_type: ResourceType;
  is_required?: boolean;
};

export type Stage = {
  id: string;
  order: number;
  title: string;
  description?: string;
};

export type TopicNode = {
  id: string;
  /** Links the topic to its `Stage.id`. */
  stage_id?: string;
  order: number;
  title: string;
  description: string;
  learning_outcomes?: string[];
  prerequisites?: string[];
  estimated_minutes?: number;
  difficulty?: Difficulty;
  resources?: Resource[];
  progress_status?: ProgressStatus;
  mastery_score?: number;
  completed_at?: string;
  next_review_at?: string;
};

export type Roadmap = {
  _id: string;
  title: string;
  summary: string;
  status: RoadmapStatus;
  learner_goal?: string;
  target_date?: string;
  total_estimated_hours?: number;
  stages: Stage[];
  topics: TopicNode[];
  user_id?: string;
  created_at?: string;
  updated_at?: string;
};

/* ─── the model's proposal, before approval ─── */

export type StageDraft = {
  order: number;
  title: string;
  description?: string;
};

export type TopicDraft = {
  order: number;
  /** Links to `StageDraft.order` — the server turns this into a `stage_id`. */
  stage_order?: number;
  title: string;
  description: string;
  learning_outcomes?: string[];
  prerequisites?: string[];
  estimated_minutes?: number;
  difficulty?: Difficulty;
  resources?: Resource[];
  existing_id?: string | null;
};

export type RoadmapDraft = {
  title: string;
  summary: string;
  learner_goal?: string;
  target_date?: string;
  total_estimated_hours?: number;
  stages: StageDraft[];
  topics: TopicDraft[];
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

export type LearningAvailability = {
  minutes_per_day?: number;
  days_per_week?: number;
  preferred_days?: string[];
  deadline?: string;
};

export type Memory = {
  skill_level?: Difficulty;
  preferred_resource_types?: string[];
  preferred_explanation_style?:
    | 'concise'
    | 'step_by_step'
    | 'examples_first'
    | 'visual'
    | 'socratic';
  preferred_language?: string;
  goals?: string[];
  availability?: LearningAvailability;
  known_topics?: string[];
  weak_topics?: string[];
  wants_hints_before_answers?: boolean;
  preferred_quiz_difficulty?: 'easy' | 'adaptive' | 'challenging';
  /** Set by the server once onboarding has run, including when it was skipped. */
  onboarded?: boolean;
};

export type QuizQuestion = {
  question: string;
  options: string[];
};

export type QuizResult = {
  total: number;
  correct: number;
  score: number;
  review: {
    question: number;
    selected: number | null;
    correctAnswer: number;
    correctOption: string | null;
  }[];
};

export type RoadmapProgress = {
  next_topic: string | null;
  next_topic_id: string | null;
  completed_count: number;
  remaining: number;
  total: number;
  percent: number;
};

export type Proposal = {
  type: 'save_roadmap' | 'update_roadmap';
  approvalId: string;
  roadmap: RoadmapDraft;
  threadId: string;
};

/** Aggregate progress across every roadmap — the landing screen's summary strip. */
export type LearningStats = {
  roadmaps: { total: number; active: number; completed: number };
  topics: { total: number; completed: number; percent: number };
  completed_this_week: number;
  /** Consecutive days ending today with at least one topic completed. */
  streak_days: number;
  quizzes: { attempts: number; average_score: number };
};

/**
 * The topic the learner has tapped on the roadmap screen. The chat panel reads
 * this to offer topic-scoped actions, which is why it lives in the store rather
 * than in the screen's local state.
 */
export type SelectedTopic = {
  roadmapId: string;
  id: string;
  title: string;
};

/** The two-question profile prompt a first-time learner is shown. */
export type OnboardingQuestion = {
  key: string;
  q: string;
  options: string[];
};

export type OnboardingPrompt = {
  questions: OnboardingQuestion[];
  skippable?: boolean;
  threadId: string;
};

export type ChatResultData =
  | { intent: 'explain'; topic_explaination: string }
  | { intent: 'quiz'; quiz: QuizQuestion[]; quizId: string }
  | { intent: 'submit_quiz'; quiz_result: QuizResult }
  | { intent: 'find_resources'; suggestions: Resource[] }
  | { intent: 'query_roadmap'; next_topic: string; progress: RoadmapProgress }
  | { intent: 'update_progress'; log_status: string; roadmap: Roadmap }
  // `decision` is set once the user answers, which switches the card to a
  // confirmation. Without it the buttons stay live and the same roadmap can be
  // approved twice from a stale bubble.
  | {
      type: 'approval_request';
      proposal: Proposal;
      decision?: 'approved' | 'rejected';
      savedRoadmapId?: string;
    }
  | { type: 'onboarding'; prompt: OnboardingPrompt }
  | { type: 'plain'; text: string };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: ChatResultData;
  /** True while tokens are still streaming into `content` from `/query/stream`. */
  streaming?: boolean;
};

/** A user auto-trigger row from `GET /learning/triggers`. */
export type Trigger = {
  _id: string;
  user_id: string;
  /** e.g. 'learning_digest' — the daily digest trigger. */
  action_type: string;
  enabled: boolean;
  /** Hour of day (0–23) the digest is sent at, in `timezone`. */
  schedule_hour?: number;
  /** IANA timezone name, e.g. 'Asia/Kolkata'. */
  timezone?: string;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Events emitted by `POST /learning/query/stream` as Server-Sent Events
 * (`data: <json>` lines).
 *
 * - `thread`         — the thread id for this turn, sent first.
 * - `token`          — an incremental chunk of the assistant's text answer.
 * - `done`           — the final structured turn result.
 * - `needs_approval` — the turn produced a roadmap proposal awaiting approval.
 * - `needs_input`    — the graph paused to ask the learner the onboarding questions.
 * - `error`          — the backend failed mid-stream.
 */
export type StreamEvent = {
  type: string;
  token?: string;
  result?: any;
  proposal?: any;
  thread_id?: string;
  status?: string;
  intent?: string;
  detail?: string;
  message?: string;
  [key: string]: any;
};

/* ─── small shared helpers ─── */

/** Whether a topic counts as done. A skipped topic is behind the learner but is
 *  deliberately not counted as completed. */
export function isCompleted(topic: TopicNode): boolean {
  return topic.progress_status === 'completed';
}

/** "45m" / "1.5h" / "2h". Null when the estimate is missing, so callers can
 *  hide the row entirely rather than render "0m". */
export function formatMinutes(mins?: number | null): string | null {
  if (!mins || mins <= 0) return null;
  if (mins < 60) return `${mins}m`;
  const hours = mins / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}
