/**
 * The assistant speaking first.
 *
 * Everything else in this app answers a tap. This is the one surface that says
 * something before it is asked: on arrival at Today, and as the tutor's opening
 * line when the panel is opened with nothing in it.
 *
 * The judgement is the server's — see `build_briefing` — and so are the actions,
 * which arrive as a `kind` from a fixed set plus the ids it applies to, already
 * checked against what the learner can actually do. This file owns only where
 * each kind goes, which is the one thing a server has no business deciding.
 */
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { useLearningStore } from '../store';
import type { Briefing, BriefingAction } from '../types';

/**
 * Turns a briefing action into the thing it does.
 *
 * Two of the kinds don't navigate at all: `generate_digest` pulls a lesson where
 * the learner stands, and `ask` puts a question to the tutor on their behalf.
 * The rest resolve to a screen — and `open_checkpoint` carries the topic through
 * so the roadmap opens *on* it rather than on a list with it somewhere inside.
 */
export function useBriefingAction() {
  const router = useRouter();
  const { generateNextDigest, fetchUnreadDigests, fetchFocus, fetchBriefing, openChat, reviews } =
    useLearningStore();

  return async (action: BriefingAction) => {
    switch (action.kind) {
      case 'generate_digest': {
        await generateNextDigest(action.roadmapId, action.topicId);
        // The queue and what's blocking it both moved, and the briefing was
        // written against the old version of both.
        fetchUnreadDigests();
        fetchFocus();
        fetchBriefing();
        return;
      }

      case 'ask':
        openChat(action.prompt ?? undefined);
        return;

      case 'create_roadmap':
        openChat('Build me a learning roadmap.');
        return;

      case 'read_digests':
        router.push({
          pathname: '/learning/digests',
          params: {
            ...(action.roadmapId ? { roadmapId: action.roadmapId } : {}),
            ...(action.topicId ? { topicId: action.topicId } : {}),
          },
        });
        return;

      case 'open_checkpoint':
        if (!action.roadmapId) return;
        router.push({
          pathname: '/learning/[id]',
          params: {
            id: action.roadmapId,
            ...(action.topicId ? { focusTopic: action.topicId, action: 'checkpoint' } : {}),
          },
        });
        return;

      case 'open_reviews': {
        // The action names no topic — the server offers it whenever anything is
        // due — so the first one due is the one meant, and that's the list the
        // store already holds.
        const first = reviews[0];
        const roadmapId = action.roadmapId ?? first?.roadmapId;
        if (!roadmapId) return;
        const topicId = action.topicId ?? first?.topicId;
        router.push({
          pathname: '/learning/[id]',
          params: {
            id: roadmapId,
            ...(topicId ? { focusTopic: topicId, action: 'checkpoint' } : {}),
          },
        });
        return;
      }

      case 'open_roadmap':
      default:
        router.push(action.roadmapId ? `/learning/${action.roadmapId}` : '/learning/roadmaps');
    }
  };
}

/** The actions as buttons: the first is the recommendation, the rest are the
 *  alternatives, and they read that way. */
export function BriefingActions({
  actions,
  onAction,
  busy,
}: {
  actions: BriefingAction[];
  onAction: (action: BriefingAction) => void;
  busy?: boolean;
}) {
  if (actions.length === 0) return null;
  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {actions.map((a, i) => (
        <Button
          key={`${a.kind}:${i}`}
          label={a.label}
          size="sm"
          variant={i === 0 ? 'primary' : 'secondary'}
          disabled={busy}
          onPress={() => onAction(a)}
        />
      ))}
    </View>
  );
}

/**
 * The briefing on the home screen.
 *
 * Sits above the numbers on purpose: the tiles say how far along you are, which
 * is a different question from what to do in the next ten minutes, and only one
 * of those is worth the top of the screen.
 */
export function BriefingCard({
  briefing,
  loading,
  busy,
  onAction,
}: {
  briefing: Briefing | null;
  loading: boolean;
  busy?: boolean;
  onAction: (action: BriefingAction) => void;
}) {
  // Only on a cold open, and only when there is nothing to show yet: a spinner
  // where a sentence is about to appear is better than the layout jumping, but
  // a spinner replacing a sentence that is probably still true is worse.
  if (loading && !briefing) {
    return (
      <Card className="mb-4 flex-row items-center gap-3">
        <ActivityIndicator size="small" />
        <Text className="text-ink-faint text-[13px]">Working out where you are…</Text>
      </Card>
    );
  }

  if (!briefing) return null;

  return (
    <Card className="border-primary/40 mb-4">
      <Text className="text-primary mb-1.5 text-[12px] font-bold tracking-wider uppercase">
        Your tutor
      </Text>
      <Text className="text-ink text-[17px] leading-snug font-bold">{briefing.headline}</Text>
      {!!briefing.detail && (
        <Text className="text-ink-soft mt-1 text-[15px] leading-relaxed">{briefing.detail}</Text>
      )}
      <BriefingActions actions={briefing.actions} onAction={onAction} busy={busy} />
    </Card>
  );
}
