/**
 * Where a tapped notification lands.
 *
 * Kept apart from the Expo plumbing so the mapping can be read — and tested — as
 * the one thing it is: the server's `data.type` on one side, a route in this app
 * on the other. Every type the backend sends is listed here; each is raised by
 * the `triggers.py` of the agent it belongs to, under `server/app/agents`.
 *
 * An unrecognised type returns null, which means "open the app and stay put".
 * Tapping always foregrounds the app regardless, so that degrades to landing
 * wherever the user last was — the right outcome for a build that predates a
 * notification type the server has started sending.
 */

/** Payload values arrive as JSON and are typed as unknown, so every read is
 *  narrowed rather than asserted — a number where a string was expected should
 *  drop out of the route, not end up in it as "[object Object]". */
function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * `URLSearchParams` is only partially polyfilled in React Native, so the query
 * is assembled by hand. Undefined values are dropped rather than serialised:
 * `?roadmapId=undefined` is a filter that matches nothing, which the digest
 * screen would render as an empty archive.
 */
function query(params: Record<string, string | undefined>): string {
  const pairs = Object.entries(params)
    .filter((entry): entry is [string, string] => !!entry[1])
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

/**
 * The three learning notifications all point at the digest archive: a digest, a
 * revision and a re-teach are the same artefact to this screen, and it already
 * filters by roadmap and topic straight from its route params — so the payload
 * only has to hand those over.
 */
const DIGEST_TYPES = ['learning_digest', 'learning_revision', 'learning_reteach'];

export function routeForNotification(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Record<string, unknown>;
  const type = str(payload.type);
  if (!type) return null;

  if (DIGEST_TYPES.includes(type)) {
    return `/learning/digests${query({
      roadmapId: str(payload.roadmapId),
      topicId: str(payload.topicId),
    })}`;
  }

  // The agenda is what the digest is a summary of — the tasks themselves, in
  // the same overdue/today/upcoming order the notification body lists them.
  if (type === 'pa_digest') return '/personal-assistant/agenda';

  // A meal plan arrives as a *pending approval*, not a saved plan, so it can
  // only be acted on from the approvals inbox on the preferences screen. The
  // plan detail route wouldn't resolve — nothing has been saved yet.
  if (type === 'save_plan') return '/meal-planner/preferences';

  return null;
}
