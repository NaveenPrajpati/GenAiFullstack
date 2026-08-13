/**
 * What the home screen widget shows, and how it survives the trip there.
 *
 * This module is deliberately free of native imports so it can run anywhere:
 * the app, the iOS widget bundle, and — the constraint that actually shapes it —
 * Android's headless widget task, which is a *separate JS context* with no
 * access to the live Zustand store. Everything the widget renders therefore has
 * to be flattened into a small serialisable record and persisted, not read from
 * memory.
 *
 * Keep this shape small and primitive. On iOS it crosses into an app-group
 * container as widget props; on Android it round-trips through AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Digest } from '../types';

/** The whole widget state. Primitives only — see the module note. */
export type DigestWidgetData = {
  /** Unread digests waiting across every active roadmap. */
  count: number;
  /** The topic of the next digest to read. Null when the queue is empty. */
  topic: string | null;
  /** Which roadmap that digest belongs to. */
  roadmap: string | null;
  /**
   * The next digest's teaching points, in full and in order.
   *
   * The one field here that isn't a scalar, and the one worth the bytes: it is
   * the only thing the widget can show that is the lesson rather than a count of
   * lessons. Still primitives — an array of strings survives both the
   * AsyncStorage round trip and the app-group crossing.
   */
  bullets: string[];
  /** True when the next digest is gated behind a recall check, which changes
   *  the call to action from "read" to "answer". */
  needsQuiz: boolean;
  /** How many distinct roadmaps have something waiting — the widget says
   *  "across 2 roadmaps" only when that's actually true. */
  roadmaps: number;
  /**
   * False until the app has pushed real state at least once.
   *
   * Without this, "the app has never synced" and "you are genuinely caught up"
   * are both `count: 0`, and the widget confidently claims you're up to date
   * when it simply has no idea. They need different copy, so they need to be
   * different states.
   */
  synced: boolean;
};

export const EMPTY_WIDGET_DATA: DigestWidgetData = {
  count: 0,
  topic: null,
  roadmap: null,
  bullets: [],
  needsQuiz: false,
  roadmaps: 0,
  synced: false,
};

/**
 * Flattens the catch-up queue into what the widget can show.
 *
 * The server already returns `unreadDigests` in the order they should be read,
 * so the first entry is "next up" — this does not re-sort them.
 */
export function toWidgetData(digests: Digest[]): DigestWidgetData {
  // An empty queue is still a real answer, so it is `synced` — unlike the
  // untouched `EMPTY_WIDGET_DATA` the widget starts life with.
  if (digests.length === 0) return { ...EMPTY_WIDGET_DATA, synced: true };

  const next = digests[0];
  return {
    count: digests.length,
    topic: next.topicTitle ?? null,
    roadmap: next.roadmapTitle ?? null,
    // Every point, not a preview: the widget is where the reading happens now,
    // so trimming here would decide for the layout what fits. `?? []` because
    // this arrives from the server, where the field being required is a promise
    // rather than a guarantee.
    bullets: next.bullets ?? [],
    // `quiz` can be present but empty; an empty check is not a check.
    needsQuiz: !!next.quizId && (next.quiz?.length ?? 0) > 0,
    roadmaps: new Set(digests.map((d) => d.roadmapId)).size,
    synced: true,
  };
}

const STORAGE_KEY = 'learning.widget.unreadDigests';

/** Persists the payload for Android's headless task to pick up later. */
export async function saveWidgetData(data: DigestWidgetData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // A widget that misses one update is not worth breaking a screen over.
  }
}

/**
 * Reads the last persisted payload. Falls back to the empty state rather than
 * throwing — the task handler has no UI in which to report a failure, and a
 * widget showing "all caught up" beats one showing a stale render or nothing.
 */
export async function loadWidgetData(): Promise<DigestWidgetData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_WIDGET_DATA;
    return { ...EMPTY_WIDGET_DATA, ...(JSON.parse(raw) as Partial<DigestWidgetData>) };
  } catch {
    return EMPTY_WIDGET_DATA;
  }
}

/** One label for both platforms, so the two widgets can't drift apart. */
export function headline(data: DigestWidgetData): string {
  // Never claim to be caught up on the strength of no data at all.
  if (!data.synced) return 'Not synced yet';
  if (data.count === 0) return 'All caught up';
  if (data.needsQuiz) return 'Recall check first';
  return data.count === 1 ? '1 digest waiting' : `${data.count} digests waiting`;
}

/**
 * Which of the three states the widget is in. Shared so the two platforms tint
 * and caption the same way — `count === 0` alone is not enough to decide, since
 * it covers both "caught up" and "no data yet".
 */
export type WidgetTone = 'unsynced' | 'caughtUp' | 'waiting';

export function tone(data: DigestWidgetData): WidgetTone {
  if (!data.synced) return 'unsynced';
  return data.count === 0 ? 'caughtUp' : 'waiting';
}

/** The single glyph the widget leads with. */
export function badge(data: DigestWidgetData): string {
  if (!data.synced) return '–';
  return data.count === 0 ? '✓' : String(data.count);
}

/** The word under the glyph. */
export function badgeCaption(data: DigestWidgetData): string {
  if (!data.synced) return 'no data';
  return data.count === 0 ? 'done' : 'waiting';
}

/** The second line: what the next digest is actually about. */
export function subline(data: DigestWidgetData): string {
  if (!data.synced) return 'Open the app to load your digests';
  if (data.count === 0) return 'Nothing to read right now';
  if (data.topic) return data.topic;
  return data.roadmaps > 1 ? `Across ${data.roadmaps} roadmaps` : 'Tap to catch up';
}
