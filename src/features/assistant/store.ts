/**
 * Single Zustand store for the unified Assistant (supervisor) feature.
 *
 * Auth note: matches the other features — screens push the token in via
 * `setAuthToken` (wired once in the feature `_layout`), so actions keep clean
 * signatures. All network access is delegated to `assistantApi`.
 *
 * The streaming turn differs from the per-agent stores: the supervisor emits
 * real `token` events, so instead of a transient progress bubble that is
 * replaced at the end, one assistant message is created up front and filled in
 * as the turn runs — first with skill/step progress, then with the reply text
 * typing itself out.
 */
import { create } from 'zustand';
import * as api from './assistantApi';
import type {
  ChatMessage,
  PendingApproval,
  Proposal,
  Skill,
  SkillsResponse,
  SupervisorResult,
} from './types';

const genId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const errMsg = (e: any, fallback: string): string =>
  e?.response?.data?.detail ?? e?.message ?? fallback;

/** Graph node → human label shown live while the turn runs. */
const STEP_LABELS: Record<string, string> = {
  load_context: 'Loading your context…',
  route: 'Working out what you need…',
  learning_agent: 'Learning coach is working…',
  assistant_agent: 'Personal assistant is working…',
  meal_agent: 'Meal planner is working…',
  finalize: 'Writing your reply…',
};

/** Nodes that correspond to a skill, for the trail shown above the reply. */
const NODE_SKILL: Record<string, Skill> = {
  learning_agent: 'learning',
  assistant_agent: 'assistant',
  meal_agent: 'meal',
};

/** What to say while an approval card is on screen. */
function approvalPrompt(proposal: Proposal): string {
  switch (proposal.type) {
    case 'pa_delete_task':
      return 'Please confirm — this will permanently delete the following task(s).';
    case 'supervisor_save_meal_plan':
      return "Here's the plan I put together. Approve it and I'll save it to your week.";
    default:
      return "Here's the roadmap I drafted. Approve it and I'll save it and add the steps to your tasks.";
  }
}

interface AssistantState {
  // ── auth ──
  token: string | null;
  setAuthToken: (token: string | null) => void;

  // ── chat ──
  threadId: string;
  messages: ChatMessage[];
  chatLoading: boolean;
  pendingApproval: (Proposal & { threadId: string }) | null;
  sendMessage: (text: string) => Promise<void>;
  resolveApproval: (decision: 'approved' | 'rejected') => Promise<void>;
  newConversation: () => void;

  // ── capabilities ──
  skills: SkillsResponse | null;
  skillsLoading: boolean;
  loadSkills: () => Promise<void>;

  // ── inbox ──
  approvals: PendingApproval[];
  approvalsLoading: boolean;
  loadApprovals: () => Promise<void>;
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  // ── auth ──
  token: null,
  setAuthToken: (token) => set({ token }),

  // ── chat ──
  threadId: genId(),
  messages: [],
  chatLoading: false,
  pendingApproval: null,

  sendMessage: async (text) => {
    const { token, threadId } = get();
    const trimmed = text.trim();
    if (!trimmed || get().chatLoading) return;

    // One assistant message per turn, mutated in place as events arrive.
    const replyId = genId();
    set((s) => ({
      chatLoading: true,
      messages: [
        ...s.messages,
        { id: genId(), role: 'user', text: trimmed },
        {
          id: replyId,
          role: 'assistant',
          text: '',
          streaming: true,
          skills: [],
          step: 'Working…',
        },
      ],
    }));

    const patchReply = (patch: Partial<ChatMessage>) =>
      set((s) => ({
        messages: s.messages.map((m) => (m.id === replyId ? { ...m, ...patch } : m)),
      }));

    // Tokens are accumulated locally as well as in state: reading the previous
    // text back out of the store on every token would re-render the whole list.
    let streamed = '';

    try {
      for await (const event of api.queryStream(token, {
        text: trimmed,
        thread_id: threadId,
      })) {
        if (event.type === 'thread') {
          if (event.thread_id) set({ threadId: event.thread_id });
          continue;
        }

        if (event.type === 'step') {
          const skill = event.node ? NODE_SKILL[event.node] : undefined;
          set((s) => ({
            messages: s.messages.map((m) => {
              if (m.id !== replyId) return m;
              const skills =
                skill && !m.skills?.includes(skill) ? [...(m.skills ?? []), skill] : m.skills;
              return {
                ...m,
                skills,
                step: (event.node && STEP_LABELS[event.node]) || 'Working…',
              };
            }),
          }));
          continue;
        }

        if (event.type === 'token') {
          streamed += event.token ?? '';
          // Once text starts arriving the step label is redundant.
          patchReply({ text: streamed, step: undefined });
          continue;
        }

        if (event.type === 'needs_approval' && event.proposal) {
          const tid = event.thread_id ?? get().threadId;
          set((s) => ({
            threadId: tid,
            pendingApproval: { ...event.proposal!, threadId: tid },
            messages: s.messages.map((m) =>
              m.id === replyId
                ? {
                    ...m,
                    text: streamed || approvalPrompt(event.proposal!),
                    approval: event.proposal,
                    streaming: false,
                    step: undefined,
                  }
                : m
            ),
          }));
          return;
        }

        if (event.type === 'done') {
          const result = event.result;
          patchReply({
            // Prefer what actually streamed; fall back for a non-streaming reply.
            text: streamed || result?.response || '',
            result,
            // `completed` is authoritative — a skill can be routed but skipped.
            skills: result?.completed ?? result?.route ?? [],
            streaming: false,
            step: undefined,
          });
          return;
        }

        if (event.type === 'error') {
          throw new Error(event.message ?? 'Stream error');
        }
      }
      // Stream ended without a terminal event — keep whatever text arrived.
      patchReply({ text: streamed, streaming: false, step: undefined });
    } catch (e: any) {
      patchReply({
        text: streamed || errMsg(e, 'Something went wrong. Please try again.'),
        isError: !streamed,
        streaming: false,
        step: undefined,
      });
    } finally {
      set({ chatLoading: false });
    }
  },

  resolveApproval: async (decision) => {
    const { token, pendingApproval } = get();
    if (!pendingApproval) return;

    set({ chatLoading: true });
    // Lock the inline card immediately so it can't be double-submitted.
    set((s) => ({
      messages: s.messages.map((m) =>
        m.approval && !m.resolved ? { ...m, resolved: decision } : m
      ),
    }));

    try {
      const response = await api.approve(token, pendingApproval.threadId, decision);

      if (response.status === 'needs_approval') {
        // A multi-skill turn can pause more than once (approve a roadmap, then
        // the meal plan that follows it).
        set((s) => ({
          pendingApproval: { ...response.proposal, threadId: response.thread_id },
          threadId: response.thread_id,
          messages: [
            ...s.messages,
            {
              id: genId(),
              role: 'assistant',
              text: approvalPrompt(response.proposal),
              approval: response.proposal,
            },
          ],
        }));
        return;
      }

      const result: SupervisorResult = response.result ?? {};
      set((s) => ({
        pendingApproval: null,
        messages: [
          ...s.messages,
          {
            id: genId(),
            role: 'assistant',
            text: result.response ?? '',
            result,
            skills: result.completed ?? [],
          },
        ],
      }));
    } catch (e: any) {
      // Roll the card back to unresolved so the user can retry.
      set((s) => ({
        messages: s.messages
          .map((m) => (m.resolved ? { ...m, resolved: undefined } : m))
          .concat({
            id: genId(),
            role: 'assistant',
            text: errMsg(e, 'Could not resolve this approval — it may have expired.'),
            isError: true,
          }),
      }));
    } finally {
      set({ chatLoading: false });
    }
  },

  newConversation: () =>
    set({ messages: [], threadId: genId(), pendingApproval: null, chatLoading: false }),

  // ── capabilities ──
  skills: null,
  skillsLoading: false,
  loadSkills: async () => {
    set({ skillsLoading: true });
    try {
      set({ skills: await api.getSkills(get().token) });
    } catch {
      set({ skills: null }); // non-critical — the header just omits the badge
    } finally {
      set({ skillsLoading: false });
    }
  },

  // ── inbox ──
  approvals: [],
  approvalsLoading: false,
  loadApprovals: async () => {
    set({ approvalsLoading: true });
    try {
      set({ approvals: await api.getApprovals(get().token) });
    } catch {
      set({ approvals: [] });
    } finally {
      set({ approvalsLoading: false });
    }
  },
}));
