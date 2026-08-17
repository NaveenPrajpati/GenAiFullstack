/**
 * What the store does with no network.
 *
 * The rules under test are the ones a reader of `markDigest` would not guess:
 * a plain digest is banked locally and owed to the server, a digest gated
 * behind a recall check is refused outright, and a replay that the server
 * *answers* is finished business however it answered. Each of those is a
 * deliberate asymmetry, and each is one edit away from becoming a lie told to
 * the learner about work that was never done.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { EMPTY_SNAPSHOT, loadOutbox, saveOutbox, saveSnapshot } from '../cache';
import * as api from '../learningApi';
import { useLearningStore } from '../store';
import type { Digest } from '../types';

// Both are hoisted above the imports above — the store reaches the widget
// through a platform-resolved module that pulls in native code, and nothing
// here is about the widget or about axios.
jest.mock('../widgets/sync', () => ({ syncDigestWidget: jest.fn() }));
jest.mock('../learningApi', () => ({
  markDigest: jest.fn(),
  getDigests: jest.fn(),
  getFocus: jest.fn(),
  getStats: jest.fn(),
}));

const markDigestApi = api.markDigest as jest.Mock;
const getDigests = api.getDigests as jest.Mock;
const getFocus = api.getFocus as jest.Mock;
const getStats = api.getStats as jest.Mock;

/** An axios failure where the request never reached the server. */
const offline = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
/** An axios failure the server chose to send. */
const refused = (status: number, detail: string) => ({ response: { status, data: { detail } } });

const digest = (id: string, over: Partial<Digest> = {}): Digest => ({
  _id: id,
  roadmapId: 'r1',
  topicId: 't1',
  topicTitle: 'Closures',
  bullets: ['A closure captures its scope'],
  resources: [],
  status: 'unread',
  createdAt: '2026-08-01T09:00:00.000Z',
  ...over,
});

/** A digest whose acknowledgement is gated behind a graded recall check. */
const gated = (id: string) =>
  digest(id, {
    quizId: 'q1',
    quiz: [{ question: 'What is captured?', options: ['scope', 'time'] }],
  });

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  useLearningStore.setState({
    unreadDigests: [],
    digests: [],
    pendingMarks: [],
    focus: null,
    stats: null,
    reviews: [],
    roadmaps: [],
    hydrated: true,
    cacheSavedAt: null,
    reachedServer: false,
  });
  getDigests.mockResolvedValue({ result: [] });
  getFocus.mockResolvedValue({ result: null });
  getStats.mockResolvedValue({ result: null });
});

describe('marking a digest offline', () => {
  it('banks it locally and owes it to the server', async () => {
    useLearningStore.setState({ unreadDigests: [digest('d1')], digests: [digest('d1')] });
    markDigestApi.mockRejectedValueOnce(offline());

    const result = await useLearningStore.getState().markDigest('d1', { generateNext: true });

    // `queued` is what stops the caller reading the placeholder fields as if the
    // server had filled them in.
    expect(result.queued).toBe(true);
    expect(result.generated).toBeNull();
    expect(result.topicId).toBe('t1');

    const state = useLearningStore.getState();
    expect(state.unreadDigests).toEqual([]);
    expect(state.digests[0].status).toBe('marked');
    expect(state.pendingMarks).toHaveLength(1);
    // On disk, not just in memory — the commute case includes the app being killed.
    expect(await loadOutbox()).toMatchObject([{ digestId: 'd1', generateNext: true }]);
  });

  it('refuses a digest gated behind a recall check, and leaves it in the queue', async () => {
    useLearningStore.setState({ unreadDigests: [gated('d2')] });
    markDigestApi.mockRejectedValueOnce(offline());

    await expect(
      useLearningStore.getState().markDigest('d2', { answers: [{ question: 0, answer: 0 }] })
    ).rejects.toThrow(/offline/i);

    // Accepting it would have told the learner they passed a check that only the
    // server can grade — and that might fail when it finally runs.
    expect(useLearningStore.getState().unreadDigests).toHaveLength(1);
    expect(useLearningStore.getState().pendingMarks).toEqual([]);
    expect(await loadOutbox()).toEqual([]);
  });

  it('does not queue a digest it knows nothing about', async () => {
    markDigestApi.mockRejectedValueOnce(offline());
    await expect(useLearningStore.getState().markDigest('ghost', {})).rejects.toThrow(/offline/i);
    expect(await loadOutbox()).toEqual([]);
  });

  it('leaves a refusal from the server alone — it is not a connectivity problem', async () => {
    useLearningStore.setState({ unreadDigests: [digest('d1')] });
    markDigestApi.mockRejectedValueOnce(refused(409, 'Already marked.'));

    await expect(useLearningStore.getState().markDigest('d1', {})).rejects.toThrow(
      'Already marked.'
    );
    expect(useLearningStore.getState().pendingMarks).toEqual([]);
  });

  it('queues a second mark for the same digest only once', async () => {
    useLearningStore.setState({ unreadDigests: [digest('d1')], digests: [digest('d1')] });
    markDigestApi.mockRejectedValue(offline());

    await useLearningStore.getState().markDigest('d1', {});
    // The card is gone from the queue, but the archive screen can still reach it.
    await useLearningStore.getState().markDigest('d1', {});

    expect(useLearningStore.getState().pendingMarks).toHaveLength(1);
  });
});

describe('replaying the outbox', () => {
  const queued = (digestId: string) => ({
    digestId,
    topicId: 't1',
    roadmapId: 'r1',
    queuedAt: '2026-08-17T08:00:00.000Z',
  });

  it('sends the queue oldest first and reconciles with the server afterwards', async () => {
    await saveOutbox([queued('d1'), queued('d2')]);
    useLearningStore.setState({ pendingMarks: [queued('d1'), queued('d2')] });
    markDigestApi.mockResolvedValue({ result: {} });

    const left = await useLearningStore.getState().flushPendingMarks();

    expect(left).toBe(0);
    expect(markDigestApi.mock.calls.map((c) => c[0])).toEqual(['d1', 'd2']);
    expect(await loadOutbox()).toEqual([]);
    // The offline guesses were local; only a refetch says what the server did.
    expect(getDigests).toHaveBeenCalled();
  });

  it('stops at the first network failure and keeps everything still owed', async () => {
    useLearningStore.setState({ pendingMarks: [queued('d1'), queued('d2')] });
    markDigestApi.mockRejectedValue(offline());

    const left = await useLearningStore.getState().flushPendingMarks();

    expect(left).toBe(2);
    // Not two attempts: the first failure already answered the question.
    expect(markDigestApi).toHaveBeenCalledTimes(1);
    expect(getDigests).not.toHaveBeenCalled();
  });

  it('drops a mark the server refuses, so it cannot block the queue behind it', async () => {
    useLearningStore.setState({ pendingMarks: [queued('d1'), queued('d2')] });
    // The usual cause is this queue's own work arriving twice.
    markDigestApi.mockRejectedValueOnce(refused(409, 'Already marked.'));
    markDigestApi.mockResolvedValueOnce({ result: {} });

    expect(await useLearningStore.getState().flushPendingMarks()).toBe(0);
    expect(markDigestApi).toHaveBeenCalledTimes(2);
  });

  it('collapses concurrent drains into one', async () => {
    useLearningStore.setState({ pendingMarks: [queued('d1')] });
    markDigestApi.mockResolvedValue({ result: {} });

    // App-foreground and screen-focus can both fire in the same tick.
    await Promise.all([
      useLearningStore.getState().flushPendingMarks(),
      useLearningStore.getState().flushPendingMarks(),
    ]);

    expect(markDigestApi).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is nothing owed', async () => {
    expect(await useLearningStore.getState().flushPendingMarks()).toBe(0);
    expect(markDigestApi).not.toHaveBeenCalled();
  });
});

describe('hydrating from the snapshot', () => {
  it('fills the store from disk and records how old it is', async () => {
    await saveSnapshot({ ...EMPTY_SNAPSHOT, unreadDigests: [digest('d1')] });
    useLearningStore.setState({ hydrated: false });

    await useLearningStore.getState().hydrateFromCache();

    const state = useLearningStore.getState();
    expect(state.unreadDigests).toHaveLength(1);
    expect(state.hydrated).toBe(true);
    expect(state.cacheSavedAt).not.toBeNull();
    // Stale content plus no contact with the server is what the notice reads.
    expect(state.reachedServer).toBe(false);
  });

  it('never overwrites a slice a response has already filled', async () => {
    await saveSnapshot({ ...EMPTY_SNAPSHOT, unreadDigests: [digest('stale')] });
    // The disk read is a bridge round trip; a fetch fired on mount can beat it.
    useLearningStore.setState({ unreadDigests: [digest('fresh')], hydrated: false });

    await useLearningStore.getState().hydrateFromCache();

    expect(useLearningStore.getState().unreadDigests.map((d) => d._id)).toEqual(['fresh']);
  });

  it('marks itself hydrated even with nothing on disk, so screens stop waiting', async () => {
    useLearningStore.setState({ hydrated: false });
    await useLearningStore.getState().hydrateFromCache();

    expect(useLearningStore.getState().hydrated).toBe(true);
    expect(useLearningStore.getState().cacheSavedAt).toBeNull();
  });

  it('picks the outbox back up after a restart', async () => {
    await saveOutbox([{ digestId: 'd9', topicId: 't1', roadmapId: 'r1', queuedAt: 'x' }]);
    useLearningStore.setState({ hydrated: false, pendingMarks: [] });

    await useLearningStore.getState().hydrateFromCache();

    expect(useLearningStore.getState().pendingMarks).toHaveLength(1);
  });
});
