"use client";

import { useEffect, useState } from "react";
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

export default function PlaygroundPage() {
  const [tempConnection, setTempConnection] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const activeSession = useChatStore((s) =>
    s.activeSessionId ? s.sessions[s.activeSessionId] : null,
  );
  const setSessionConnection = useChatStore((s) => s.setSessionConnection);
  const setSessionConnected = useChatStore((s) => s.setSessionConnected);

  const connectionString = activeSession?.connectionString ?? "";
  const isConnected =
    activeSession?.isConnected ??
    (activeSession ? Boolean(connectionString) : false);

  useEffect(() => {
    setTempConnection(connectionString);
  }, [connectionString, activeSessionId]);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSessionId) return;

    const trimmedConnection = tempConnection.trim();
    if (trimmedConnection) {
      setSessionConnection(activeSessionId, trimmedConnection);
      setSessionConnected(activeSessionId, true);
    }
  };

  const handleReconnect = () => {
    if (!activeSessionId || !connectionString) return;
    setSessionConnected(activeSessionId, true);
  };

  const handleDisconnect = () => {
    if (!activeSessionId) return;
    setSessionConnected(activeSessionId, false);
  };

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {connectionString
                ? "Reconnect to Database"
                : "Connect to Database"}
            </CardTitle>
            <CardDescription>
              {connectionString
                ? "Reconnect this tab using its saved database connection"
                : "Enter your PostgreSQL connection string to start querying"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {connectionString ? (
              <Button
                type="button"
                className="w-full"
                onClick={handleReconnect}
              >
                Reconnect
              </Button>
            ) : (
              <form onSubmit={handleConnect} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="connectionString">Connection String</Label>
                  <div className="relative">
                    <Input
                      id="connectionString"
                      type={showPassword ? "text" : "password"}
                      placeholder="postgresql://user:password@host:port/database"
                      value={tempConnection}
                      onChange={(e) => setTempConnection(e.target.value)}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Connection status header */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/50">
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Connected</span>
          </div>
          {activeSession && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="font-medium truncate max-w-50">
                {activeSession.title}
              </span>
            </>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleDisconnect}>
          Disconnect
        </Button>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        <Chat connectionString={connectionString} />
      </div>
    </div>
  );
}
