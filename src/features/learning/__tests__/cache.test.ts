/**
 * The offline cache and the outbox.
 *
 * Worth pinning because both are invisible when they work and expensive when
 * they don't: a snapshot that silently fails to load is a spinner the user
 * blames on the network, and an outbox entry that is dropped is a digest the
 * learner was told they had finished.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { isOfflineError } from '@/services/http';

import {
  clearLearningCache,
  EMPTY_SNAPSHOT,
  loadOutbox,
  loadSnapshot,
  saveOutbox,
  saveSnapshot,
  type LearningSnapshot,
  type QueuedMark,
} from '../cache';
import type { Digest } from '../types';

const SNAPSHOT_KEY = 'learning.cache.snapshot';
const OUTBOX_KEY = 'learning.cache.outbox';

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

const snapshot = (over: Partial<LearningSnapshot> = {}): LearningSnapshot => ({
  ...EMPTY_SNAPSHOT,
  unreadDigests: [digest('d1')],
  ...over,
});

const mark = (over: Partial<QueuedMark> = {}): QueuedMark => ({
  digestId: 'd1',
  topicId: 't1',
  roadmapId: 'r1',
  queuedAt: '2026-08-17T08:00:00.000Z',
  ...over,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('snapshot', () => {
  it('round-trips the cached slices and stamps when they were saved', async () => {
    await saveSnapshot(snapshot());

    const loaded = await loadSnapshot();
    expect(loaded?.unreadDigests).toEqual([digest('d1')]);
    // The stamp is what the offline notice counts from, so its absence would
    // silently render the screen as live rather than stale.
    expect(Date.parse(loaded!.savedAt)).not.toBeNaN();
  });

  it('reads as absent when nothing has been written', async () => {
    expect(await loadSnapshot()).toBeNull();
  });

  it('drops a snapshot written by an incompatible build', async () => {
    await AsyncStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({ ...snapshot(), version: 99, savedAt: new Date().toISOString() })
    );
    // Rebuilding costs one fetch; guessing at a shape this build no longer
    // understands costs a screen full of wrong data.
    expect(await loadSnapshot()).toBeNull();
  });

  it('drops a corrupt snapshot instead of throwing into the caller', async () => {
    await AsyncStorage.setItem(SNAPSHOT_KEY, '{"unreadDigests":[');
    expect(await loadSnapshot()).toBeNull();
  });

  it('fills slices a newer build added but an older snapshot lacks', async () => {
    await AsyncStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        unreadDigests: [digest('d1')],
      })
    );

    const loaded = await loadSnapshot();
    // Not `undefined` — the store spreads these straight into state, where an
    // undefined array is a crash and an empty one is an empty section.
    expect(loaded?.roadmaps).toEqual([]);
    expect(loaded?.stats).toBeNull();
  });

  it('swallows a failed write — a missed cache must not break a screen', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await expect(saveSnapshot(snapshot())).resolves.toBeUndefined();
  });
});

describe('outbox', () => {
  it('round-trips queued marks in order', async () => {
    await saveOutbox([mark({ digestId: 'd1' }), mark({ digestId: 'd2' })]);
    // Replay order is the array's order, so this is load-bearing, not incidental.
    expect((await loadOutbox()).map((m) => m.digestId)).toEqual(['d1', 'd2']);
  });

  it('reads as empty when nothing is queued or the record is corrupt', async () => {
    expect(await loadOutbox()).toEqual([]);
    await AsyncStorage.setItem(OUTBOX_KEY, 'not json');
    expect(await loadOutbox()).toEqual([]);
  });

  it('rejects a failed write rather than swallowing it', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    // The opposite of the snapshot's rule, and deliberately so: this write is
    // the only record that the learner's work is owed to the server.
    await expect(saveOutbox([mark()])).rejects.toThrow();
  });
});

describe('clearLearningCache', () => {
  it('takes both records, so a new sign-in starts clean', async () => {
    await saveSnapshot(snapshot());
    await saveOutbox([mark()]);

    await clearLearningCache();

    expect(await loadSnapshot()).toBeNull();
    expect(await loadOutbox()).toEqual([]);
  });
});

describe('isOfflineError', () => {
  it('treats an answered request as online however it failed', () => {
    // A 422 is a considered refusal — replaying it later just gets refused again.
    expect(isOfflineError({ response: { status: 422, data: {} } })).toBe(false);
    expect(isOfflineError({ response: { status: 500 } })).toBe(false);
  });

  it('recognises the ways a request never lands', () => {
    expect(isOfflineError({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe(true);
    expect(isOfflineError({ code: 'ECONNABORTED' })).toBe(true);
    expect(isOfflineError({ request: {} })).toBe(true);
  });

  it('is false for anything that is not an error object', () => {
    expect(isOfflineError(null)).toBe(false);
    expect(isOfflineError('offline')).toBe(false);
    expect(isOfflineError(new Error('boom'))).toBe(false);
  });
});
