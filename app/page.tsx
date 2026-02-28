"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useChatStore } from "./store/chat";

export default function Home() {
  const {
    connectionString,
    messages,
    isLoading,
    error,
    setConnectionString,
    addMessage,
    setLoading,
    setError,
    clearChat,
  } = useChatStore();

  const [query, setQuery] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMessage = { role: "user" as const, content: query };

    // Build messages array BEFORE updating state
    const messagesToSend = [...messages, userMessage];

    addMessage(userMessage);
    setQuery("");
    setLoading(true);
    setError(null);

    try {
      const requestBody = {
        connectionString,
        messages: messagesToSend,
      };
      console.log("Sending request body:", requestBody);

      const response = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      addMessage({ role: "assistant", content: data.result });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 flex items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Database Query</CardTitle>
          <CardDescription>
            Connect to your PostgreSQL database and query it using natural
            language
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="connectionString">
                Database Connection String
              </Label>
              <Input
                id="connectionString"
                type="password"
                placeholder="postgresql://user:password@host:port/database"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                required
              />
            </div>

            {/* Chat History */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Conversation</Label>
                {messages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearChat}
                    type="button"
                  >
                    Clear Chat
                  </Button>
                )}
              </div>
              <div className="h-80 overflow-y-auto border rounded-md p-4 bg-muted/30 space-y-4">
                {messages.length === 0 ? (
                  <p className="text-muted-foreground text-center text-sm">
                    Start a conversation by asking a question about your
                    database
                  </p>
                ) : (
                  messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <pre className="whitespace-pre-wrap text-sm font-sans">
                          {msg.content}
                        </pre>
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3">
                      <span className="text-sm text-muted-foreground">
                        Thinking...
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="query">Message</Label>
                <Textarea
                  id="query"
                  placeholder="Ask a question about your database in natural language..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !connectionString}
                className="w-full"
              >
                {isLoading ? "Querying..." : "Send"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
