/**
 * Maps a structured PlannerResult to friendly chat copy.
 *
 * The /query API has no natural-language `response` field, so the UI derives its
 * own text from `intent` + `plan_status` / `log_status` + the structured fields.
 */
import type { MealType, PlannerResult } from './types';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const dayName = (d: number): string => DAY_NAMES[d] ?? `Day ${d}`;
export const dayShort = (d: number): string => dayName(d).slice(0, 3);

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

export const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🥣',
  lunch: '🥗',
  dinner: '🍽️',
};

/** Friendly Mon-date label, falling back to the raw string. */
export function formatWeekStart(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `Week of ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

const LOG_COPY: Record<string, string> = {
  logged: '✅ Logged to your plan.',
  no_plan: "You don't have an active plan yet — generate one first.",
  conflict: 'Heads up — this dish conflicts with your diet. See the suggestion below.',
  rejected: 'Okay, I won’t log that.',
};

const PLAN_COPY: Record<string, string> = {
  approved: '✅ Plan approved and saved.',
  rejected: 'Plan discarded — nothing was saved.',
  saved: '✅ Plan saved.',
};

export function friendlyResultText(result: PlannerResult): string {
  if (result.plan_status && PLAN_COPY[result.plan_status]) return PLAN_COPY[result.plan_status];
  if (result.log_status && LOG_COPY[result.log_status]) return LOG_COPY[result.log_status];

  switch (result.intent) {
    case 'query':
      return result.meal_slots?.length
        ? 'Here’s what’s planned:'
        : 'Nothing is planned for that yet.';
    case 'research':
      return result.suggestions?.length ? 'Here are some ideas:' : 'No suggestions found.';
    case 'log':
      return result.log_status ? '' : 'Done.';
    default:
      return 'Done.';
  }
}
