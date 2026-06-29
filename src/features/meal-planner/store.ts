/**
 * Single Zustand store for the Meal Planner feature.
 *
 * Auth note: the app exposes the token via the `useAuth()` React context, but a
 * Zustand store can't call hooks. So the feature `_layout` pushes the current
 * token in via `setAuthToken`, and actions keep clean, token-free signatures.
 *
 * All network access is delegated to `mealPlannerApi` — no axios/fetch here.
 */
import { create } from 'zustand';
import * as api from './mealPlannerApi';
import { friendlyResultText } from './copy';
import type {
  ApprovalDecision,
  ChatMessage,
  ConflictDecision,
  GroceryItem,
  MealSlot,
  MealType,
  PendingApproval,
  Plan,
  PlannerResult,
} from './types';

const genId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const errMsg = (e: any, fallback: string): string =>
  e?.response?.data?.detail ?? e?.message ?? fallback;

/** Human-friendly label for a graph node, shown live as the turn streams. */
const MP_STEP_LABELS: Record<string, string> = {
  load_memory: 'Loading your preferences…',
  classify_intent: 'Understanding your request…',
  log_agent: 'Logging your meal…',
  query_agent: 'Checking your plan…',
  research_agent: 'Researching…',
  plan_agent: 'Building your plan…',
};
const stepLabel = (node?: string): string =>
  (node && MP_STEP_LABELS[node]) || 'Working…';

interface MealPlannerState {
  // ── auth ──
  token: string | null;
  setAuthToken: (token: string | null) => void;

  // ── chat ──
  threadId: string;
  activePlanId: string | null;
  messages: ChatMessage[];
  chatLoading: boolean;
  pendingApproval: (import('./types').PlanProposal & { threadId: string }) | null;
  /** Active conflict awaiting resolution; carries the plan it belongs to. */
  pendingConflict: (import('./types').DietConflict & { planId: string; messageId: string }) | null;
  sendMessage: (text: string) => Promise<void>;
  resolveApproval: (decision: ApprovalDecision) => Promise<void>;
  resolveConflict: (decision: ConflictDecision) => Promise<void>;
  newConversation: () => void;
  selectPlan: (id: string) => void;
  /** Internal: render a `done` result as a chat turn and cache returned slots. */
  applyResult: (result: PlannerResult, msgId?: string) => void;

  // ── plans ──
  plans: Plan[];
  plansLoading: boolean;
  plansError: string;
  loadPlans: () => Promise<void>;

  // ── slots ──
  slotsByPlanId: Record<string, MealSlot[]>;
  slotsLoading: boolean;
  slotsError: string;
  loadSlots: (planId: string) => Promise<void>;

  // ── grocery ──
  groceryByPlanId: Record<string, GroceryItem[]>;
  checkedByPlanId: Record<string, Set<string>>;
  groceryLoading: boolean;
  groceryError: string;
  loadGrocery: (planId: string) => Promise<void>;
  toggleGroceryItem: (name: string) => void;

  // ── preferences ──
  dislikedDishes: string[];
  dislikedLoading: boolean;
  dislikedError: string;
  loadDisliked: () => Promise<void>;
  addDisliked: (dish: string) => Promise<void>;
  removeDisliked: (dish: string) => Promise<void>;

  autoPlanEnabled: boolean;
  autoPlanToggling: boolean;
  toggleAutoPlan: () => Promise<void>;

  // ── approvals inbox ──
  approvals: PendingApproval[];
  approvalsLoading: boolean;
  loadApprovals: () => Promise<void>;
}

export const useMealPlannerStore = create<MealPlannerState>((set, get) => ({
  // ── auth ──
  token: null,
  setAuthToken: (token) => set({ token }),

  // ── chat ──
  threadId: genId(),
  activePlanId: null,
  messages: [],
  chatLoading: false,
  pendingApproval: null,
  pendingConflict: null,

  selectPlan: (id) => set({ activePlanId: id }),

  sendMessage: async (text) => {
    const { token, threadId, activePlanId } = get();
    const trimmed = text.trim();
    if (!trimmed) return;

    set((s) => ({
      messages: [...s.messages, { id: genId(), role: 'user', text: trimmed }],
      chatLoading: true,
    }));

    // Transient bubble showing live per-node progress; removed before the
    // existing terminal handling appends the real reply.
    let progressId: string | null = null;
    const showProgress = (label: string) =>
      set((s) => {
        if (progressId) {
          return {
            messages: s.messages.map((m) => (m.id === progressId ? { ...m, text: label } : m)),
          };
        }
        progressId = genId();
        return {
          chatLoading: false,
          messages: [
            ...s.messages,
            { id: progressId, role: 'assistant', text: label, streaming: true },
          ],
        };
      });
    const clearProgress = () => {
      if (!progressId) return;
      const id = progressId;
      progressId = null;
      set((s) => ({ messages: s.messages.filter((m) => m.id !== id) }));
    };

    try {
      // Always forward the active plan id when we have one — update/regenerate
      // requests require it, and it's harmless for plan/log/query/research.
      for await (const event of api.queryStream(token, {
        text: trimmed,
        plan_id: activePlanId,
        thread_id: threadId,
      })) {
        if (event.type === 'thread') {
          if (event.thread_id) set({ threadId: event.thread_id });
          continue;
        }
        if (event.type === 'step') {
          showProgress(stepLabel(event.node));
          continue;
        }
        if (event.type === 'error') {
          throw new Error(event.message ?? 'Stream error');
        }
        if (event.type === 'needs_approval' && event.proposal) {
          clearProgress();
          const proposal = event.proposal;
          set((s) => ({
            threadId: event.thread_id ?? s.threadId,
            pendingApproval: { ...proposal, threadId: event.thread_id ?? s.threadId },
            messages: [
              ...s.messages,
              {
                id: genId(),
                role: 'assistant',
                text:
                  proposal.type === 'update_plan'
                    ? 'Here’s the updated plan for your review.'
                    : 'Here’s a proposed plan for the week. Approve to save it.',
                proposal,
              },
            ],
          }));
          return;
        }
        if (event.type === 'done' && event.result) {
          clearProgress();
          const result = event.result;
          const msgId = genId();

          // A diet conflict needs its own inline accept/reject card.
          if (result.log_status === 'conflict' && result.conflict) {
            const planId = result.plan_id ?? activePlanId;
            set((s) => ({
              activePlanId: planId ?? s.activePlanId,
              pendingConflict: planId
                ? { ...result.conflict!, planId, messageId: msgId }
                : s.pendingConflict,
              messages: [
                ...s.messages,
                {
                  id: msgId,
                  role: 'assistant',
                  text: friendlyResultText(result),
                  result,
                  conflict: result.conflict,
                },
              ],
            }));
            return;
          }

          get().applyResult(result, msgId);
          return;
        }
      }
    } catch (e: any) {
      clearProgress();
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: genId(),
            role: 'assistant',
            text: errMsg(e, 'Something went wrong. Please try again.'),
            isError: true,
          },
        ],
      }));
    } finally {
      set({ chatLoading: false });
    }
  },

  // Internal: render a done result and cache any returned slots.
  applyResult: (result: PlannerResult, msgId?: string) => {
    set((s) => {
      const next: Partial<MealPlannerState> = {
        messages: [
          ...s.messages,
          {
            id: msgId ?? genId(),
            role: 'assistant',
            text: friendlyResultText(result),
            result,
          },
        ],
      };
      if (result.plan_id) next.activePlanId = result.plan_id;
      if (result.plan_id && result.meal_slots?.length) {
        next.slotsByPlanId = { ...s.slotsByPlanId, [result.plan_id]: result.meal_slots };
      }
      return next;
    });
    // A successful log changes the plan — refresh its slots.
    if (result.log_status === 'logged' && (result.plan_id ?? get().activePlanId)) {
      get().loadSlots((result.plan_id ?? get().activePlanId)!);
    }
  },

  resolveApproval: async (decision) => {
    const { token, pendingApproval } = get();
    if (!pendingApproval) return;

    set({ chatLoading: true });
    // Lock the inline proposal card immediately.
    set((s) => ({
      messages: s.messages.map((m) =>
        m.proposal && !m.resolved ? { ...m, resolved: decision } : m
      ),
    }));

    try {
      const result = await api.approve(token, pendingApproval.threadId, decision);
      set((s) => ({
        pendingApproval: null,
        messages: [
          ...s.messages,
          { id: genId(), role: 'assistant', text: friendlyResultText(result), result },
        ],
        ...(result.plan_id ? { activePlanId: result.plan_id } : {}),
      }));
      if (decision === 'approved') {
        const planId = result.plan_id ?? get().activePlanId;
        if (planId) get().loadSlots(planId);
        get().loadPlans();
      }
    } catch (e: any) {
      // Roll the card back to unresolved so the user can retry.
      set((s) => ({
        pendingApproval: s.pendingApproval,
        messages: s.messages
          .map((m) => (m.proposal && m.resolved ? { ...m, resolved: undefined } : m))
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

  resolveConflict: async (decision) => {
    const { token, pendingConflict } = get();
    if (!pendingConflict) return;
    const recipe = pendingConflict.suggestion ?? pendingConflict.original;

    set({ chatLoading: true });
    // Lock the conflict card.
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === pendingConflict.messageId ? { ...m, resolved: decision } : m
      ),
    }));

    try {
      const res = await api.resolveConflict(token, {
        plan_id: pendingConflict.planId,
        recipe,
        day_of_week: pendingConflict.day_of_week,
        meal_type: pendingConflict.meal_type as MealType,
        decision,
      });
      set((s) => ({
        pendingConflict: null,
        messages: [
          ...s.messages,
          {
            id: genId(),
            role: 'assistant',
            text:
              res.log_status === 'logged'
                ? `Logged “${recipe}” instead.`
                : `Okay — won’t suggest “${recipe}” again.`,
          },
        ],
      }));
      if (decision === 'accept') get().loadSlots(pendingConflict.planId);
      else get().loadDisliked();
    } catch (e: any) {
      set((s) => ({
        messages: s.messages
          .map((m) => (m.id === pendingConflict.messageId ? { ...m, resolved: undefined } : m))
          .concat({
            id: genId(),
            role: 'assistant',
            text: errMsg(e, 'Could not resolve the conflict — please try again.'),
            isError: true,
          }),
      }));
    } finally {
      set({ chatLoading: false });
    }
  },

  newConversation: () =>
    set({
      messages: [],
      threadId: genId(),
      pendingApproval: null,
      pendingConflict: null,
      chatLoading: false,
    }),

  // ── plans ──
  plans: [],
  plansLoading: false,
  plansError: '',
  loadPlans: async () => {
    set({ plansLoading: true, plansError: '' });
    try {
      const plans = await api.getPlans(get().token);
      set((s) => ({
        plans,
        // Default the active plan to the most recent one if none selected.
        activePlanId: s.activePlanId ?? plans[0]?.id ?? null,
      }));
    } catch (e: any) {
      set({ plansError: errMsg(e, 'Failed to load plans.') });
    } finally {
      set({ plansLoading: false });
    }
  },

  // ── slots ──
  slotsByPlanId: {},
  slotsLoading: false,
  slotsError: '',
  loadSlots: async (planId) => {
    set({ slotsLoading: true, slotsError: '' });
    try {
      const slots = await api.getSlots(get().token, planId);
      set((s) => ({ slotsByPlanId: { ...s.slotsByPlanId, [planId]: slots } }));
    } catch (e: any) {
      set({ slotsError: errMsg(e, 'Failed to load meals.') });
    } finally {
      set({ slotsLoading: false });
    }
  },

  // ── grocery ──
  groceryByPlanId: {},
  checkedByPlanId: {},
  groceryLoading: false,
  groceryError: '',
  loadGrocery: async (planId) => {
    set({ groceryLoading: true, groceryError: '' });
    try {
      const items = await api.getGrocery(get().token, planId);
      set((s) => ({
        groceryByPlanId: { ...s.groceryByPlanId, [planId]: items },
        // Seed checked-state from the server's `checked` flag the first time.
        checkedByPlanId: {
          ...s.checkedByPlanId,
          [planId]:
            s.checkedByPlanId[planId] ?? new Set(items.filter((i) => i.checked).map((i) => i.name)),
        },
      }));
    } catch (e: any) {
      set({ groceryError: errMsg(e, 'Failed to load grocery list.') });
    } finally {
      set({ groceryLoading: false });
    }
  },
  toggleGroceryItem: (name) => {
    const planId = get().activePlanId;
    if (!planId) return;
    set((s) => {
      const current = new Set(s.checkedByPlanId[planId] ?? []);
      if (current.has(name)) current.delete(name);
      else current.add(name);
      return { checkedByPlanId: { ...s.checkedByPlanId, [planId]: current } };
    });
  },

  // ── preferences ──
  dislikedDishes: [],
  dislikedLoading: false,
  dislikedError: '',
  loadDisliked: async () => {
    set({ dislikedLoading: true, dislikedError: '' });
    try {
      const dislikedDishes = await api.getDisliked(get().token);
      set({ dislikedDishes });
    } catch (e: any) {
      set({ dislikedError: errMsg(e, 'Failed to load disliked dishes.') });
    } finally {
      set({ dislikedLoading: false });
    }
  },
  addDisliked: async (dish) => {
    const trimmed = dish.trim();
    if (!trimmed) return;
    const prev = get().dislikedDishes;
    if (prev.includes(trimmed)) return;
    set({ dislikedDishes: [...prev, trimmed] }); // optimistic
    try {
      const list = await api.addDisliked(get().token, trimmed);
      set({ dislikedDishes: list });
    } catch (e: any) {
      set({ dislikedDishes: prev }); // rollback
      throw new Error(errMsg(e, 'Failed to add disliked dish.'));
    }
  },
  removeDisliked: async (dish) => {
    const prev = get().dislikedDishes;
    set({ dislikedDishes: prev.filter((d) => d !== dish) }); // optimistic
    try {
      const list = await api.removeDisliked(get().token, dish);
      set({ dislikedDishes: list });
    } catch (e: any) {
      set({ dislikedDishes: prev }); // rollback
      throw new Error(errMsg(e, 'Failed to remove disliked dish.'));
    }
  },

  autoPlanEnabled: false,
  autoPlanToggling: false,
  toggleAutoPlan: async () => {
    // The endpoint only returns `{ status:"done" }`, not the new state, so we
    // flip optimistically and roll back on error.
    const prev = get().autoPlanEnabled;
    set({ autoPlanToggling: true, autoPlanEnabled: !prev });
    try {
      await api.toggleTrigger(get().token);
    } catch {
      set({ autoPlanEnabled: prev });
    } finally {
      set({ autoPlanToggling: false });
    }
  },

  // ── approvals inbox ──
  approvals: [],
  approvalsLoading: false,
  loadApprovals: async () => {
    set({ approvalsLoading: true });
    try {
      const approvals = await api.getApprovals(get().token);
      set({ approvals });
    } catch {
      set({ approvals: [] });
    } finally {
      set({ approvalsLoading: false });
    }
  },
}));
