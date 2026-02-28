/**
 * chatStore.ts — Central Zustand store for all chat session state.
 *
 * This file manages:
 *  - Multiple chat sessions, each with its own DB connection + message history
 *  - Persistence to localStorage via Zustand's `persist` middleware
 *  - Active session tracking (which tab the user is viewing)
 *
 * HOW TO EDIT:
 *  - To add a new per-session field, update the `Session` interface AND add a
 *    default value in `newSession()`.
 *  - To add a new store action, add it to the `ChatStore` interface, then
 *    implement it inside the `create(...)` callback. Use the `patch()` helper
 *    for any action that updates a single session's fields.
 *  - If you add transient (non-persisted) fields, reset them in `partialize`
 *    at the bottom of this file so they don't leak into localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Who sent the message. 'system' messages aren't shown in chat but may be used internally. */
export type Role = 'user' | 'assistant' | 'system';

/** A single chat message stored in a session. */
export interface Message {
  id: string;       // UUID — unique identifier for this message
  role: Role;       // Who authored it
  content: string;  // The text body (supports markdown-ish formatting)
  createdAt: number; // Unix-ms timestamp
}

/**
 * A chat session (tab). Each session has its own:
 *  - Database connection (connectionString + isConnected flag)
 *  - Message history
 *  - Loading flag (true while the LLM is streaming a response)
 */
export interface Session {
  id: string;
  title: string;             // Display name in the sidebar (defaults to DB name from URL)
  connectionString: string;  // PostgreSQL connection URL (e.g. postgresql://user:pass@host/db)
  isConnected: boolean;      // Whether the user considers this tab "connected"
  messages: Message[];       // Full ordered chat history
  isLoading: boolean;        // True while waiting for an LLM response
  createdAt: number;         // Unix-ms — when session was created
  updatedAt: number;         // Unix-ms — last modification time (used for sidebar sort order)
}

/**
 * The full store shape. Every public action & getter lives here.
 * Zustand exposes this via the `useChatStore` hook.
 */
interface ChatStore {
  /** Map of sessionId → Session. This is the source of truth. */
  sessions: Record<string, Session>;
  /** Which session is currently visible in the playground. null = none. */
  activeSessionId: string | null;

  // — Session lifecycle —
  createSession: () => string;                                  // Returns new session ID
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;                       // Switch visible tab
  renameSession: (id: string, title: string) => void;           // Manual rename (double-click in sidebar)
  clearSession: (id: string) => void;                           // Wipe messages, reset title to DB name
  setSessionConnection: (id: string, url: string) => void;      // Save connection URL + derive title
  setSessionConnected: (id: string, connected: boolean) => void; // Toggle connected flag

  // — Message CRUD —
  addMessage: (id: string, msg: Omit<Message, 'id' | 'createdAt'>) => Message; // Returns the created Message
  updateMessage: (sessionId: string, msgId: string, content: string) => void;   // Used during streaming
  deleteMessage: (sessionId: string, msgId: string) => void;
  setLoading: (id: string, loading: boolean) => void;

  // — Read-only helpers (use `get()` internally) —
  getActiveSession: () => Session | null;
  getSession: (id: string) => Session | undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a new v4 UUID. */
const uid = () => crypto.randomUUID();

/** Current time in Unix milliseconds. */
const ts = () => Date.now();

/** Create a fresh Session with sensible defaults. */
function newSession(): Session {
  const t = ts();
  return {
    id: uid(),
    title: 'New Chat',
    connectionString: '',
    isConnected: false,
    messages: [],
    isLoading: false,
    createdAt: t,
    updatedAt: t,
  };
}

/** Wrap raw role+content into a full Message with auto-generated id & timestamp. */
function newMessage(fields: Omit<Message, 'id' | 'createdAt'>): Message {
  return { id: uid(), createdAt: ts(), ...fields };
}

/**
 * Extract the database name from a PostgreSQL connection URL to use as the tab title.
 * Falls back to 'New Chat' if the URL is malformed or has no path segment.
 *
 * Examples:
 *   "postgresql://user:pass@host:5432/mydb" → "mydb"
 *   "postgresql://user:pass@host:5432/"     → "New Chat"
 */
function dbNameFromUrl(url: string): string {
  try {
    // Standard URL parsing — works for well-formed postgres:// URLs
    return new URL(url).pathname.replace(/^\//, '').trim() || 'New Chat';
  } catch {
    // Fallback: strip query params and grab everything after the last slash
    const base = url.trim().replace(/\?.*$/, '');
    const i = base.lastIndexOf('/');
    return i >= 0 && i < base.length - 1 ? base.slice(i + 1) : 'New Chat';
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => {
      /**
       * Immutably update one session's fields. Automatically bumps `updatedAt`.
       * Returns the original state unchanged if the session ID doesn't exist,
       * so callers don't have to null-check.
       *
       * Usage inside actions:
       *   set((s) => patch(s, id, { title: 'New Title' }))
       */
      const patch = (
        state: { sessions: Record<string, Session> },
        id: string,
        fields: Partial<Session>,
      ) => {
        const session = state.sessions[id];
        if (!session) return state;
        return {
          sessions: {
            ...state.sessions,
            [id]: { ...session, ...fields, updatedAt: ts() },
          },
        };
      };

      return {
        sessions: {},
        activeSessionId: null,

        // ── Session actions ────────────────────────────────────────────────

        /** Create a new empty session and make it the active one. */
        createSession: () => {
          const s = newSession();
          set((st) => ({
            sessions: { ...st.sessions, [s.id]: s },
            activeSessionId: s.id,
          }));
          return s.id;
        },

        /**
         * Remove a session. If the deleted session was active, switch to
         * the most-recently-updated remaining session (or null if none left).
         */
        deleteSession: (id) =>
          set((st) => {
            // Destructure to remove `id` from the sessions map
            const { [id]: _removed, ...rest } = st.sessions;
            void _removed; // suppress unused-var lint
            const ids = Object.keys(rest);
            return {
              sessions: rest,
              activeSessionId:
                st.activeSessionId === id ? (ids.at(-1) ?? null) : st.activeSessionId,
            };
          }),

        /** Switch which session is shown in the playground. */
        setActiveSession: (id) => set({ activeSessionId: id }),

        /** Manually rename a session (double-click title in sidebar). */
        renameSession: (id, title) => set((s) => patch(s, id, { title })),

        /**
         * Wipe all messages from a session and reset its title to the
         * database name extracted from its connection URL.
         */
        clearSession: (id) =>
          set((s) =>
            patch(s, id, {
              messages: [],
              title: dbNameFromUrl(s.sessions[id]?.connectionString ?? ''),
            }),
          ),

        /**
         * Save the Postgres connection URL for a session.
         * Also derives the tab title from the URL's database name.
         */
        setSessionConnection: (id, url) =>
          set((s) =>
            patch(s, id, { connectionString: url, title: dbNameFromUrl(url) }),
          ),

        /** Toggle the "connected" flag (controls which UI the playground shows). */
        setSessionConnected: (id, connected) =>
          set((s) => patch(s, id, { isConnected: connected })),

        // ── Message actions ────────────────────────────────────────────────

        /**
         * Append a message to a session. Returns the created Message object
         * (needed by chat.tsx to get the ID for streaming updates).
         */
        addMessage: (id, fields) => {
          const msg = newMessage(fields);
          set((s) =>
            patch(s, id, { messages: [...(s.sessions[id]?.messages ?? []), msg] }),
          );
          return msg;
        },

        /**
         * Replace the content of an existing message (by ID).
         * Used during streaming to incrementally update the assistant's reply.
         */
        updateMessage: (sessionId, msgId, content) =>
          set((s) => {
            const session = s.sessions[sessionId];
            if (!session) return s;
            return patch(s, sessionId, {
              messages: session.messages.map((m) =>
                m.id === msgId ? { ...m, content } : m,
              ),
            });
          }),

        /** Remove a single message from a session's history. */
        deleteMessage: (sessionId, msgId) =>
          set((s) => {
            const session = s.sessions[sessionId];
            if (!session) return s;
            return patch(s, sessionId, {
              messages: session.messages.filter((m) => m.id !== msgId),
            });
          }),

        /**
         * Toggle the loading spinner. This is set to true before an LLM call
         * and reset to false in the finally block after streaming completes.
         * Note: we don't go through `patch()` here because we don't want to
         * bump `updatedAt` on every spinner toggle.
         */
        setLoading: (id, loading) =>
          set((s) => ({
            sessions: {
              ...s.sessions,
              [id]: { ...s.sessions[id], isLoading: loading },
            },
          })),

        // ── Derived helpers ────────────────────────────────────────────────

        /** Get the session object for the currently active tab. */
        getActiveSession: () => {
          const { sessions, activeSessionId } = get();
          return activeSessionId ? (sessions[activeSessionId] ?? null) : null;
        },

        /** Get a session by ID (may be undefined if deleted). */
        getSession: (id) => get().sessions[id],
      };
    },

    // ── Persistence config ─────────────────────────────────────────────────
    {
      name: 'chat-store', // localStorage key — change this to reset all users' data

      /**
       * Control what gets saved to localStorage. We strip `isLoading` so a
       * page reload doesn't leave a session stuck in "loading" state forever.
       * Add any other transient fields here as needed.
       */
      partialize: (s) => ({
        activeSessionId: s.activeSessionId,
        sessions: Object.fromEntries(
          Object.entries(s.sessions).map(([id, sess]) => [
            id,
            { ...sess, isLoading: false },
          ]),
        ),
      }),
    },
  ),
);
