import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
}

export interface Session {
  id: string;
  title: string;
  connectionString: string;
  isConnected: boolean;
  messages: Message[];
  isLoading: boolean;
  createdAt: number;
  updatedAt: number;
}

interface ChatStore {
  // State
  sessions: Record<string, Session>;
  activeSessionId: string | null;

  // Session actions
  createSession: () => string;
  deleteSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string) => void;
  renameSession: (sessionId: string, title: string) => void;
  clearSession: (sessionId: string) => void;
  setSessionConnection: (sessionId: string, connectionString: string) => void;
  setSessionConnected: (sessionId: string, isConnected: boolean) => void;

  // Message actions
  addMessage: (
    sessionId: string,
    msg: Omit<Message, 'id' | 'createdAt'>,
  ) => Message;
  updateMessage: (
    sessionId: string,
    messageId: string,
    content: string,
  ) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;

  // Loading state
  setLoading: (sessionId: string, val: boolean) => void;

  // Derived helpers
  getActiveSession: () => Session | null;
  getSession: (sessionId: string) => Session | undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(overrides?: Partial<Session>): Session {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: 'New Chat',
    connectionString: '',
    isConnected: false,
    messages: [],
    isLoading: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeMessage(fields: Omit<Message, 'id' | 'createdAt'>): Message {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    ...fields,
  };
}

function titleFromConnectionString(connectionString: string) {
  try {
    const parsed = new URL(connectionString);
    const dbName = parsed.pathname.replace(/^\//, '').trim();
    return dbName || 'New Chat';
  } catch {
    const stripped = connectionString.trim().replace(/\?.*$/, '');
    const slashIndex = stripped.lastIndexOf('/');
    if (slashIndex >= 0 && slashIndex < stripped.length - 1) {
      return stripped.slice(slashIndex + 1);
    }
    return 'New Chat';
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      activeSessionId: null,

      // ── Session actions ──────────────────────────────────────────────────

      createSession: () => {
        const session = makeSession();
        set((s) => ({
          sessions: { ...s.sessions, [session.id]: session },
          activeSessionId: session.id,
        }));
        return session.id;
      },

      deleteSession: (sessionId) => {
        set((s) => {
          const { [sessionId]: deletedSession, ...rest } = s.sessions;
          void deletedSession;
          const ids = Object.keys(rest);
          const nextActiveId =
            s.activeSessionId === sessionId ?
              (ids[ids.length - 1] ?? null)
            : s.activeSessionId;
          return { sessions: rest, activeSessionId: nextActiveId };
        });
      },

      setActiveSession: (sessionId) => {
        set({ activeSessionId: sessionId });
      },

      renameSession: (sessionId, title) => {
        set((s) => ({
          sessions: {
            ...s.sessions,
            [sessionId]: {
              ...s.sessions[sessionId],
              title,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      clearSession: (sessionId) => {
        set((s) => ({
          sessions: {
            ...s.sessions,
            [sessionId]: {
              ...s.sessions[sessionId],
              messages: [],
              title: titleFromConnectionString(
                s.sessions[sessionId]?.connectionString ?? '',
              ),
              updatedAt: Date.now(),
            },
          },
        }));
      },

      setSessionConnection: (sessionId, connectionString) => {
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                connectionString,
                title: titleFromConnectionString(connectionString),
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      setSessionConnected: (sessionId, isConnected) => {
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                isConnected,
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      // ── Message actions ──────────────────────────────────────────────────

      addMessage: (sessionId, fields) => {
        const msg = makeMessage(fields);
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          const messages = [...session.messages, msg];
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                messages,
                updatedAt: Date.now(),
              },
            },
          };
        });
        return msg;
      },

      updateMessage: (sessionId, messageId, content) => {
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                messages: session.messages.map((m) =>
                  m.id === messageId ? { ...m, content } : m,
                ),
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      deleteMessage: (sessionId, messageId) => {
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                messages: session.messages.filter((m) => m.id !== messageId),
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      // ── Loading ──────────────────────────────────────────────────────────

      setLoading: (sessionId, val) => {
        set((s) => ({
          sessions: {
            ...s.sessions,
            [sessionId]: {
              ...s.sessions[sessionId],
              isLoading: val,
            },
          },
        }));
      },

      // ── Derived helpers ──────────────────────────────────────────────────

      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return activeSessionId ? (sessions[activeSessionId] ?? null) : null;
      },

      getSession: (sessionId) => {
        return get().sessions[sessionId];
      },
    }),

    {
      name: 'chat-store', // localStorage key
      // Only persist sessions + activeSessionId, strip transient loading flags
      partialize: (s) => ({
        activeSessionId: s.activeSessionId,
        sessions: Object.fromEntries(
          Object.entries(s.sessions).map(([id, session]) => [
            id,
            { ...session, isLoading: false },
          ]),
        ),
      }),
    },
  ),
);
