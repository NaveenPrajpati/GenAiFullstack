/**
 * Wires the offline cache to the app's lifecycle.
 *
 * Three jobs, all of which have to happen exactly once for the whole section
 * rather than per screen — which is why this is a hook mounted in the learning
 * layout and not something each screen calls:
 *
 *  1. read the snapshot into the store at startup, so the first paint is the
 *     last known Today rather than an empty one;
 *  2. write it back whenever the cached slices change;
 *  3. drain the outbox when there is a reason to think the network is back.
 *
 * (3) is the part shaped by not having a connectivity API. Nothing tells this
 * app that the train left the tunnel, so it drains on the moments that
 * correlate with it in practice — the app coming to the foreground (here) and
 * the home screen being focused (`learning/index`) — and otherwise leaves the
 * queue alone. A mark can therefore sit in the outbox after the signal returns,
 * until the learner next looks at the app. That is the intended trade: the
 * alternative is a native module and a rebuild.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { saveSnapshot, type LearningSnapshot } from './cache';
import { useLearningStore } from './store';

/** How long to let changes settle before writing. Marking a digest touches four
 *  slices in a row and triggers a refetch of three more; without this, one tap
 *  would be half a dozen serialisations of the same state. */
const PERSIST_DEBOUNCE_MS = 500;

/** The store's cached slices, by reference. */
function snapshotOf(s: ReturnType<typeof useLearningStore.getState>): LearningSnapshot {
  return {
    roadmaps: s.roadmaps,
    unreadDigests: s.unreadDigests,
    digests: s.digests,
    focus: s.focus,
    stats: s.stats,
    reviews: s.reviews,
  };
}

/**
 * Persists the cached slices on change, debounced. Returns an unsubscribe.
 *
 * Reference equality is the whole test: every store action replaces the arrays
 * it touches, so an unchanged reference means an unchanged slice, and the other
 * seventy-odd fields in the store — chat, quizzes, loading flags, which fire
 * constantly — cost one comparison each and no write.
 */
function persistOnChange(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let previous: LearningSnapshot | null = null;

  const unsubscribe = useLearningStore.subscribe((state) => {
    // Before hydration the store is empty by definition. Writing then would
    // overwrite a perfectly good cache with nothing, which is the one way this
    // module could make an offline launch worse instead of better.
    if (!state.hydrated) return;

    const next = snapshotOf(state);
    if (
      previous &&
      previous.roadmaps === next.roadmaps &&
      previous.unreadDigests === next.unreadDigests &&
      previous.digests === next.digests &&
      previous.focus === next.focus &&
      previous.stats === next.stats &&
      previous.reviews === next.reviews
    ) {
      return;
    }
    previous = next;

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void saveSnapshot(next), PERSIST_DEBOUNCE_MS);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}

export function useOfflineCache(): void {
  useEffect(() => {
    const store = useLearningStore.getState();

    // Hydrate first, then drain: a queued mark that replays before the snapshot
    // lands would have its refetch overwritten by the stale disk copy.
    void store.hydrateFromCache().then(() => useLearningStore.getState().flushPendingMarks());

    const stopPersisting = persistOnChange();

    const subscription = AppState.addEventListener('change', (status) => {
      // Coming back from the background is the closest thing to a reconnection
      // signal available here — it is when the learner surfaces, literally.
      if (status === 'active') void useLearningStore.getState().flushPendingMarks();
    });

    return () => {
      stopPersisting();
      subscription.remove();
    };
  }, []);
}
