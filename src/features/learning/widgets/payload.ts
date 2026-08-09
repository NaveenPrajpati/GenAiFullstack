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
  /** True when the next digest is gated behind a recall check, which changes
   *  the call to action from "read" to "answer". */
  needsQuiz: boolean;
  /** How many distinct roadmaps have something waiting — the widget says
   *  "across 2 roadmaps" only when that's actually true. */
  roadmaps: number;
};

export const EMPTY_WIDGET_DATA: DigestWidgetData = {
  count: 0,
  topic: null,
  roadmap: null,
  needsQuiz: false,
  roadmaps: 0,
};

/**
 * Flattens the catch-up queue into what the widget can show.
 *
 * The server already returns `unreadDigests` in the order they should be read,
 * so the first entry is "next up" — this does not re-sort them.
 */
export function toWidgetData(digests: Digest[]): DigestWidgetData {
  if (digests.length === 0) return EMPTY_WIDGET_DATA;

  const next = digests[0];
  return {
    count: digests.length,
    topic: next.topicTitle ?? null,
    roadmap: next.roadmapTitle ?? null,
    // `quiz` can be present but empty; an empty check is not a check.
    needsQuiz: !!next.quizId && (next.quiz?.length ?? 0) > 0,
    roadmaps: new Set(digests.map((d) => d.roadmapId)).size,
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

/** Deep link into the catch-up screen. Matches `scheme` in app.json. */
export const WIDGET_DEEP_LINK = 'aiapps:///learning';

/** One label for both platforms, so the two widgets can't drift apart. */
export function headline(data: DigestWidgetData): string {
  if (data.count === 0) return 'All caught up';
  if (data.needsQuiz) return 'Recall check first';
  return data.count === 1 ? '1 digest waiting' : `${data.count} digests waiting`;
}

/** The second line: what the next digest is actually about. */
export function subline(data: DigestWidgetData): string {
  if (data.count === 0) return 'Nothing to read right now';
  if (data.topic) return data.topic;
  return data.roadmaps > 1 ? `Across ${data.roadmaps} roadmaps` : 'Tap to catch up';
}
