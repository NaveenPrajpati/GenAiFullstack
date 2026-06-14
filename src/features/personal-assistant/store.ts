/**
 * Single Zustand store for the Personal Assistant feature.
 *
 * Auth note: the app exposes the token via the `useAuth()` React context, but a
 * Zustand store can't call hooks. So screens push the current token in via
 * `setAuthToken` (wired once in the feature `_layout`), and actions keep the
 * clean `sendMessage(text)` / `loadTasks(filters)` signatures from the spec.
 *
 * All network access is delegated to `personalAssistantApi` — no fetch here.
 */
import { create } from 'zustand';
import * as api from './personalAssistantApi';
import type {
  Agenda,
  ChatMessage,
  DeleteProposal,
  Note,
  PendingApproval,
  Priority,
  Task,
  TaskFilters,
  TaskPatch,
  TaskStats,
} from './types';

const genId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const errMsg = (e: any, fallback: string): string =>
  e?.response?.data?.detail ?? e?.message ?? fallback;

interface PAState {
  // ── auth ──
  token: string | null;
  setAuthToken: (token: string | null) => void;

  // ── chat ──
  threadId: string;
  messages: ChatMessage[];
  chatLoading: boolean;
  pendingApproval: (DeleteProposal & { threadId: string }) | null;
  sendMessage: (text: string) => Promise<void>;
  resolveApproval: (decision: 'approved' | 'rejected') => Promise<void>;
  newConversation: () => void;

  // ── tasks ──
  tasks: Task[];
  tasksLoading: boolean;
  tasksError: string;
  loadTasks: (filters?: TaskFilters) => Promise<void>;
  /** Fetch a single task (for deep-linked detail) and upsert it into `tasks`. */
  loadTask: (id: string) => Promise<Task | null>;
  updateTask: (id: string, patch: TaskPatch) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  subtasks: Record<string, Task[]>;
  subtasksLoading: boolean;
  loadSubtasks: (id: string) => Promise<void>;

  // ── stats ──
  stats: TaskStats | null;
  statsLoading: boolean;
  loadStats: () => Promise<void>;

  // ── agenda ──
  agenda: Agenda | null;
  agendaLoading: boolean;
  agendaError: string;
  loadAgenda: () => Promise<void>;

  // ── notes ──
  notes: Note[];
  notesLoading: boolean;
  notesError: string;
  loadNotes: () => Promise<void>;
  addNote: (content: string, category?: string) => Promise<void>;

  // ── settings / inbox ──
  digestEnabled: boolean;
  digestToggling: boolean;
  toggleDigest: () => Promise<void>;
  approvals: PendingApproval[];
  approvalsLoading: boolean;
  loadApprovals: () => Promise<void>;
}

export const usePersonalAssistantStore = create<PAState>((set, get) => ({
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
    if (!trimmed) return;

    set((s) => ({
      messages: [...s.messages, { id: genId(), role: 'user', text: trimmed }],
      chatLoading: true,
    }));

    try {
      const data = await api.query(token, trimmed, threadId);

      if (data.status === 'needs_approval') {
        set((s) => ({
          threadId: data.thread_id ?? s.threadId,
          pendingApproval: { ...data.proposal, threadId: data.thread_id ?? s.threadId },
          messages: [
            ...s.messages,
            {
              id: genId(),
              role: 'assistant',
              text: 'Please confirm — this will permanently delete the following task(s).',
              approval: data.proposal,
            },
          ],
        }));
        return;
      }

      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: genId(),
            role: 'assistant',
            text: data.result.response ?? '',
            result: data.result,
          },
        ],
      }));
    } catch (e: any) {
      const text = errMsg(e, 'Something went wrong. Please try again.');
      set((s) => ({
        messages: [...s.messages, { id: genId(), role: 'assistant', text, isError: true }],
      }));
    } finally {
      set({ chatLoading: false });
    }
  },

  resolveApproval: async (decision) => {
    const { token, pendingApproval } = get();
    if (!pendingApproval) return;

    set({ chatLoading: true });
    // Lock the inline card immediately.
    set((s) => ({
      messages: s.messages.map((m) =>
        m.approval && !m.resolved ? { ...m, resolved: decision } : m
      ),
    }));

    try {
      const result = await api.approve(token, pendingApproval.threadId, decision);
      set((s) => ({
        pendingApproval: null,
        messages: [
          ...s.messages,
          { id: genId(), role: 'assistant', text: result.response ?? '', result },
        ],
      }));
      // A delete may have happened — refresh task-derived views.
      if (decision === 'approved') {
        get().loadTasks();
        get().loadStats();
      }
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

  // ── tasks ──
  tasks: [],
  tasksLoading: false,
  tasksError: '',
  loadTasks: async (filters = {}) => {
    set({ tasksLoading: true, tasksError: '' });
    try {
      const tasks = await api.getTasks(get().token, filters);
      set({ tasks });
    } catch (e: any) {
      set({ tasksError: errMsg(e, 'Failed to load tasks.') });
    } finally {
      set({ tasksLoading: false });
    }
  },

  loadTask: async (id) => {
    set({ tasksLoading: true, tasksError: '' });
    try {
      const task = await api.getTask(get().token, id);
      set((s) => ({
        tasks: s.tasks.some((t) => t.id === id)
          ? s.tasks.map((t) => (t.id === id ? task : t))
          : [...s.tasks, task],
      }));
      return task;
    } catch (e: any) {
      set({ tasksError: errMsg(e, 'Failed to load task.') });
      return null;
    } finally {
      set({ tasksLoading: false });
    }
  },

  updateTask: async (id, patch) => {
    const prev = get().tasks;
    // Optimistic.
    set({
      tasks: prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
    try {
      const updated = await api.updateTask(get().token, id, patch);
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
    } catch (e: any) {
      set({ tasks: prev }); // rollback
      throw new Error(errMsg(e, 'Failed to update task.'));
    }
  },

  completeTask: async (id) => {
    const prev = get().tasks;
    set({
      tasks: prev.map((t) => (t.id === id ? { ...t, status: 'done' } : t)),
    });
    try {
      const updated = await api.updateTask(get().token, id, { status: 'done' });
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
    } catch (e: any) {
      set({ tasks: prev });
      throw new Error(errMsg(e, 'Failed to complete task.'));
    }
  },

  deleteTask: async (id) => {
    const prev = get().tasks;
    set({ tasks: prev.filter((t) => t.id !== id) }); // optimistic
    try {
      await api.deleteTask(get().token, id);
    } catch (e: any) {
      set({ tasks: prev }); // rollback
      throw new Error(errMsg(e, 'Failed to delete task.'));
    }
  },

  subtasks: {},
  subtasksLoading: false,
  loadSubtasks: async (id) => {
    set({ subtasksLoading: true });
    try {
      const children = await api.getSubtasks(get().token, id);
      set((s) => ({ subtasks: { ...s.subtasks, [id]: children } }));
    } catch {
      set((s) => ({ subtasks: { ...s.subtasks, [id]: [] } }));
    } finally {
      set({ subtasksLoading: false });
    }
  },

  // ── stats ──
  stats: null,
  statsLoading: false,
  loadStats: async () => {
    set({ statsLoading: true });
    try {
      const stats = await api.getStats(get().token);
      set({ stats });
    } catch {
      /* stats are non-critical — fail silently */
    } finally {
      set({ statsLoading: false });
    }
  },

  // ── agenda ──
  agenda: null,
  agendaLoading: false,
  agendaError: '',
  loadAgenda: async () => {
    set({ agendaLoading: true, agendaError: '' });
    try {
      const agenda = await api.getAgenda(get().token);
      set({ agenda });
    } catch (e: any) {
      set({ agendaError: errMsg(e, 'Failed to load agenda.') });
    } finally {
      set({ agendaLoading: false });
    }
  },

  // ── notes ──
  notes: [],
  notesLoading: false,
  notesError: '',
  loadNotes: async () => {
    set({ notesLoading: true, notesError: '' });
    try {
      const notes = await api.getNotes(get().token);
      set({ notes });
    } catch (e: any) {
      set({ notesError: errMsg(e, 'Failed to load notes.') });
    } finally {
      set({ notesLoading: false });
    }
  },
  addNote: async (content, category) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const note = await api.addNote(get().token, trimmed, category?.trim() || undefined);
    set((s) => ({ notes: [note, ...s.notes] }));
  },

  // ── settings / inbox ──
  digestEnabled: false,
  digestToggling: false,
  toggleDigest: async () => {
    set({ digestToggling: true });
    try {
      const enabled = await api.toggleTrigger(get().token);
      set({ digestEnabled: enabled });
    } finally {
      set({ digestToggling: false });
    }
  },
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

/** Re-exported helpers for screens. */
export const priorities: Priority[] = ['low', 'medium', 'high'];
