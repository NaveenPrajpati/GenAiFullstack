import { router } from 'expo-router';

/**
 * This binary ships three things that are navigationally independent: a landing
 * screen (`app/index`), the RAG chatbot (`app/(rag)`) and the agent suite
 * (`app/(agents)`). The landing screen sits outside both groups, so it is a
 * launcher rather than a drawer route — nothing behind it, no drawer over it.
 *
 * Crossing between any two of them is a *launch*, not a navigation. Everything
 * here uses `replace`, so the root stack never holds more than one entry: there
 * is no back gesture out of RAG into the drawer, none out of the drawer into
 * RAG, and none out of either back into the landing screen. Returning to the
 * launcher is an explicit act — the drawer header, or RAG's sidebar.
 */

/** Where a switch into each destination lands. */
export const LANDING_ENTRY = '/';
export const RAG_ENTRY = '/rag-chatbot';
export const AGENTS_ENTRY = '/assistant';

/** Back to the launcher, from wherever. */
export function openLanding() {
  router.replace(LANDING_ENTRY);
}

/** Launch the RAG app. */
export function openRagApp() {
  router.replace(RAG_ENTRY);
}

/**
 * Launch the agent suite.
 *
 * @param href a route inside `(agents)` — defaults to the supervisor chat,
 *   which is that app's front door. The landing screen passes a skill route
 *   instead when the user picks one of the specialists directly.
 */
export function openAgentsApp(href: string = AGENTS_ENTRY) {
  router.replace(href);
}
