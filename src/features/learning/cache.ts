/**
 * What the Learning Tracker remembers between launches, and what it owes the
 * server once it can reach it again.
 *
 * The store this backs is memory-only, which is the right default for a screen
 * you open next to a working connection and the wrong one for the use case this
 * feature actually has: ten minutes on a commute, underground, with the app
 * cold-started. Without a cache that session is a spinner over an empty Today,
 * even though the digests it wants are a few hundred bytes of text that were
 * already fetched yesterday.
 *
 * This module is the same trick `widgets/payload.ts` plays for the home screen
 * widget — flatten the live state into one serialisable record and put it in
 * AsyncStorage — applied to the screens instead of the widget. Like that module
 * it stays free of store imports so it can be tested and reused on its own; the
 * store owns *when* to read and write, this owns *what* that costs and how it
 * fails.
 *
 * Two records, deliberately separate:
 *  - the SNAPSHOT is disposable. Losing it costs a spinner, so every failure
 *    here is swallowed and the app carries on as it does today.
 *  - the OUTBOX is not. It holds work the learner believes is done, so it is
 *    written synchronously with the action that queued it rather than on the
 *    snapshot's debounce, and a write failure there is worth reporting.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Digest, DueReview, LearningFocus, LearningStats, Roadmap } from './types';

/** Bumped when a field's *meaning* changes. A snapshot written by an older
 *  build is dropped rather than migrated — it is a cache, and one cold fetch
 *  rebuilds it. */
const SNAPSHOT_VERSION = 1;

const SNAPSHOT_KEY = 'learning.cache.snapshot';
const OUTBOX_KEY = 'learning.cache.outbox';

/**
 * The slices worth keeping. These are exactly what the four focus-effect
 * fetches on the home screen populate, which is the point: with these on disk,
 * an offline launch renders the same Today as an online one, only stale.
 *
 * Everything else in the store is deliberately absent. Chat threads, quizzes
 * and checkpoints are all mid-conversation state that the server owns and that
 * is actively misleading when replayed from disk hours later.
 */
export type LearningSnapshot = {
  roadmaps: Roadmap[];
  /** The catch-up queue — the reason this cache exists. */
  unreadDigests: Digest[];
  /** The archive, as last browsed. */
  digests: Digest[];
  focus: LearningFocus | null;
  stats: LearningStats | null;
  reviews: DueReview[];
};

/** A snapshot plus when it was taken, which is what the UI needs to say how
 *  stale what it's showing is. */
export type StoredSnapshot = LearningSnapshot & { savedAt: string };

export const EMPTY_SNAPSHOT: LearningSnapshot = {
  roadmaps: [],
  unreadDigests: [],
  digests: [],
  focus: null,
  stats: null,
  reviews: [],
};

/**
 * A `markDigest` the learner performed with no connection.
 *
 * It carries the whole request rather than just the id because it is replayed
 * verbatim later, and it carries `topicId`/`roadmapId` because the synthetic
 * result handed back to the caller needs them and the digest it came from may
 * have been evicted from the queue by then.
 */
export type QueuedMark = {
  digestId: string;
  topicId: string;
  roadmapId: string;
  answers?: { question: number; answer: number }[];
  written?: Record<number, string>;
  generateNext?: boolean;
  /** ISO. Only for display — replay order is the array's order. */
  queuedAt: string;
};

/**
 * Writes the snapshot. Best-effort by design: a cache that throws is worse than
 * one that silently misses an update, since the caller is a state subscription
 * with no user-facing place to put the failure.
 */
export async function saveSnapshot(snapshot: LearningSnapshot): Promise<void> {
  try {
    const stored: StoredSnapshot & { version: number } = {
      ...snapshot,
      version: SNAPSHOT_VERSION,
      savedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(stored));
  } catch {
    // Losing one write costs a spinner on the next cold start, nothing more.
  }
}

/**
 * Reads the last snapshot, or null when there is nothing usable.
 *
 * Null covers all three ways this can come back empty — never written, written
 * by an incompatible build, or corrupt — because the caller does the same thing
 * in every case: start empty and fetch. Anything partial is filled from
 * `EMPTY_SNAPSHOT`, so a field added in a later build reads as absent rather
 * than `undefined` leaking into the store.
 */
export async function loadSnapshot(): Promise<StoredSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSnapshot> & { version?: number };
    if (parsed.version !== SNAPSHOT_VERSION) return null;
    return { ...EMPTY_SNAPSHOT, savedAt: parsed.savedAt ?? new Date().toISOString(), ...parsed };
  } catch {
    return null;
  }
}

/** Reads the queued marks, oldest first. Same all-or-nothing rule as the
 *  snapshot: a half-parsed outbox would replay a half-understood request. */
export async function loadOutbox(): Promise<QueuedMark[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedMark[]) : [];
  } catch {
    return [];
  }
}

/**
 * Replaces the outbox.
 *
 * Unlike the snapshot this one rethrows. The caller queues a mark *because* the
 * network already failed, and if the queue itself cannot be written then the
 * learner's "done" is about to evaporate — that needs to reach them, not be
 * swallowed to keep a screen tidy.
 */
export async function saveOutbox(marks: QueuedMark[]): Promise<void> {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(marks));
}

/**
 * Drops everything this module owns.
 *
 * Called on sign-out. The snapshot holds one account's roadmaps and digests
 * verbatim, so leaving it behind would show the next person to sign in on this
 * device the last person's Today until the first fetch landed.
 */
export async function clearLearningCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([SNAPSHOT_KEY, OUTBOX_KEY]);
  } catch {
    // Nothing useful to do — the session is ending either way.
  }
}
