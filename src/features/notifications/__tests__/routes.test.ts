/**
 * The notification → route mapping.
 *
 * Worth pinning because the two halves ship separately: the server decides
 * `data.type` and this decides what it opens, and nothing between them fails
 * loudly when they disagree. A type the app has dropped, or a param renamed on
 * one side only, shows up as a notification that opens the wrong screen — or,
 * before any of this existed, as one that opened nothing at all.
 */
import { routeForNotification } from '../routes';

describe('learning notifications', () => {
  // All three land on the topic: to the learner a digest, a revision and a
  // re-teach are the same artefact, and the topic screen is where the lesson can
  // be read *and* its recall check answered without a second hop.
  it.each(['learning_digest', 'learning_revision', 'learning_reteach'])(
    '%s opens the topic it is about',
    (type) => {
      expect(routeForNotification({ type, roadmapId: 'r1', topicId: 't1' })).toBe(
        '/learning/r1/t1'
      );
    }
  );

  it('falls back to the archive when the payload cannot address a topic', () => {
    // The topic route needs both ids. Without them the archive is the only
    // destination that resolves — and `?roadmapId=undefined` is a filter that
    // matches nothing, which would render as an empty archive.
    expect(routeForNotification({ type: 'learning_digest' })).toBe('/learning/digests');
    expect(routeForNotification({ type: 'learning_digest', roadmapId: 'r1' })).toBe(
      '/learning/digests?roadmapId=r1'
    );
    expect(routeForNotification({ type: 'learning_digest', topicId: 't1' })).toBe(
      '/learning/digests?topicId=t1'
    );
  });

  it('escapes ids so a stray character cannot forge a second parameter', () => {
    expect(routeForNotification({ type: 'learning_digest', roadmapId: 'a&topicId=b' })).toBe(
      '/learning/digests?roadmapId=a%26topicId%3Db'
    );
  });

  it('escapes ids so a stray slash cannot forge a path segment', () => {
    expect(
      routeForNotification({ type: 'learning_digest', roadmapId: 'r1/x', topicId: 't1' })
    ).toBe('/learning/r1%2Fx/t1');
  });

  it('ignores non-string ids instead of stringifying them into the query', () => {
    expect(routeForNotification({ type: 'learning_digest', roadmapId: 42, topicId: null })).toBe(
      '/learning/digests'
    );
  });
});

describe('the other agents', () => {
  it('routes a task digest to the agenda it summarises', () => {
    expect(routeForNotification({ type: 'pa_digest', pending_count: 3 })).toBe(
      '/personal-assistant/agenda'
    );
  });

  it('routes a meal plan to the approvals inbox, not the plan detail', () => {
    // The plan is still a pending approval at this point — nothing is saved, so
    // there is no plan id for a detail route to resolve.
    expect(routeForNotification({ type: 'save_plan', week_start: '2026-08-17' })).toBe(
      '/meal-planner/preferences'
    );
  });
});

describe('payloads this build cannot act on', () => {
  // Null means "the tap already foregrounded the app, and that is all this
  // notification promised" — the right outcome for a client older than the
  // server sending it.
  it.each([
    ['an unknown type', { type: 'something_new' }],
    ['a missing type', { roadmapId: 'r1' }],
    ['an empty payload', {}],
    ['no data at all', undefined],
    ['null', null],
    ['a non-object payload', 'learning_digest'],
  ])('%s opens nothing', (_label, data) => {
    expect(routeForNotification(data)).toBeNull();
  });
});
