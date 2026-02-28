"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatStore, type Message } from "@/app/store/chatStore";
import { Send, User, Bot, Loader2, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatProps {
  connectionString: string;
}

const schemaInitInFlight = new Set<string>();
const schemaInitCompleted = new Set<string>();

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex gap-3 p-4", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "flex-1 rounded-lg px-4 py-2 max-w-[80%]",
          isUser ? "bg-primary text-primary-foreground ml-auto" : "bg-muted",
        )}
      >
        <pre className="whitespace-pre-wrap text-sm font-sans">
          {message.content}
        </pre>
      </div>
    </div>
  );
}

export function Chat({ connectionString }: ChatProps) {
  const [input, setInput] = useState("");
  const [schemaLoading, setSchemaLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const activeSession = useChatStore((s) =>
    s.activeSessionId ? s.sessions[s.activeSessionId] : null,
  );
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const setLoading = useChatStore((s) => s.setLoading);
  const createSession = useChatStore((s) => s.createSession);

  const messages = activeSession?.messages ?? [];
  const isLoading = activeSession?.isLoading ?? false;
  const lastMessageContent = messages[messages.length - 1]?.content;

  // Auto-scroll to bottom when messages change or content updates (streaming)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, lastMessageContent]);

  // Create a session if none exists
  useEffect(() => {
    if (!activeSessionId) {
      createSession();
    }
  }, [activeSessionId, createSession]);

  // Fetch schema on connection
  const fetchSchema = useCallback(async () => {
    if (!connectionString || !activeSessionId) {
      return;
    }

    const schemaKey = `${activeSessionId}:${connectionString}`;
    if (
      schemaInitCompleted.has(schemaKey) ||
      schemaInitInFlight.has(schemaKey)
    ) {
      return;
    }

    schemaInitInFlight.add(schemaKey);

    setSchemaLoading(true);

    try {
      const response = await fetch("/api/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch schema");
      }

      const tableCount = data.schema?.tables?.length || 0;
      const tableNames = data.schema?.tables?.slice(0, 5).join(", ") || "none";
      const moreText = tableCount > 5 ? ` and ${tableCount - 5} more` : "";

      addMessage(activeSessionId, {
        role: "assistant",
        content: `🎉 **Schema learned successfully!**\n\nI've analyzed your database and found **${tableCount} table${tableCount !== 1 ? "s" : ""}**: ${tableNames}${moreText}.\n\nI'm ready to help you query your data! Try asking questions like:\n- "Show me all records from [table_name]"\n- "What columns are in [table_name]?"\n- "Find the top 10 most recent entries"`,
      });
      schemaInitCompleted.add(schemaKey);
    } catch (error) {
      addMessage(activeSessionId, {
        role: "assistant",
        content: `⚠️ **Could not load schema**: ${error instanceof Error ? error.message : "Unknown error"}\n\nYou can still ask questions, but I may need to discover your tables as we go.`,
      });
      schemaInitCompleted.delete(schemaKey);
    } finally {
      schemaInitInFlight.delete(schemaKey);
      setSchemaLoading(false);
    }
  }, [connectionString, activeSessionId, addMessage]);

  useEffect(() => {
    if (activeSessionId && connectionString) {
      fetchSchema();
    }
  }, [activeSessionId, connectionString, fetchSchema]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeSessionId || isLoading) return;

    const userMessage = input.trim();
    setInput("");

    // Add user message
    addMessage(activeSessionId, {
      role: "user",
      content: userMessage,
    });

    // Set loading state
    setLoading(activeSessionId, true);

    try {
      // Get the full conversation history including the new message
      const currentSession = useChatStore.getState().sessions[activeSessionId];
      const allMessages =
        currentSession?.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })) || [];

      const response = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connectionString,
          messages: allMessages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Something went wrong");
      }

      // Create an empty assistant message to stream into
      const assistantMessage = addMessage(activeSessionId, {
        role: "assistant",
        content: "",
      });

      // Stream the response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedContent += chunk;

        // Update the message with accumulated content
        updateMessage(activeSessionId, assistantMessage.id, accumulatedContent);
      }
    } catch (error) {
      addMessage(activeSessionId, {
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Something went wrong"}`,
      });
    } finally {
      setLoading(activeSessionId, false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!activeSessionId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Creating new chat...</p>
      </div>
    );
  }

  if (schemaLoading && messages.length === 0) {
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

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full min-h-75 text-muted-foreground">
            <div className="text-center">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Start a conversation by typing a message below.</p>
              <p className="text-sm mt-2">
                Ask questions about your PostgreSQL database in natural
                language.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex gap-3 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your database..."
            rows={2}
            className="resize-none"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            className="h-auto"
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
