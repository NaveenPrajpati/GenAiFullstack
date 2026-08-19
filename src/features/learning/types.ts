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
  /**
   * The MOST RECENT checkpoint's score, overwritten on every attempt.
   *
   * Not a mastery figure, despite the name: it knows nothing about digest checks
   * or reviews, and it does not decay. For how well a topic is actually held,
   * read `RoadmapInsights.topic_mastery` — the same number every other screen
   * shows. Showing this one under the word "mastery" is what had a single topic
   * reporting two different figures in two places.
   */
  mastery_score?: number;
  completed_at?: string;
  next_review_at?: string;
  /** How many checkpoint attempts have FAILED — it only increments on a failure,
   *  because it is the revision debt, not an attempt count. While it exceeds
   *  `revisions_done` the server refuses a retry — see `revisionOwed`. */
  checkpoint_attempts?: number;
  revisions_done?: number;
  /** The questions the last failed attempt got wrong. */
  weak_points?: string[];
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
  /** `revision` follows a failed checkpoint; `reteach` follows two failed recall
   *  checks on the same tips, and re-explains that material a different way.
   *  Absent on the ordinary teaching digests. */
  kind?: 'revision' | 'reteach';
  /** Which explanation style a `reteach` was written in, when the learner has
   *  one on file. */
  style?: string | null;
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
  /** Where the topic stands after marking. `needs_review` with no `generated`
   *  means the drip-feed ended, not that generation failed — the difference
   *  between "take the checkpoint" and "nothing new to send". */
  topic_status?: ProgressStatus | null;
  /** The marked digest was the revision owed by a failed checkpoint, and the
   *  retry is now unblocked. */
  revision_cleared?: boolean;
  topicId: string;
  roadmapId: string;
  /** Client-set, never sent by the server: the mark was made offline and is
   *  waiting in the outbox. Everything derived from the server's reply —
   *  `generated`, `quiz_result`, `remaining` — is a placeholder on this one, so
   *  callers must check it before reading them. */
  queued?: boolean;
};

/** Why a recall check was refused, and whether the agent is re-teaching. */
export type DigestCheckFailure = {
  message: string;
  quiz_result: QuizResult;
  pass_score: number;
  /** Set once the same check has been failed enough times that the teaching is
   *  treated as the problem. A new explanation is on its way. */
  reteaching?: boolean;
  attempts?: number;
};

export type LearningAvailability = {
  minutes_per_day?: number;
  days_per_week?: number;
  preferred_days?: string[];
  deadline?: string;
};

/** What a learner can ask to be taught *with*. Deliberately not `ResourceType`:
 *  the profile schema takes a narrower set than a topic's resources do — it has
 *  `interactive`, and no `course`/`exercise`/`other`. */
export type PreferredResourceType =
  'video' | 'article' | 'documentation' | 'interactive' | 'project' | 'book';

export type ExplanationStyle =
  'concise' | 'step_by_step' | 'examples_first' | 'visual' | 'socratic';

export type QuizDifficulty = 'easy' | 'adaptive' | 'challenging';

export type Memory = {
  skill_level?: Difficulty;
  preferred_resource_types?: PreferredResourceType[];
  preferred_explanation_style?: ExplanationStyle;
  preferred_language?: string;
  goals?: string[];
  availability?: LearningAvailability;
  known_topics?: string[];
  weak_topics?: string[];
  wants_hints_before_answers?: boolean;
  preferred_quiz_difficulty?: QuizDifficulty;
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

/**
 * One thing the briefing offers to do, as a typed instruction rather than a
 * route. The server picks the `kind` from a fixed set and validates it against
 * the learner's actual situation before sending, so a briefing can't offer a
 * checkpoint that would be refused; this client owns where each kind goes.
 */
export type BriefingActionKind =
  | 'open_roadmap'
  | 'read_digests'
  | 'generate_digest'
  | 'open_checkpoint'
  | 'open_reviews'
  | 'create_roadmap'
  /** Put a question to the tutor on the learner's behalf. */
  | 'ask';

export type BriefingAction = {
  kind: BriefingActionKind;
  label: string;
  roadmapId?: string;
  topicId?: string;
  /** `ask` only — the message to send. */
  prompt?: string;
};

/**
 * What the assistant says on arrival, before being asked.
 *
 * The screen already lists what's outstanding; this is the judgement over that
 * list — which one thing to do first and why. It replaces the fixed copy this
 * client used to hold in a lookup keyed on `blocked_reason`, which could state a
 * situation but never weigh two of them against each other.
 *
 * Generated server-side once per *situation*, so it's cheap to ask for on every
 * screen focus. It always answers: a model failure falls back to deterministic
 * copy rather than to nothing.
 */
export type Briefing = {
  headline: string;
  detail: string;
  actions: BriefingAction[];
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
  /**
   * {topicId: mastery} from the same computation behind the home screen's
   * numbers — an age-weighted mean over every graded attempt, decayed once a
   * review goes overdue.
   *
   * Not to be confused with `TopicNode.mastery_score`, which is the *last
   * checkpoint's* score and is overwritten on each attempt. Reading that one and
   * calling it mastery is what had a topic reporting two different figures on
   * two different screens.
   */
  topic_mastery: Record<string, TopicMastery>;
};

/**
 * A short mixed-topic practice deck — the one piece of retrieval in the app that
 * interleaves, and the only thing to do on a day with nothing waiting.
 *
 * It gates nothing and cannot cost anything: attempts feed the misconception
 * tracker but are kept out of mastery, for the same reason a poor Feynman
 * attempt is never recorded. Answers come back in full, because there is no
 * retry here to protect from transcription.
 */
export type PracticeQuestion = QuizQuestion & {
  topicId: string;
  topicTitle?: string;
};

export type PracticeDeck = {
  quizId: string;
  questions: PracticeQuestion[];
  topics: { roadmapId: string; topicId: string; title: string }[];
};

/** How each topic in a deck fared. Weakest first — with the deck mixed, which
 *  topic let you down is the reading worth having. */
export type PracticeTopicResult = {
  roadmapId: string;
  topicId: string;
  title: string;
  correct: number;
  total: number;
};

export type PracticeResult = QuizResult & {
  topics: PracticeTopicResult[];
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
  /** So a learner knows what a failure costs before answering, rather than
   *  discovering the cap by hitting it. */
  attempts_today?: number;
  attempt_limit?: number;
  questions: QuizQuestion[];
};

/** A refused checkpoint attempt: too soon after the last, or out of tries. */
export type CheckpointBlocked = {
  message: string;
  blocked_reason: 'cooldown' | 'daily_limit' | 'needs_revision';
  retry_at?: string;
  attempts_today?: number;
  limit?: number;
  /** On `needs_revision`: the questions the failed attempt got wrong, which the
   *  revision digest is written against. */
  weak_points?: string[];
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
  /** A failed first attempt owes one round of revision before the next one. The
   *  server enforces it, so the client has to carry it onto the topic — see
   *  `revisionOwed` — or it keeps offering a retry that will be refused. */
  needs_revision?: boolean;
  /** The questions this attempt got wrong, verbatim. What the revision digest is
   *  written against, and what the UI can name instead of "go and revise". */
  weak_points?: string[];
  /** Rungs of the review ladder granted for having explained the topic in your
   *  own words — the payout for the Feynman exercise, landing here. */
  feynman_bonus?: number;
  /** Unread digests on this topic that were closed along with it. The tips were
   *  a nudge to study something the learner has now proved they know, so they
   *  leave the catch-up queue rather than sitting there nagging about finished
   *  work. */
  digests_closed?: number;
  /** False when the answers were withheld because the attempt didn't pass. */
  answers_revealed?: boolean;
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
  // The tutor did something rather than describing where the button is. `text`
  // is its own account of what happened; `actions_taken` names the tools that
  // actually ran, which is what decides the screens worth re-reading — a bare
  // "something changed" flag would mean refetching the whole section every turn.
  | { intent: 'take_action'; text: string; actions_taken: string[] }
  | { intent: 'find_resources'; suggestions: Resource[] }
  // `guidance` is the coached sentence beside the numbers: which of it to do
  // first, and why. Optional because it's written by a model over the learner's
  // situation while `progress` is computed and exact — the card renders without
  // it exactly as it did before, rather than losing the answer to a failed call.
  | {
      intent: 'query_roadmap';
      next_topic: string;
      progress: RoadmapProgress;
      guidance?: string;
    }
  | { intent: 'update_progress'; log_status: string; roadmap: Roadmap }
  // `decision` is set once the user answers, which switches the card to a
  // confirmation. Without it the buttons stay live and the same roadmap can be
  // approved twice from a stale bubble.
  | {
      type: 'approval_request';
      proposal: Proposal;
      decision?: 'approved' | 'rejected';
      savedRoadmapId?: string;
      /** Saved, but the active-roadmap cap parked it rather than refusing to
       *  store what the learner just built. Silent until it was said out loud:
       *  they were told "saved" and discovered it wasn't running by noticing no
       *  lessons arrived. */
      savedParked?: boolean;
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

/**
 * Whether a failed checkpoint still owes this topic a round of revision.
 *
 * Mirrors `revision_outstanding` on the server, which is what actually refuses
 * the attempt. Duplicated deliberately: without it the UI offers a checkpoint it
 * knows will be turned away, and the learner finds out by being told no.
 */
export function revisionOwed(topic: TopicNode): boolean {
  return (topic.checkpoint_attempts ?? 0) > (topic.revisions_done ?? 0);
}

/** "45m" / "1.5h" / "2h". Null when the estimate is missing, so callers can
 *  hide the row entirely rather than render "0m". */
export function formatMinutes(mins?: number | null): string | null {
  if (!mins || mins <= 0) return null;
  if (mins < 60) return `${mins}m`;
  const hours = mins / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}
