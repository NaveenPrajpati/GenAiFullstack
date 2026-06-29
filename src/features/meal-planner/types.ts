/**
 * Shared API & domain types for the Meal Planner feature.
 * Mirrors the backend contract at `${BASE_URL}/meal-planner`.
 *
 * Domain note: `day_of_week` is 0–6 where Monday=0 … Sunday=6, and `week_start`
 * is the Monday ISO date of the plan's week.
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner';

/** 0 = Monday … 6 = Sunday. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Plan {
  id: string;
  user: string;
  week_start: string; // ISO date (the Monday)
  status: string;
}

export interface MealSlot {
  id?: string;
  plan_id?: string;
  day_of_week: number; // 0..6, Monday=0
  meal_type: MealType;
  recipe_id?: string;
  recipe_name?: string;
  protein_g?: number;
}

export interface GroceryItem {
  name: string;
  qty?: number;
  unit?: string;
  /** Client-side display only — there is no persistence endpoint for this. */
  checked: boolean;
}

export interface Nutrition {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

export interface ResearchMeal {
  meal_type: string;
  recipe_name: string;
  ingredients: string[];
  prep_minutes: number;
  nutrition?: Nutrition;
}

/** Diet conflict raised while logging a dish. */
export interface DietConflict {
  original: string;
  suggestion?: string;
  day_of_week: number;
  meal_type: string;
}

export type PlannerIntent = 'plan' | 'update' | 'log' | 'query' | 'research';

/**
 * Result of POST /query. There is no natural-language `response` field — the UI
 * is rendered from `intent` + status + the structured fields. All fields besides
 * `intent` are optional and depend on the intent.
 */
export interface PlannerResult {
  intent: PlannerIntent | string;
  plan_status?: string; // e.g. "approved" | "rejected"
  log_status?: string; // e.g. "logged" | "no_plan" | "conflict"
  plan_id?: string;
  meal_slots?: MealSlot[];
  suggestions?: ResearchMeal[] | string[];
  conflict?: DietConflict;
}

export type ProposalType = 'save_plan' | 'update_plan';

/** Human-in-the-loop plan proposal returned by POST /query (needs_approval). */
export interface PlanProposal {
  type: ProposalType;
  approval_id: string;
  week_start: string;
  plan: MealSlot[];
}

export type QueryResponse =
  | { status: 'done'; result: PlannerResult }
  | { status: 'needs_approval'; thread_id: string; proposal: PlanProposal };

/**
 * SSE event from POST /meal-planner/query/stream. The planner graph uses
 * structured output (no text tokens), so streaming surfaces per-node `step`
 * progress, then a terminal `done` result or `needs_approval` proposal.
 */
export interface StreamEvent {
  /** 'thread' | 'step' | 'done' | 'needs_approval' | 'error' (others ignored). */
  type: string;
  node?: string;
  thread_id?: string;
  result?: PlannerResult;
  proposal?: PlanProposal;
  message?: string;
  [key: string]: unknown;
}

/** POST /approve result — on approve, `plan_id` is the saved plan. */
export interface ApproveResult extends PlannerResult {
  plan_id?: string;
}

/** GET /approve — loosely typed; a mix of pending plan/update approvals. */
export interface PendingApproval {
  id?: string;
  thread_id?: string;
  type?: string;
  action_type?: string;
  status?: string;
  week_start?: string;
  created_at?: string;
  plan?: MealSlot[];
  [key: string]: unknown;
}

export type ApprovalDecision = 'approved' | 'rejected';
export type ConflictDecision = 'accept' | 'reject';

/** A single rendered chat turn. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  /** Friendly copy we derive from intent + status (there is no server text). */
  text: string;
  /** Structured payload that drives rich card rendering (assistant turns). */
  result?: PlannerResult;
  /** Present when this turn is an inline HITL plan-approval card. */
  proposal?: PlanProposal;
  /** Present when this turn is an inline diet-conflict card. */
  conflict?: DietConflict;
  /** Set once an inline card is resolved, to lock it. */
  resolved?: ApprovalDecision | ConflictDecision;
  isError?: boolean;
  /** True while a transient progress bubble is streaming step updates. */
  streaming?: boolean;
}
