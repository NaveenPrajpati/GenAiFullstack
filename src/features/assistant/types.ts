/**
 * Shared API & domain types for the unified Assistant (supervisor) feature.
 * Mirrors the backend contract at `${BASE_URL}/assistant`.
 *
 * The supervisor routes one message to one or more *skills*, each of which is a
 * whole agent. Two are LangGraph subgraphs, one is reached over MCP — the UI
 * treats them uniformly, but surfaces which ones ran.
 */

import type { MealSlot } from '@/features/meal-planner/types';
import type { Task } from '@/features/personal-assistant/types';

export type Skill = 'learning' | 'assistant' | 'meal';

// ─── skill results ───────────────────────────────────────────────────────────
// Each skill node returns a compact summary rather than its full agent state,
// so these mirror the summaries built in agents/supervisor/workflow.py.

export interface LearningSummary {
  intent?: string;
  roadmap_status?: string;
  roadmapId?: string;
  roadmap_title?: string;
  topic_count?: number;
  tasks_added_to_todo_list?: number;
  explanation?: string;
  quiz_questions?: number;
  quizId?: string;
  next_topic?: string;
  progress?: {
    next_topic?: string;
    covered_count?: number;
    remaining?: number;
    total?: number;
    percent?: number;
  };
  resources?: string[];
}

export interface AssistantSummary {
  intent?: string;
  status?: string;
  summary?: string;
  tasks?: { title: string; priority?: string; due?: string | null }[];
  subtasks?: string[];
  agenda_counts?: Record<string, number>;
  notes?: string[];
  research?: { summary: string; key_points: string[]; sources: string[] };
}

export interface MealSummary {
  summary?: string;
  plan_status?: string;
  plan_id?: string;
  meals_saved?: number;
  error?: string;
}

export interface SkillResults {
  learning?: LearningSummary;
  assistant?: AssistantSummary;
  meal?: MealSummary;
}

/** Terminal payload of a supervisor turn. */
export interface SupervisorResult {
  response?: string;
  /** Skills the router chose, in execution order. */
  route?: Skill[];
  route_reason?: string;
  completed?: Skill[];
  results?: SkillResults;
  roadmapId?: string;
  plan_id?: string;
}

// ─── approvals ───────────────────────────────────────────────────────────────
// Any skill can pause the turn. The three proposal shapes come from three
// different agents, so field names are not uniform — note `approvalId` on the
// roadmap proposal vs `approval_id` on the others.

export interface RoadmapTopic {
  id: string;
  order: number;
  title: string;
  description: string;
  estimated_hours?: number;
}

export interface RoadmapProposal {
  type: 'save_roadmap' | 'update_roadmap';
  approvalId: string;
  roadmap: {
    title: string;
    summary: string;
    stages?: string[];
    total_estimated_hours?: number;
    topics: RoadmapTopic[];
  };
}

export interface DeleteTaskProposal {
  type: 'pa_delete_task';
  approval_id: string;
  tasks: { id: string; title: string }[];
}

export interface MealPlanProposal {
  type: 'supervisor_save_meal_plan';
  approval_id: string;
  week_start: string;
  plan: MealSlot[];
}

export type Proposal = RoadmapProposal | DeleteTaskProposal | MealPlanProposal;

/** Which skill raised a given proposal — drives the card's colour and copy. */
export function proposalSkill(proposal: Proposal): Skill {
  if (proposal.type === 'pa_delete_task') return 'assistant';
  if (proposal.type === 'supervisor_save_meal_plan') return 'meal';
  return 'learning';
}

export type QueryResponse =
  | { status: 'done'; thread_id: string; result: SupervisorResult }
  | { status: 'needs_approval'; thread_id: string; proposal: Proposal };

/**
 * SSE event from POST /assistant/query/stream.
 *
 * Unlike the per-agent streams, this one carries real `token` events: the
 * supervisor's finalize node generates plain text, so the reply is typed out as
 * it is written. `step` events still report which node is running.
 */
export interface StreamEvent {
  /** 'thread' | 'step' | 'token' | 'done' | 'needs_approval' | 'error'. */
  type: string;
  node?: string;
  token?: string;
  thread_id?: string;
  result?: SupervisorResult;
  proposal?: Proposal;
  message?: string;
  [key: string]: unknown;
}

/** GET /assistant/skills — capability list + live MCP reachability. */
export interface SkillStatus {
  transport: 'langgraph_subgraph' | 'mcp';
  available: boolean;
  server?: string;
  tools?: string[];
}

export type SkillsResponse = Record<Skill, SkillStatus>;

/** GET /assistant/approvals — anything awaiting a decision, any skill. */
export interface PendingApproval {
  id?: string;
  thread_id?: string;
  type?: string;
  title?: string;
  status?: string;
  created_at?: string;
  tasks?: { id: string; title: string }[];
  plan?: MealSlot[];
  [key: string]: unknown;
}

/** A single rendered chat turn. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Rich payload driving the per-skill result cards (assistant turns only). */
  result?: SupervisorResult;
  /** Present when this turn is an inline approval request. */
  approval?: Proposal;
  resolved?: 'approved' | 'rejected';
  isError?: boolean;
  /** True while tokens are still arriving into `text`. */
  streaming?: boolean;
  /** Skills engaged this turn, shown as a trail above the reply. */
  skills?: Skill[];
  /** Live label for the node currently running. */
  step?: string;
}

/** Re-exported so cards can render task rows without importing across features. */
export type { MealSlot, Task };
