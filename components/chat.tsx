/**
 * chat.tsx — The core Chat UI component.
 *
 * Handles:
 *  1. Fetching database schema on first load (once per session+connection)
 *  2. Displaying messages with user/assistant avatars
 *  3. Submitting new messages and streaming LLM responses
 *
 * HOW TO EDIT:
 *  - To change message appearance, edit `MessageBubble` or `Avatar`.
 *  - To change the "no messages" placeholder, edit `EmptyState`.
 *  - To change the schema loading animation, edit `SchemaLoadingState`.
 *  - To change how user messages are sent, edit the `send()` function.
 *  - To change auto-scroll behavior, edit the first `useEffect`.
 *  - To add markdown rendering, replace the `<pre>` in `MessageBubble` with
 *    a markdown library (e.g. react-markdown).
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatStore, type Message } from "@/app/store/chatStore";
import { Send, User, Bot, Loader2, Database } from "lucide-react";
import { AssistantMessage } from "./assistantmessage";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the Chat component — just the Postgres connection string. */
interface ChatProps {
  connectionString: string;
}

// ─── Dedup guards (module-level, survives re-renders & strict mode) ───────────

/**
 * These Sets live at module scope (outside the component) so they persist
 * across React re-renders AND React Strict Mode's double-invocation of effects.
 *
 * `schemaInFlight` — keys currently being fetched (prevents concurrent dupes)
 * `schemaDone`     — keys that have already been fetched (prevents re-fetching)
 *
 * The key format is "sessionId:connectionString".
 */
const schemaInFlight = new Set<string>();
const schemaDone = new Set<string>();

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Round avatar circle — user (primary color) or bot (muted). */
function Avatar({ isUser }: { isUser: boolean }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted",
      )}
    >
      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
    </div>
  );
}

/**
 * A single chat message with avatar and content bubble.
 * User messages are right-aligned; assistant messages are left-aligned.
 */
function MessageBubble({
  message,
  onConfirm,
  onConfirmationStateChange,
  onDecisionPersist,
}: {
  message: Message;
  onConfirm?: (accepted: boolean) => void;
  onConfirmationStateChange?: (messageId: string, pending: boolean) => void;
  onDecisionPersist?: (decision: "accepted" | "rejected") => void;
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn("flex gap-3 p-4", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <Avatar isUser={isUser} />
      <div
        className={cn(
          "flex-1 rounded-lg px-4 py-2 max-w-[80%]",
          isUser ? "bg-primary text-primary-foreground ml-auto" : "bg-muted",
        )}
      >
        {isUser ? (
          <pre className="whitespace-pre-wrap text-sm font-sans">
            {message.content}
          </pre>
        ) : (
          <AssistantMessage
            content={message.content}
            onConfirm={onConfirm}
            onConfirmationStateChange={(pending) =>
              onConfirmationStateChange?.(message.id, pending)
            }
            onDecisionPersist={onDecisionPersist}
          />
        )}
      </div>
    </div>
  );
}

/** Shown while the LLM is processing (after user sends, before response arrives). */
function ThinkingIndicator() {
  return (
    <div className="flex gap-3 p-4">
      <Avatar isUser={false} />
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Thinking...</span>
      </div>
    </div>
  );
}

/** Placeholder shown when the session has no messages yet. */
function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center h-full min-h-75 text-muted-foreground">
      <div className="text-center">
        <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Start a conversation by typing a message below.</p>
        <p className="text-sm mt-2">
          Ask questions about your PostgreSQL database in natural language.
        </p>
      </div>
    </div>
  );
}

/** Full-screen loading state shown while fetching schema for the first time. */
function SchemaLoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <div className="text-center">
        <Database className="h-12 w-12 mx-auto mb-4 animate-pulse" />
        <p className="font-medium">Learning your database schema...</p>
        <p className="text-sm mt-2">This may take a few seconds</p>
        <Loader2 className="h-5 w-5 mx-auto mt-4 animate-spin" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Main Chat component. Mounted by `PlaygroundPage` when connected.
 *
 * Lifecycle:
 *  1. On mount (if no active session exists), creates one via `createSession()`.
 *  2. Immediately fetches the database schema (once per session+connection pair).
 *  3. Renders messages and a text input for the user to type queries.
 *  4. On submit, sends the full chat history to `/api/query` and streams the
 *     response back, updating the assistant message in real time.
 */
export function Chat({ connectionString }: ChatProps) {
  const [input, setInput] = useState("");
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [pendingConfirmationIds, setPendingConfirmationIds] = useState<
    Set<string>
  >(() => new Set());
  /** Ref attached to an invisible div at the bottom of the messages list (for auto-scroll). */
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Store selectors ─────────────────────────────────────────────────────
  const activeId = useChatStore((s) => s.activeSessionId);
  const session = useChatStore((s) =>
    s.activeSessionId ? s.sessions[s.activeSessionId] : null,
  );
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const setLoading = useChatStore((s) => s.setLoading);
  const createSession = useChatStore((s) => s.createSession);

  const messages = session?.messages ?? [];
  const isLoading = session?.isLoading ?? false;
  const hasPendingConfirmation = pendingConfirmationIds.size > 0;

  // ── Auto-scroll to bottom when new messages arrive or content changes ───
  const lastContent = messages.at(-1)?.content;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, lastContent]);

  // ── Create a default session if none exists (first visit) ───────────────
  useEffect(() => {
    if (!activeId) createSession();
  }, [activeId, createSession]);

  // ── Schema fetch ──────────────────────────────────────────────────────────

  /**
   * Fetch the database schema from `/api/schema`.
   *
   * Uses module-level Sets (`schemaInFlight`, `schemaDone`) to ensure:
   *  - Only ONE fetch per session+connection pair happens at a time
   *  - A successful fetch is never repeated (even across re-renders)
   *  - A failed fetch allows retry (key is removed from `schemaDone`)
   *
   * On success, inserts a system-like assistant message listing the tables found.
   */
  const fetchSchema = useCallback(async () => {
    if (!connectionString || !activeId) return;

    // Dedup key = sessionId:connectionString
    const key = `${activeId}:${connectionString}`;
    if (schemaDone.has(key) || schemaInFlight.has(key)) return;

    schemaInFlight.add(key);
    setSchemaLoading(true);

    try {
      const res = await fetch("/api/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch schema");

      // Build a friendly summary message
      const tables: string[] = data.schema?.tables ?? [];
      const preview = tables.slice(0, 5).join(", ") || "none";
      const more = tables.length > 5 ? ` and ${tables.length - 5} more` : "";

      addMessage(activeId, {
        role: "assistant",
        content: [
          `🎉 **Schema learned successfully!**`,
          ``,
          `I've analyzed your database and found **${tables.length} table${tables.length !== 1 ? "s" : ""}**: ${preview}${more}.`,
          ``,
          `I'm ready to help you query your data! Try asking questions like:`,
          `- "Show me all records from [table_name]"`,
          `- "What columns are in [table_name]?"`,
          `- "Find the top 10 most recent entries"`,
        ].join("\n"),
      });
      schemaDone.add(key); // Mark as done — won't fetch again
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      addMessage(activeId, {
        role: "assistant",
        content: `⚠️ **Could not load schema**: ${msg}\n\nYou can still ask questions, but I may need to discover your tables as we go.`,
      });
      schemaDone.delete(key); // Allow retry on next mount
    } finally {
      schemaInFlight.delete(key);
      setSchemaLoading(false);
    }
  }, [connectionString, activeId, addMessage]);

  /** Trigger schema fetch when session + connection are ready. */
  useEffect(() => {
    if (activeId && connectionString) fetchSchema();
  }, [activeId, connectionString, fetchSchema]);

  // ── Send message ──────────────────────────────────────────────────────────

  /**
   * Handle form submission: send a user message and stream the LLM response.
   *
   * Flow:
   *  1. Add the user message to the store
   *  2. Read the FULL message history from the store (not from React state,
   *     to avoid stale closures)
   *  3. POST to `/api/query` with the history + connection string
   *  4. Create an empty assistant message in the store
   *  5. Stream the response body, updating the assistant message content
   *     as each chunk arrives (gives the user real-time feedback)
   *  6. On error, add an error message; always clear `isLoading`
   */
  const sendMessage = useCallback(
    async (text: string, options?: { ignorePendingLock?: boolean }) => {
      if (!text.trim() || !activeId || isLoading) return;
      if (hasPendingConfirmation && !options?.ignorePendingLock) return;

      addMessage(activeId, { role: "user", content: text });
      setLoading(activeId, true);

      try {
        const current = useChatStore.getState().sessions[activeId];
        const history =
          current?.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })) ?? [];

        const res = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionString, messages: history }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Something went wrong");
        }

        const asstMsg = addMessage(activeId, {
          role: "assistant",
          content: "",
        });
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          updateMessage(activeId, asstMsg.id, accumulated);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        addMessage(activeId, { role: "assistant", content: `Error: ${msg}` });
      } finally {
        setLoading(activeId, false);
      }
    },
    [
      activeId,
      isLoading,
      hasPendingConfirmation,
      connectionString,
      addMessage,
      updateMessage,
      setLoading,
    ],
  );

  // Keep the form's onSubmit as a thin wrapper
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasPendingConfirmation) return;
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage(text);
  };

  const handleConfirmationStateChange = useCallback(
    (messageId: string, pending: boolean) => {
      setPendingConfirmationIds((prev) => {
        const next = new Set(prev);
        if (pending) next.add(messageId);
        else next.delete(messageId);
        return next;
      });
    },
    [],
  );

  /**
   * Persist the user's Accept/Reject decision into the message content.
   * This injects `confirmation_decision` into the JSON so it survives page reloads.
   * Handles multiple JSON objects by updating all of them.
   */
  const handleDecisionPersist = useCallback(
    (messageId: string, decision: "accepted" | "rejected") => {
      if (!activeId) return;
      // Read fresh messages from store to avoid stale closure
      const currentSession = useChatStore.getState().sessions[activeId];
      const msg = currentSession?.messages.find((m) => m.id === messageId);
      if (!msg) return;

      let content = msg.content;
      let modified = false;

      // Find all balanced JSON objects and inject confirmation_decision
      let depth = 0;
      let start = -1;
      const segments: { start: number; end: number; json: string }[] = [];

      for (let i = 0; i < content.length; i++) {
        if (content[i] === "{") {
          if (depth === 0) start = i;
          depth++;
        } else if (content[i] === "}") {
          depth--;
          if (depth === 0 && start !== -1) {
            segments.push({
              start,
              end: i + 1,
              json: content.slice(start, i + 1),
            });
            start = -1;
          }
        }
      }

      // Process segments in reverse order so indices stay valid
      for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i];
        try {
          const parsed = JSON.parse(seg.json);
          if (parsed && typeof parsed === "object") {
            parsed.confirmation_decision = decision;
            const newJson = JSON.stringify(parsed);
            content =
              content.slice(0, seg.start) + newJson + content.slice(seg.end);
            modified = true;
          }
        } catch {
          // Not valid JSON, skip
        }
      }

      if (modified) {
        updateMessage(activeId, messageId, content);
      }
    },
    [activeId, updateMessage],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  // Edge case: no active session yet (createSession effect hasn't fired)
  if (!activeId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Creating new chat...</p>
      </div>
    );
  }

  // Show full-screen loading while schema is being fetched (no messages yet)
  if (schemaLoading && messages.length === 0) {
    return <SchemaLoadingState />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Messages area ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onConfirmationStateChange={handleConfirmationStateChange}
                onDecisionPersist={(decision) =>
                  handleDecisionPersist(m.id, decision)
                }
                onConfirm={(accepted) =>
                  sendMessage(
                    accepted
                      ? "Yes, confirmed. Please proceed with the operation."
                      : "No, cancel the operation. Do not execute it.",
                    { ignorePendingLock: true },
                  )
                }
              />
            ))}
            {isLoading && <ThinkingIndicator />}
            {/* Invisible anchor for auto-scrolling */}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input area ───────────────────────────────────────────────────── */}
      <div className="border-t p-4">
        <form onSubmit={send} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter inserts a newline
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(e);
              }
            }}
            placeholder="Ask about your database..."
            rows={2}
            className="resize-none"
            disabled={isLoading || hasPendingConfirmation}
          />
          <Button
            type="submit"
            size="icon"
            className="h-auto"
            disabled={isLoading || hasPendingConfirmation || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          {hasPendingConfirmation
            ? "Please Accept or Reject the pending confirmation before sending a new message"
            : "Press Enter to send, Shift+Enter for new line"}
        </p>
      </div>
    </div>
  );
}
