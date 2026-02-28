"use client";

import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [connectionString, setConnectionString] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "bot"; content: string }[]
  >([]);
  const [input, setInput] = useState("");

  const chatRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !connectionString) return;

    const userText = input;
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setInput("");

    try {
      const res = await fetch(connectionString, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "bot", content: data.reply || "No response" },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", content: "Error connecting to server." },
      ]);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-2xl p-6 bg-white dark:bg-zinc-900 rounded-lg shadow flex flex-col gap-4">

        <h1 className="text-2xl font-bold">Simple Chatbot</h1>

        {/* Connection String */}
        <input
          type="text"
          placeholder="Enter API connection string..."
          value={connectionString}
          onChange={(e) => setConnectionString(e.target.value)}
          className="w-full p-2 border rounded bg-zinc-100 dark:bg-zinc-800"
        />

        {/* Fixed Height Scrollable Chat */}
        <div
          ref={chatRef}
          className="h-96 overflow-y-auto border rounded p-4 bg-zinc-50 dark:bg-zinc-800 space-y-2"
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`${
                msg.role === "user"
                  ? "text-right text-pink-600"
                  : "text-left text-blue-600"
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>

        {/* Input Row */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 p-2 border rounded bg-zinc-100 dark:bg-zinc-800"
          />
          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-black text-white rounded dark:bg-white dark:text-black"
          >
            Send
          </button>
        </div>

      </main>
    </div>
  );
}