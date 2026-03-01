/**
 * LEARN REACT — Your playground to experiment with React
 *
 * HOW TO USE:
 * 1. Run: npm run dev (or yarn dev)
 * 2. Open: http://localhost:3000/learn-react
 * 3. Edit this file and save — the page will auto-refresh!
 *
 * REACT BASICS YOU'LL SEE:
 * - Components: functions that return JSX (the HTML-like stuff)
 * - useState: keeps data that can change; when it changes, React re-renders
 * - Props: data you pass into a component (e.g. title="Hello")
 * - Events: onClick, onChange, etc. — functions that run when the user does something
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ─── Example 1: A simple counter ─────────────────────────────────────────────
// useState(0) means: "a piece of state that starts at 0"
// count = current value, setCount = function to update it (React re-renders when you call it)
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Counter</CardTitle>
        <CardDescription>Click the button — count goes up. That&apos;s useState!</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-2xl font-mono">Count: {count}</p>
        <Button onClick={() => setCount(count + 1)}>Add 1</Button>
        <Button variant="outline" onClick={() => setCount(0)}>
          Reset
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Example 2: Text that mirrors what you type ──────────────────────────────
// The input is "controlled": its value comes from state, and onChange updates that state.
function MirrorInput() {
  const [text, setText] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Mirror input</CardTitle>
        <CardDescription>Type something — it appears below. That&apos;s a controlled input.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type here..."
          className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
        />
        <p className="text-muted-foreground">
          You typed: <span className="font-medium text-foreground">{text || "(nothing yet)"}</span>
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Example 3: A list you can add to ───────────────────────────────────────
// State can be arrays! We store items in state and add new ones with a button.
function TodoList() {
  const [items, setItems] = useState<string[]>(["Learn React", "Play with state"]);
  const [newItem, setNewItem] = useState("");

  const addItem = () => {
    if (newItem.trim()) {
      setItems([...items, newItem.trim()]); // [...items, x] = copy array and add x
      setNewItem("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Simple list</CardTitle>
        <CardDescription>Add items. State can be arrays — we copy and add with setItems.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="New item..."
            className="flex-1 rounded border border-input bg-background px-3 py-2 text-sm"
          />
          <Button onClick={addItem}>Add</Button>
        </div>
        <ul className="list-inside list-disc space-y-1 text-sm">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── The page: just compose the examples ────────────────────────────────────
export default function LearnReactPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Learn React — Playground</h1>
          <p className="mt-2 text-muted-foreground">
            Edit <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">app/learn-react/page.tsx</code> and save. The page will update. Try changing the examples or add your own!
          </p>
        </div>

        <div className="space-y-6">
          <Counter />
          <MirrorInput />
          <TodoList />
        </div>
      </div>
    </div>
  );
}
