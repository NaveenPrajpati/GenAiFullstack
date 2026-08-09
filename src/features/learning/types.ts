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
  'article' | 'video' | 'course' | 'documentation' | 'book' | 'exercise' | 'project' | 'other';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type ProgressStatus =
  'not_started' | 'in_progress' | 'needs_review' | 'completed' | 'skipped';

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
  /** Set once the topic has been explained well in the learner's own words.
   *  Spent at the next checkpoint for an extra rung of the review ladder. */
  feynman_passed?: boolean;
  feynman_score?: number | null;
  feynman_at?: string | null;
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

export type DigestStatus = 'unread' | 'marked';

export type Digest = {
  _id: string;
  roadmapId: string;
  topicId: string;
  topicTitle: string;
  bullets: string[];
  resources: { title: string; url: string }[];
  /** Acknowledging a digest is the only signal that it actually landed. */
  status: DigestStatus;
  /** 1-based position in the drip-feed for this topic. Null on a revision
   *  digest — revising doesn't advance the drip-feed. */
  sequence?: number | null;
  /** `revision` is written after a failed checkpoint, against the questions that
   *  were missed. Absent on the ordinary teaching digests. */
  kind?: 'revision';
  /** The questions missed on the failed attempt this revision digest answers. */
  weak_points?: string[];
  /** Recall check over EARLIER digests. Must be passed to mark this one.
   *  Null on the first digest of a topic — nothing to recall yet. */
  quizId?: string | null;
  /** The recall check's questions, answer-free. Empty when there's no check. */
  quiz?: QuizQuestion[];
  /** Set once the tips have taught the whole topic: the checkpoint comes next,
   *  not another digest. */
  coverage_complete?: boolean;
  missing_outcomes?: string[];
  createdAt: string;
  /** When it was marked — marking is the only thing that updates a digest. */
  updatedAt?: string;
  roadmapTitle?: string | null;
};

/** What came back from acknowledging a digest. */
export type DigestMarkResult = {
  digestId: string;
  quiz_result: QuizResult | null;
  generated: Digest | null;
  remaining: number;
  next: Digest | null;
  coverage_complete: boolean;
  topicId: string;
  roadmapId: string;
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
    'concise' | 'step_by_step' | 'examples_first' | 'visual' | 'socratic';
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
  /** Empty on an `open` question — there is nothing to pick from. */
  options: string[];
  /** `open` questions are answered in a sentence and graded by an LLM. They
   *  never count toward the pass mark; they exist for the diagnosis. */
  kind?: 'choice' | 'open';
};

/** How one learning outcome fared in a learner's own-words explanation. */
export type OutcomeVerdict = {
  outcome: string;
  verdict: 'solid' | 'partial' | 'missing' | 'wrong';
  evidence?: string | null;
};

/** The result of the Feynman checkpoint — explaining a topic in your own words. */
export type ExplanationResult = {
  passed: boolean;
  pass_score: number;
  score: number;
  outcomes: OutcomeVerdict[];
  strengths: string[];
  gaps: string[];
  /** Beliefs the explanation revealed as wrong. These reach the misconception
   *  tracker, which is the real reason this is worth doing. */
  misconceptions: { label: string; detail: string }[];
  feedback: string;
  /** Extra rungs of the review ladder that passing just bought. */
  ladder_bonus: number;
  topicId: string;
  roadmapId: string;
};

export type QuizResult = {
  total: number;
  correct: number;
  score: number;
  /**
   * Only what the learner is allowed to see. On a passed checkpoint the answers
   * come back; on a failed one they are ABSENT — not null — and `outcome`/`hint`
   * take their place, so a retry can't be answered by transcription. Treat the
   * answer fields as optional and never assume a failure carries them.
   */
  review: {
    question: number;
    selected: number | null;
    correctAnswer?: number;
    correctOption?: string | null;
    /** What the question was testing. Sent in place of the answer on a failure. */
    outcome?: string | null;
    /** A nudge toward the material, deliberately not the answer. */
    hint?: string | null;
  }[];
  /** False when answers were withheld because the attempt didn't pass. */
  answers_revealed?: boolean;
};

/** A recurring misunderstanding inferred from a learner's wrong answers across
 *  digest checks, checkpoints and reviews. `probe` is server-side only — it
 *  describes how the next question will catch this, so the learner never sees it. */
export type Misconception = {
  label: string;
  detail: string;
  evidence: number[];
};

export type MisconceptionReport = {
  roadmapId: string;
  topicId: string;
  roadmapTitle?: string | null;
  topicTitle?: string | null;
  patterns: Misconception[];
  misses_analyzed: number;
  updatedAt?: string;
};

/**
 * Something the learner wrote down against a topic. One shape covers a jotting,
 * a code snippet, a saved link, and a question to revisit — they differ in how
 * they render and filter, not in what they are.
 */
export type NoteKind = 'note' | 'snippet' | 'link' | 'question';

export type LearningNote = {
  _id: string;
  roadmapId: string;
  topicId: string;
  kind: NoteKind;
  body: string;
  url?: string | null;
  /** Questions get ticked off once answered. */
  resolved: boolean;
  createdAt: string;
  updatedAt?: string;
  /** Resolved server-side at read time; null if the topic was later removed. */
  roadmapTitle?: string | null;
  topicTitle?: string | null;
};

/** Why nothing is coming. Always given rather than left blank, so the home
 *  screen can explain an empty state instead of just being one. */
export type BlockedReason =
  | 'no_roadmap'
  | 'cap_reached'
  /** A recall check on an earlier digest hasn't been passed yet. */
  | 'awaiting_quiz'
  /** A checkpoint was failed; the revision digest has to be read before a retry. */
  | 'needs_revision'
  | 'needs_review'
  | 'roadmap_complete'
  | 'digests_off';

/** One active roadmap's slice of the home screen. */
export type RoadmapFocus = {
  roadmapId: string;
  roadmapTitle: string | null;
  topic: {
    id: string;
    title: string;
    progress_status: ProgressStatus;
    order: number;
  } | null;
  progress: RoadmapProgress;
  /** Unread digests on this roadmap's current topic. */
  unread: number;
  can_generate: boolean;
  /** What's stopping this roadmap specifically. `digests_off` is mirrored down
   *  from the account when nothing more specific applies. */
  blocked_reason: BlockedReason | null;
};

/**
 * What the learner is working on and when the next digest lands.
 *
 * One entry per *active* roadmap, matching the daily sweep — it digests each of
 * them, so showing a single "current" roadmap hid queues that were really there.
 * `next_at` and `cap` sit at the top because the digest schedule is one
 * per-account setting, not a per-roadmap one.
 */
export type LearningFocus = {
  roadmaps: RoadmapFocus[];
  /** Total unread across the roadmaps above. */
  unread: number;
  /** Max unread digests one topic may accumulate before generation stops. */
  cap: number;
  next_at: string | null;
  /** Account-level only: 'no_roadmap' | 'digests_off' | null. */
  blocked_reason: BlockedReason | null;
};

/** When the learner's stated pace gets them to the end of a roadmap. */
export type CompletionForecast = {
  remaining_minutes: number;
  study_days: number;
  calendar_days: number;
  target_date: string;
  minutes_per_day: number;
  days_per_week: number;
  deadline?: string | null;
  /** Null when no deadline is set. */
  on_track?: boolean | null;
};

/**
 * Everything the learner's profile implies about one roadmap. Kept separate from
 * the roadmap document because it's derived, not stored: the forecast moves as
 * topics get completed, and drift moves as the profile is edited.
 */
export type RoadmapInsights = {
  forecast: CompletionForecast | null;
  /** What the roadmap was built from. Null if generated before we recorded it. */
  personalization: Record<string, any> | null;
  /** Personalization inputs that have changed since. */
  profile_changes: string[];
  current_personalization: Record<string, any>;
  /** {topicId: count} — which topics have been written about. */
  note_counts: Record<string, number>;
};

/** The active-recall check a learner must pass to complete a topic. */
export type Checkpoint = {
  quizId: string;
  topicId: string;
  /** Filled in client-side from the request; the server keys it off the quiz. */
  roadmapId: string;
  title: string;
  /** True when this is a spaced-repetition review of an already-completed topic. */
  is_review: boolean;
  pass_score: number;
  questions: QuizQuestion[];
};

export type CheckpointOutcome = {
  passed: boolean;
  score: number;
  pass_score: number;
  total: number;
  correct: number;
  review: QuizResult['review'];
  progress_status: ProgressStatus;
  next_review_at?: string;
  review_count: number;
  was_review: boolean;
  /** The topic that picked up the slot after this one was completed. */
  advanced_to?: { topicId: string; title: string } | null;
};

/** A completed topic whose spaced-repetition review has come due. */
export type DueReview = {
  roadmapId: string;
  roadmapTitle: string;
  topicId: string;
  title: string;
  due_at: string;
  mastery_score?: number;
  review_count: number;
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
  /** `max_active` is the server's cap on how many can run at once — the roadmap
   *  list shows it and disables resume once the slots are full. `paused` is kept
   *  apart from archived: only a paused roadmap is a candidate for a free slot. */
  roadmaps: {
    total: number;
    active: number;
    completed: number;
    paused: number;
    max_active: number;
  };
  topics: { total: number; completed: number; percent: number };
  completed_this_week: number;
  /** Consecutive days ending today with at least one topic completed. */
  streak_days: number;
  /** Completed topics whose spaced-repetition review has come due. */
  reviews_due: number;
  /** Lifetime mean across every attempt ever. Kept for shipped clients, but
   *  `mastery` is the signal worth showing — this one barely moves once there's
   *  any history, and counts week-one failures as evidence about today. */
  quizzes: { attempts: number; average_score: number };
  mastery: MasterySummary;
};

/** How well a topic is actually held right now. `score` is an age-weighted mean
 *  of its attempts; `retention` decays once the scheduled review is overdue; and
 *  `mastery` is the two combined — the number worth showing. */
export type TopicMastery = {
  roadmapId: string;
  roadmapTitle?: string | null;
  topicId: string;
  title?: string | null;
  score: number;
  retention: number;
  mastery: number;
  trend: 'improving' | 'steady' | 'slipping' | 'new';
  /** Newest attempt vs the weighted mean of the ones before it. */
  delta: number;
  attempts: number;
  overdue_days: number;
};

export type MasterySummary = {
  /** Null when nothing has been graded yet — which is not the same as zero. */
  score: number | null;
  trend: 'improving' | 'steady' | 'slipping' | 'new';
  delta: number;
  topics_scored: number;
  /** Up to three, weakest first — what to actually do about it. */
  weakest: TopicMastery[];
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
