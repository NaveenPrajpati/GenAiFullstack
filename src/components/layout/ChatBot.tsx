import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useWideNav } from '@/components/ui/SectionNav';
import { useColors } from '@/components/ui/theme';
import { useAuth } from '@/context/AuthContext';
import { BriefingActions, useBriefingAction } from '@/features/learning/components/Briefing';
import { ChatMarkdown } from '@/features/learning/components/Markdown';
import { useLearningStore } from '@/features/learning/store';
import type {
  ChatMessage,
  OnboardingPrompt,
  Proposal,
  QuizResult,
  Resource,
  RoadmapProgress,
  SelectedTopic,
} from '@/features/learning/types';
import { formatMinutes } from '@/features/learning/types';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { ArrowUpIcon, SparklesIcon, XIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Panel width when docked to the side of a desktop layout. */
const DOCK_WIDTH = 400;
/** Gap from the screen edge for the collapsed button. */
const GUTTER = 16;

/* ─── Message card sub-components ─── */

/** The shared shell for every structured reply — one frame, four accents. */
function ResultCard({
  label,
  tone = 'primary',
  children,
}: {
  label: string;
  tone?: 'primary' | 'success' | 'warning';
  children: React.ReactNode;
}) {
  const accent =
    tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-primary';
  return (
    <View className="border-line bg-surface rounded-2xl border p-4">
      <Text className={`mb-2 text-[12px] font-bold tracking-wider uppercase ${accent}`}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function ExplainCard({ text }: { text: string }) {
  return (
    <ResultCard label="Explanation">
      <ChatMarkdown markdown={text} />
    </ResultCard>
  );
}

/**
 * The tutor reporting something it did, rather than something it knows.
 *
 * Given its own treatment because the difference matters: an explanation is
 * yours to act on, and this has already happened. A turn that changed the
 * learner's roadmap reading like every other paragraph of prose is how someone
 * ends up not noticing that their topic moved.
 *
 * `actions_taken` is empty when the tutor declined — it explains why instead, and
 * that is a normal outcome rather than a failure, so it loses the tick and the
 * success tone but keeps the frame.
 */
function ActionCard({ text, changed }: { text: string; changed: boolean }) {
  return (
    <ResultCard label={changed ? '✓ Done' : 'Not done'} tone={changed ? 'success' : 'warning'}>
      <ChatMarkdown markdown={text} />
    </ResultCard>
  );
}

function ResourcesCard({ suggestions }: { suggestions: Resource[] }) {
  return (
    <ResultCard label="Resources">
      {suggestions.map((r, i) => (
        <TouchableOpacity
          key={i}
          disabled={!r.url}
          onPress={() => r.url && Linking.openURL(r.url).catch(() => {})}
          activeOpacity={0.7}>
          <Text
            className={`text-[15px] ${r.url ? 'text-primary underline' : 'text-ink-soft'}`}
            numberOfLines={2}>
            {r.title}
          </Text>
          {!!r.resource_type && r.resource_type !== 'other' && (
            <Text className="text-ink-faint mb-2 text-[13px] capitalize">{r.resource_type}</Text>
          )}
        </TouchableOpacity>
      ))}
    </ResultCard>
  );
}

function ProgressCard({
  next_topic,
  progress,
}: {
  next_topic: string | null;
  progress: RoadmapProgress;
}) {
  return (
    <ResultCard label="Your progress" tone="success">
      <Text className="text-ink mb-2.5 text-[15px] font-semibold">
        {next_topic ? `Next: ${next_topic}` : 'All topics complete 🎉'}
      </Text>
      <ProgressBar pct={progress.percent} tone="success" />
      <Text className="text-ink-faint mt-1.5 text-[13px]">
        {progress.completed_count}/{progress.total} topics · {progress.remaining} remaining
      </Text>
    </ResultCard>
  );
}

function QuizResultCard({ result }: { result: QuizResult }) {
  return (
    <ResultCard label="Quiz graded" tone="warning">
      <Text className="text-ink mb-2 text-[20px] font-extrabold">
        {result.correct}/{result.total} · {result.score}%
      </Text>
      {result.review.length > 0 && (
        <View>
          <Text className="text-ink-soft mb-1 text-[13px] font-bold">What to review</Text>
          {result.review.map((r, i) => (
            <Text key={i} className="text-ink-soft text-[13px]">
              • Q{r.question + 1} — correct answer: {r.correctOption ?? '—'}
            </Text>
          ))}
        </View>
      )}
    </ResultCard>
  );
}

/**
 * The first-run profile questions. The turn the learner sent is paused on the
 * server until this is answered or skipped, so the card always offers a way out.
 */
function OnboardingCard({
  prompt,
  onSubmit,
  submitting,
}: {
  prompt: OnboardingPrompt;
  onSubmit: (answers: Record<string, string> | null) => void;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const allAnswered = prompt.questions.every((q) => answers[q.key]);

  return (
    <ResultCard label="Let's personalize">
      {prompt.questions.map((q) => (
        <View key={q.key} className="mb-3">
          <Text className="text-ink mb-2 text-[15px] font-medium">{q.q}</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {q.options.map((opt) => {
              const isSel = answers[q.key] === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setAnswers((a) => ({ ...a, [q.key]: opt }))}
                  className={`rounded-full border px-3 py-1.5 ${
                    isSel ? 'border-primary bg-primary' : 'border-line bg-surface-alt'
                  }`}
                  activeOpacity={0.7}>
                  <Text
                    className={`text-[13px] font-semibold capitalize ${
                      isSel ? 'text-on-primary' : 'text-ink-soft'
                    }`}>
                    {opt.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      <View className="mt-1 flex-row gap-2">
        <Button
          label="Save"
          full
          disabled={!allAnswered}
          loading={submitting}
          onPress={() => onSubmit(answers)}
        />
        {prompt.skippable !== false && (
          <Button label="Skip" variant="secondary" full onPress={() => onSubmit(null)} />
        )}
      </View>
    </ResultCard>
  );
}

/** The way into the practice screen. `primary`, not `warning`: warning is the
 *  checkpoint's colour throughout the app, and dressing a practice set in it
 *  says this is the one that decides whether a topic is finished. It isn't. */
function QuizLaunchCard({ onStart }: { onStart: () => void }) {
  return (
    <ResultCard label="Practice ready">
      <Text className="text-ink-soft mb-3 text-[15px]">
        Questions on what you asked about. It won&apos;t complete a topic — only a checkpoint does
        that.
      </Text>
      <Button label="Start practice" onPress={onStart} />
    </ResultCard>
  );
}

function ProposalCard({
  proposal,
  decision,
  savedRoadmapId,
  onApprove,
  onReject,
  onView,
  approving,
}: {
  proposal: Proposal;
  decision?: 'approved' | 'rejected';
  savedRoadmapId?: string;
  onApprove: () => void;
  onReject: () => void;
  onView: (roadmapId?: string) => void;
  approving: boolean;
}) {
  const p = proposal.roadmap;
  return (
    <ResultCard label="Proposed roadmap">
      <Text className="text-ink mb-1 text-[17px] font-bold">{p?.title}</Text>
      {!!p?.summary && (
        <Text className="text-ink-soft mb-3 text-[15px] leading-relaxed">{p.summary}</Text>
      )}

      <View className="mb-3 flex-row flex-wrap gap-1.5">
        {(p?.stages ?? []).map((s) => (
          <View key={s.order} className="bg-surface-alt rounded-full px-2.5 py-1">
            <Text className="text-ink-soft text-[13px] font-bold">{s.title}</Text>
          </View>
        ))}
        {!!p?.total_estimated_hours && (
          <View className="bg-primary-soft rounded-full px-2.5 py-1">
            <Text className="text-primary text-[13px] font-bold">
              {p.total_estimated_hours}h total
            </Text>
          </View>
        )}
      </View>

      {(p?.topics ?? []).length > 0 && (
        <View className="bg-surface-alt mb-4 rounded-xl p-3">
          <Text className="text-ink-faint mb-2 text-[12px] font-bold tracking-wider uppercase">
            {p.topics.length} topics
          </Text>
          {p.topics.map((t, i) => {
            const duration = formatMinutes(t.estimated_minutes);
            return (
              <Text key={i} className="text-ink-soft text-[13px]">
                {t.order}. {t.title}
                {duration ? ` · ${duration}` : ''}
              </Text>
            );
          })}
        </View>
      )}

      {decision === 'approved' ? (
        <TouchableOpacity
          onPress={() => onView(savedRoadmapId)}
          className="bg-success-soft items-center rounded-xl py-2.5"
          activeOpacity={0.8}>
          <Text className="text-success text-[13px] font-bold">✓ Roadmap saved — view it</Text>
        </TouchableOpacity>
      ) : decision === 'rejected' ? (
        <View className="bg-surface-alt items-center rounded-xl py-2.5">
          <Text className="text-ink-faint text-[13px] font-medium">Discarded</Text>
        </View>
      ) : (
        <View className="flex-row gap-2">
          <Button label="Approve & save" full loading={approving} onPress={onApprove} />
          <Button label="Reject" variant="secondary" full onPress={onReject} />
        </View>
      )}
    </ResultCard>
  );
}

function Bubble({
  msg,
  onApprove,
  onReject,
  onStartQuiz,
  onOnboard,
  onView,
  approving,
}: {
  msg: ChatMessage;
  onApprove: () => void;
  onReject: () => void;
  onStartQuiz: () => void;
  onOnboard: (answers: Record<string, string> | null) => void;
  onView: (roadmapId?: string) => void;
  approving: boolean;
}) {
  if (msg.role === 'user') {
    return (
      <View className="mb-3 items-end">
        <View className="bg-primary max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5">
          <Text className="text-on-primary text-[15px] leading-relaxed">{msg.content}</Text>
        </View>
      </View>
    );
  }

  const d = msg.data;

  if (!d) {
    return (
      <View className="mb-3 items-start">
        <View className="bg-surface-alt max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5">
          <ChatMarkdown markdown={msg.content} streaming={msg.streaming} />
        </View>
      </View>
    );
  }

  // Structured replies are cards, not bubbles, and they take the full column —
  // fixed pixel widths cut them off inside the narrower docked panel.
  //
  // No `items-start` here: aligning to the start leaves the card content-sized,
  // and a reply whose natural width beats the panel's (a comparison table, a
  // long code line) then stretches the card out past the edge — taking the body
  // text with it, since it wraps to the card. Stretching to the column instead
  // gives the renderer a definite width to wrap and scroll against.
  const card = (node: React.ReactNode) => <View className="mb-3 w-full">{node}</View>;

  if ('intent' in d) {
    if (d.intent === 'explain') return card(<ExplainCard text={d.topic_explaination} />);
    if (d.intent === 'take_action')
      return card(<ActionCard text={d.text} changed={d.actions_taken.length > 0} />);
    if (d.intent === 'quiz') return card(<QuizLaunchCard onStart={onStartQuiz} />);
    if (d.intent === 'submit_quiz') return card(<QuizResultCard result={d.quiz_result} />);
    if (d.intent === 'find_resources') return card(<ResourcesCard suggestions={d.suggestions} />);
    if (d.intent === 'query_roadmap')
      return card(<ProgressCard next_topic={d.next_topic} progress={d.progress} />);
    if (d.intent === 'update_progress')
      return (
        <View className="mb-3 items-start">
          <View className="bg-surface-alt max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5">
            <Text className="text-ink text-[15px]">
              {d.log_status === 'updated' ? '✓ Progress updated!' : 'Topic not found.'}
            </Text>
          </View>
        </View>
      );
  }

  if ('type' in d && d.type === 'approval_request')
    return card(
      <ProposalCard
        proposal={d.proposal}
        decision={d.decision}
        savedRoadmapId={d.savedRoadmapId}
        onApprove={onApprove}
        onReject={onReject}
        onView={onView}
        approving={approving}
      />
    );

  if ('type' in d && d.type === 'onboarding')
    return card(<OnboardingCard prompt={d.prompt} onSubmit={onOnboard} submitting={approving} />);

  return (
    <View className="mb-3 items-start">
      <View className="bg-surface-alt max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5">
        <ChatMarkdown markdown={msg.content} />
      </View>
    </View>
  );
}

/** The "or try:" pills — one tap instead of composing an opening question. */
function Suggestions({
  items,
  onPick,
  disabled,
}: {
  items: { label: string; prompt: string }[];
  onPick: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <View className="flex-row flex-wrap justify-center gap-2">
      {items.map((s) => (
        <TouchableOpacity
          key={s.label}
          onPress={() => onPick(s.prompt)}
          disabled={disabled}
          activeOpacity={0.7}
          className={`border-line bg-surface-alt rounded-full border px-3.5 py-2 ${
            disabled ? 'opacity-50' : ''
          }`}>
          <Text className="text-ink text-[13px] font-bold">{s.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * Topic-scoped shortcuts on the roadmap screen. These used to sit on every
 * topic card, which repeated the same three buttons down the whole roadmap;
 * now the learner taps a topic and the actions appear here once.
 */
function TopicActions({
  topic,
  roadmapTitle,
  onAsk,
  disabled,
}: {
  topic: SelectedTopic;
  roadmapTitle?: string;
  onAsk: (prompt: string) => void;
  disabled: boolean;
}) {
  const from = roadmapTitle ? ` from the "${roadmapTitle}" roadmap` : '';
  const actions = [
    // First because it's the one that changes something: the other three answer
    // questions about the topic, this one picks it up.
    { label: 'Start it', prompt: `Start "${topic.title}"${from} for me` },
    { label: 'Explain', prompt: `Explain "${topic.title}"${from}` },
    { label: 'Quiz me', prompt: `Quiz me on "${topic.title}"${from}` },
    { label: 'Resources', prompt: `Find resources for "${topic.title}"${from}` },
  ];

  return (
    <View className="border-line border-t px-4 py-3">
      <Text className="text-ink-faint mb-2 text-[13px]" numberOfLines={1}>
        Selected: <Text className="text-ink font-bold">{topic.title}</Text>
      </Text>
      <View className="flex-row gap-2">
        {actions.map((a) => (
          <TouchableOpacity
            key={a.label}
            onPress={() => onAsk(a.prompt)}
            disabled={disabled}
            className={`bg-primary-soft flex-1 items-center rounded-xl py-2 ${
              disabled ? 'opacity-50' : ''
            }`}
            activeOpacity={0.7}>
            <Text className="text-primary text-[13px] font-bold">{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/* ─── Main overlay ─── */

export default function ChatBot() {
  const { token } = useAuth();
  const router = useRouter();
  const {
    prefill,
    source,
    roadmapId: roadmapIdParam,
  } = useGlobalSearchParams<{
    prefill?: string;
    roadmapId?: string;
    source?: string;
  }>();

  // The panel is mounted once for the whole section, so its context comes from
  // the route. Read off the pathname rather than useSegments so nothing depends
  // on how the router spells a dynamic segment: under /learning, anything that
  // isn't one of the named screens IS a roadmap id.
  const pathname = usePathname();
  const screen = pathname.split('/')[2] ?? '';
  const onRoadmapDetail = !['', 'quiz', 'digests', 'settings', 'notes', 'roadmaps'].includes(
    screen
  );
  const roadmapId = roadmapIdParam ?? (onRoadmapDetail ? screen : undefined);

  // The RAG path answers via the streaming endpoint; every other path uses the
  // plain (non-streaming) POST /query.
  const useStream = source === 'rag';
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState(prefill ?? '');
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState('');

  const insets = useSafeAreaInsets();
  const colors = useColors();
  // Same breakpoint as the section sidebar, so the two wide-screen layouts
  // appear together rather than one at a time.
  const docked = useWideNav();

  const {
    chatMessages,
    chatLoading,
    sendChatMessage,
    resolveProposal,
    resolveOnboarding,
    resetChat,
    roadmaps,
    selectedTopic,
    // Open state lives in the store because the briefing opens this panel from
    // a screen that isn't its parent — see `openChat`.
    chatOpen: openBot,
    openChat,
    closeChat,
    consumeChatPrompt,
    briefing,
    fetchBriefing,
  } = useLearningStore();
  const runBriefingAction = useBriefingAction();

  const roadmapTitle = roadmaps.find((r) => r._id === roadmapId)?.title;
  // A selection made on one roadmap must not leak into another's chat.
  const topic = selectedTopic?.roadmapId === roadmapId ? selectedTopic : null;

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [chatMessages.length, chatLoading]);

  // A question handed over by the briefing is sent as though the learner had
  // typed it. One-shot — `consumeChatPrompt` clears as it reads, so re-opening
  // the panel later doesn't re-ask what was already asked.
  useEffect(() => {
    if (!openBot || !token) return;
    const queued = consumeChatPrompt();
    if (queued) sendChatMessage(queued, roadmapId, useStream);
  }, [openBot, token]);

  // The panel's opening line is the same briefing Today shows. Fetched here too
  // because the tutor follows the learner across the whole section and may be
  // opened from a screen that never asked for one; on a repeat it's a cache read.
  useEffect(() => {
    if (openBot && !briefing) fetchBriefing();
  }, [openBot]);

  const handleSend = () => {
    if (!input.trim() || chatLoading || !token) return;
    const text = input.trim();
    setInput('');
    sendChatMessage(text, roadmapId, useStream);
  };

  const handleAsk = (prompt: string) => {
    if (chatLoading || !token) return;
    sendChatMessage(prompt, roadmapId, useStream);
  };

  // What the panel offers depends on where the learner is standing.
  // Each set leads with something that *does* rather than explains. The tutor can
  // act now, and a learner has no way to discover that from a panel whose every
  // suggestion asks it a question.
  const suggestions = topic
    ? [
        { label: 'Start this topic', prompt: `Start "${topic.title}" for me` },
        { label: 'Explain this', prompt: `Explain "${topic.title}"` },
        { label: 'Quiz me', prompt: `Quiz me on "${topic.title}"` },
        { label: 'Find resources', prompt: `Find resources for "${topic.title}"` },
      ]
    : onRoadmapDetail
      ? [
          { label: "Today's lesson", prompt: 'Send me the next lesson now' },
          { label: 'What next?', prompt: 'What should I work on next?' },
          { label: 'Quiz me', prompt: 'Quiz me on this roadmap' },
          { label: 'Explain a topic', prompt: 'Explain a topic from this roadmap' },
        ]
      : [
          { label: "Today's lesson", prompt: 'Send me the next lesson now' },
          { label: 'Create a roadmap', prompt: 'Create a learning roadmap for me' },
          { label: 'Quiz me', prompt: 'Quiz me on something I am learning' },
          { label: 'Explain a topic', prompt: 'Explain a topic to me' },
        ];

  const emptyStateHint = onRoadmapDetail
    ? topic
      ? `Asking about "${topic.title}".`
      : 'Select a topic to get help with it, or just ask.'
    : screen === 'quiz'
      ? 'Stuck on a question? Ask me the idea behind it.'
      : screen === 'digests'
        ? 'Ask me to go deeper on anything from your digests.'
        : '';

  // Approving leaves the user in the chat and switches the card to its saved
  // state; they navigate via "view it" when they want to. Pushing straight to
  // the roadmap used to yank them out of the conversation mid-turn.
  const handleApprove = async () => {
    setApproving(true);
    setApprovalError('');
    try {
      await resolveProposal('approved');
    } catch (e: any) {
      setApprovalError(e?.response?.data?.detail ?? 'Failed to approve.');
    } finally {
      setApproving(false);
    }
  };

  const handleView = (roadmapId?: string) =>
    router.push(roadmapId ? `/learning/${roadmapId}` : '/learning');

  const handleReject = async () => {
    setApproving(true);
    try {
      await resolveProposal('rejected');
    } finally {
      setApproving(false);
    }
  };

  // Answering (or skipping) onboarding resumes the paused turn, so the reply to
  // whatever the learner originally asked arrives from this call.
  const handleOnboard = async (answers: Record<string, string> | null) => {
    setApproving(true);
    setApprovalError('');
    try {
      await resolveOnboarding(answers);
    } catch (e: any) {
      setApprovalError(e?.response?.data?.detail ?? 'Failed to save your preferences.');
    } finally {
      setApproving(false);
    }
  };

  /* ─── collapsed ─── */

  if (!openBot) {
    return (
      <TouchableOpacity
        onPress={() => openChat()}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Open the tutor"
        className="bg-primary absolute h-14 w-14 items-center justify-center rounded-full"
        // Cleared off the home indicator rather than a fixed offset: a phone
        // with a gesture bar and one with a bezel need different gaps, and a
        // hard-coded bottom put the button on top of the last card on one of them.
        style={{ right: GUTTER, bottom: insets.bottom + GUTTER }}>
        <SparklesIcon size={24} color={colors.onPrimary} />
      </TouchableOpacity>
    );
  }

  /* ─── expanded ─── */

  const panel = docked
    ? // Docked: a column beside the page, full height, no scrim — the page stays
      // readable and usable next to it.
      'border-line bg-surface absolute top-0 right-0 bottom-0 border-l'
    : // Overlay: anchored to the bottom so the input sits under the thumb, with
      // the page peeking above it to keep the context visible.
      'border-line bg-surface absolute right-0 bottom-0 left-0 top-16 rounded-t-3xl border-t border-x overflow-hidden';

  return (
    <>
      {/* The scrim is narrow-only: docked, the page beside the panel is still
          live, and dimming it would say otherwise. */}
      {!docked && (
        <Pressable
          onPress={() => closeChat()}
          accessibilityLabel="Close the tutor"
          className="absolute inset-0"
          // Not `bg-black/40`: the slash-opacity form compiles to a colour-mix
          // that react-native-css resolves to a NaN channel on native, and the
          // broken rule is the one that wins. A literal rgba is unambiguous.
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        />
      )}

      <View className={panel} style={docked ? { width: DOCK_WIDTH } : undefined}>
        <View className="border-line flex-row items-center justify-between gap-2 border-b px-4 py-3">
          <View className="flex-1">
            <Text className="text-ink text-[17px] font-extrabold">Tutor</Text>
            {!!roadmapId && (
              <Text className="text-ink-faint text-[13px]" numberOfLines={1}>
                {topic ? topic.title : (roadmapTitle ?? 'Roadmap context active')}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={resetChat} activeOpacity={0.7} accessibilityRole="button">
            <Text className="text-ink-soft text-[13px] font-bold">New chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => closeChat()}
            className="bg-surface-alt h-8 w-8 items-center justify-center rounded-full"
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close the tutor">
            <XIcon size={16} color={colors.inkSoft} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}>
          <ScrollView
            ref={scrollRef}
            className="flex-1 px-4 pt-4"
            contentContainerStyle={{ paddingBottom: 8 }}>
            {chatMessages.length === 0 &&
              // The tutor opens the conversation rather than waiting to be
              // addressed. "Hi — ask me anything" put the whole burden of
              // knowing what to ask on the person who came here because they
              // didn't; the briefing already knows what is waiting for them, so
              // it says that and offers to act on it.
              (briefing ? (
                <View className="py-2">
                  <View className="mb-3 flex-row items-start gap-2.5">
                    <View className="bg-primary-soft h-8 w-8 items-center justify-center rounded-full">
                      <SparklesIcon size={16} color={colors.primary} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-ink text-[15px] leading-relaxed font-semibold">
                        {briefing.headline}
                      </Text>
                      {!!briefing.detail && (
                        <Text className="text-ink-soft mt-1 text-[15px] leading-relaxed">
                          {briefing.detail}
                        </Text>
                      )}
                      <BriefingActions
                        actions={briefing.actions}
                        onAction={runBriefingAction}
                        busy={chatLoading}
                      />
                    </View>
                  </View>

                  {/* Still offered, below the recommendation: the briefing says
                      what matters, these say what else is possible. */}
                  <Text className="text-ink-faint mt-2 mb-2 text-[13px]">Or ask about:</Text>
                  <Suggestions items={suggestions} onPick={handleAsk} disabled={chatLoading} />
                  {!!emptyStateHint && (
                    <Text className="text-ink-faint mt-3 text-[13px] leading-relaxed">
                      {emptyStateHint}
                    </Text>
                  )}
                </View>
              ) : (
                <View className="items-center py-10">
                  <View className="bg-primary-soft mb-4 h-16 w-16 items-center justify-center rounded-full">
                    <SparklesIcon size={26} color={colors.primary} />
                  </View>
                  <Text className="text-ink mb-4 text-center text-[15px]">
                    Hi — ask me anything, or try:
                  </Text>
                  <Suggestions items={suggestions} onPick={handleAsk} disabled={chatLoading} />
                  {!!emptyStateHint && (
                    <Text className="text-ink-faint mt-4 text-center text-[13px] leading-relaxed">
                      {emptyStateHint}
                    </Text>
                  )}
                </View>
              ))}

            {chatMessages.map((msg) => (
              <Bubble
                key={msg.id}
                msg={msg}
                onApprove={handleApprove}
                onReject={handleReject}
                onStartQuiz={() => router.push('/learning/quiz')}
                onOnboard={handleOnboard}
                onView={handleView}
                approving={approving}
              />
            ))}

            {chatLoading && (
              <View className="mb-3 items-start">
                <View className="bg-surface-alt rounded-2xl rounded-tl-sm px-4 py-3">
                  <ActivityIndicator size="small" color={colors.inkFaint} />
                </View>
              </View>
            )}

            {!!approvalError && (
              <View className="border-danger bg-danger-soft mb-3 rounded-xl border p-3">
                <Text className="text-danger text-[13px]">{approvalError}</Text>
              </View>
            )}
          </ScrollView>

          {/* Topic shortcuts, only once a topic is selected on the roadmap screen */}
          {onRoadmapDetail && topic && (
            <TopicActions
              topic={topic}
              roadmapTitle={roadmapTitle}
              onAsk={handleAsk}
              disabled={chatLoading}
            />
          )}

          <View
            className="border-line border-t px-4 pt-3"
            style={{ paddingBottom: (docked ? 0 : insets.bottom) + 12 }}>
            <View className="flex-row items-end gap-2.5">
              <TextInput
                className="border-line bg-surface-alt text-ink flex-1 rounded-2xl border px-4 py-3 text-[15px]"
                style={{ maxHeight: 120 }}
                placeholder="Ask anything…"
                placeholderTextColor={colors.inkFaint}
                multiline
                value={input}
                onChangeText={setInput}
                // Enter sends, Shift+Enter inserts a newline. The field is
                // multiline, so Enter would otherwise only ever add a line break.
                //
                // Web and native are wired separately on purpose: onKeyPress is
                // the only one carrying the shift modifier, and letting both fire
                // would send the message twice on one keystroke.
                {...(Platform.OS === 'web'
                  ? {
                      submitBehavior: 'newline' as const,
                      onKeyPress: (e: any) => {
                        if (e.nativeEvent?.key === 'Enter' && !e.nativeEvent?.shiftKey) {
                          e.preventDefault?.();
                          handleSend();
                        }
                      },
                    }
                  : { submitBehavior: 'submit' as const, onSubmitEditing: handleSend })}
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={!input.trim() || chatLoading}
                className={`h-11 w-11 items-center justify-center rounded-full ${
                  !input.trim() || chatLoading ? 'bg-surface-alt' : 'bg-primary'
                }`}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Send">
                {chatLoading ? (
                  <ActivityIndicator size="small" color={colors.inkFaint} />
                ) : (
                  <ArrowUpIcon
                    size={20}
                    color={input.trim() ? colors.onPrimary : colors.inkFaint}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}
