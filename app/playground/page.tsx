/**
 * playground/page.tsx — Main playground page.
 *
 * Shows ONE of two views based on the active session's connection state:
 *   • Disconnected → ConnectionCard (enter URL or reconnect)
 *   • Connected    → StatusBar + Chat component
 *
 * HOW TO EDIT:
 *  - To change the connection form UI, edit `ConnectionCard`.
 *  - To change the input mask (password toggle), edit `PasswordInput`.
 *  - To change the green "Connected" banner, edit `StatusBar`.
 *  - The actual chat logic lives in `@/components/chat`.
 */

"use client";

import { useState } from "react";
import { Chat } from "@/components/chat";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Database, Eye, EyeOff } from "lucide-react";
import { useChatStore } from "@/app/store/chatStore";

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * A text input that toggles between password (masked) and text (visible).
 * Used for the Postgres connection string so credentials aren't shown by default.
 */
function PasswordInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id="connectionString"
        type={visible ? "text" : "password"}
        placeholder="postgresql://user:password@host:port/database"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
        required
      />
      {/* Eye toggle button (absolute-positioned inside the input) */}
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/**
 * Card shown when the session is NOT connected.
 *
 * Two modes:
 *  1. `savedUrl` exists → show a simple "Reconnect" button (the URL is remembered)
 *  2. No saved URL      → show a form to enter a new connection string
 *
 * @param savedUrl    - Previously stored connection string (may be empty)
 * @param onConnect   - Called with the new URL when the user submits the form
 * @param onReconnect - Called when the user clicks "Reconnect" (uses savedUrl)
 */
function ConnectionCard({
  savedUrl,
  onConnect,
  onReconnect,
}: {
  savedUrl: string;
  onConnect: (url: string) => void;
  onReconnect: () => void;
}) {
  const [draft, setDraft] = useState(savedUrl);
  const hasSaved = Boolean(savedUrl);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {hasSaved ? "Reconnect to Database" : "Connect to Database"}
          </CardTitle>
          <CardDescription>
            {hasSaved
              ? "Reconnect this tab using its saved database connection"
              : "Enter your PostgreSQL connection string to start querying"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasSaved ? (
            /* Quick-reconnect button for tabs that already have a saved URL */
            <Button className="w-full" onClick={onReconnect}>
              Reconnect
            </Button>
          ) : (
            /* First-time connection form */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const url = draft.trim();
                if (url) onConnect(url);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="connectionString">Connection String</Label>
                <PasswordInput value={draft} onChange={setDraft} />
              </div>
              <Button type="submit" className="w-full">
                Connect
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Thin green banner shown when connected.
 * Displays the session title and a "Disconnect" button.
 */
function StatusBar({
  title,
  onDisconnect,
}: {
  title: string;
  onDisconnect: () => void;
}) {
  return (
    <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/50">
      <div className="flex items-center gap-2 text-sm">
        {/* Green dot = connected indicator */}
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <span className="text-muted-foreground">Connected</span>
        <span className="text-muted-foreground">•</span>
        <span className="font-medium truncate max-w-50">{title}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onDisconnect}>
        Disconnect
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Root page component for `/playground`.
 *
 * Reads the active session from the Zustand store and decides which view to show:
 *  - Not connected → `ConnectionCard`
 *  - Connected     → `StatusBar` + `Chat`
 *
 * Connection state is managed by `setSessionConnection` (stores the URL)
 * and `setSessionConnected` (toggles the connected flag).
 */
export default function PlaygroundPage() {
  const activeId = useChatStore((s) => s.activeSessionId);
  const session = useChatStore((s) =>
    s.activeSessionId ? s.sessions[s.activeSessionId] : null,
  );
  const createSession = useChatStore((s) => s.createSession);
  const setConnection = useChatStore((s) => s.setSessionConnection);
  const setConnected = useChatStore((s) => s.setSessionConnected);

  const url = session?.connectionString ?? "";
  // Default to "connected" if there's a saved URL (recover from page reload)
  const connected = session?.isConnected ?? Boolean(url);

  // ── Disconnected view ───────────────────────────────────────────────────
  if (!connected) {
    return (
      <ConnectionCard
        savedUrl={url}
        onConnect={(u) => {
          const id = activeId ?? createSession();
          setConnection(id, u); // Save the connection string to the session
          setConnected(id, true); // Mark the session as connected
        }}
        onReconnect={() => {
          if (activeId && url) setConnected(activeId, true);
        }}
      />
    );
  }

  // ── Connected view ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <StatusBar
        title={session?.title ?? "Database"}
        onDisconnect={() => {
          if (activeId) setConnected(activeId, false);
        }}
      />
      <div className="flex-1 overflow-hidden">
        <Chat connectionString={url} />
      </div>
    </div>
  );
}
