/**
 * What a topic's state means for what can be done with it.
 *
 * Shared by the roadmap list and the topic screen. Both describe the same five
 * situations, and when they lived in one file it was still possible for the dot
 * and the button beside it to disagree; across two screens it would be a
 * certainty. One description, read by everything that offers the action.
 */
import type { Roadmap, TopicNode } from './types';
import { isCompleted, revisionOwed } from './types';

/** Where a topic stands, from the fields the server owns. */
export type TopicStance = {
  done: boolean;
  /** Fully taught — only the checkpoint stands between here and the next topic. */
  ready: boolean;
  started: boolean;
  /** A failed checkpoint owes revision, and the server refuses a retry until
   *  it's been read. */
  owed: boolean;
};

export function topicStance(topic: TopicNode): TopicStance {
  return {
    done: isCompleted(topic),
    ready: topic.progress_status === 'needs_review',
    started: topic.progress_status === 'in_progress',
    owed: revisionOwed(topic),
  };
}

/**
 * What tapping a topic does, which depends on where that topic stands rather
 * than on any one toggle: it starts it, opens a checkpoint, fetches the revision
 * a failed attempt owes, or un-completes it.
 *
 * One function because the dot and the action button run the same handler and
 * were describing it twice. The visible half had all five cases; the
 * screen-reader half had "Mark X complete" for every one of them, so a control
 * that launches a checkpoint announced itself as a checkbox being ticked.
 * Anything added here has to be said in both places or in neither.
 */
export function topicAction({ done, owed, ready, started }: TopicStance): {
  /** The action button, emoji and all. */
  label: string;
  /** Where the topic stands — the dot's accessibility label, after its title. */
  status: string;
  /** What tapping will do, announced after the label. */
  hint: string;
} {
  if (done) {
    return {
      label: '✓ Completed — mark as not done',
      status: 'completed',
      hint: 'Marks this topic as not done',
    };
  }
  if (owed) {
    return {
      label: '📘 Revise before retrying',
      status: 'revision owed',
      hint: 'Opens the revision this topic owes before another checkpoint attempt',
    };
  }
  if (ready) {
    return {
      label: 'Take the final checkpoint',
      status: 'ready for its checkpoint',
      hint: 'Opens the final checkpoint for this topic',
    };
  }
  if (started) {
    return {
      label: 'Take checkpoint to complete',
      status: 'in progress',
      hint: 'Opens the checkpoint that completes this topic',
    };
  }
  return {
    label: 'Start this topic',
    status: 'not started',
    hint: 'Starts this topic and turns on its daily tips',
  };
}

/** Groups topics under their real stage via `stage_id`. */
export function groupByStages(roadmap: Roadmap) {
  const sorted = [...roadmap.topics].sort((a, b) => a.order - b.order);
  const stages = [...roadmap.stages].sort((a, b) => a.order - b.order);
  if (stages.length === 0) return [{ id: 'all', stage: 'Topics', topics: sorted }];

  const groups = stages.map((s) => ({
    id: s.id,
    stage: s.title,
    topics: sorted.filter((t) => t.stage_id === s.id),
  }));
  // A topic the model never linked to a stage still has to appear somewhere.
  const stageIds = new Set(stages.map((s) => s.id));
  const orphans = sorted.filter((t) => !t.stage_id || !stageIds.has(t.stage_id));
  if (orphans.length) groups.push({ id: 'other', stage: 'Other', topics: orphans });

  return groups.filter((g) => g.topics.length > 0);
}

/** The next topic worth doing: first by order that isn't finished or skipped. */
export function nextTopicOf(roadmap: Roadmap, after?: string): TopicNode | undefined {
  return [...roadmap.topics]
    .sort((a, b) => a.order - b.order)
    .find((t) => t.id !== after && !isCompleted(t) && t.progress_status !== 'skipped');
}
