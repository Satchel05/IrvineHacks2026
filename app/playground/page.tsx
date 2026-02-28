'use client';

import { useState } from 'react';
import { Chat } from '@/components/chat';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Database } from 'lucide-react';
import { useChatStore } from '@/app/store/chatStore';

export default function PlaygroundPage() {
  const [connectionString, setConnectionString] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [tempConnection, setTempConnection] = useState('');

  const activeSession = useChatStore((s) =>
    s.activeSessionId ? s.sessions[s.activeSessionId] : null
  );

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempConnection.trim()) {
      setConnectionString(tempConnection.trim());
      setIsConnected(true);
    }
  };

  const handleDisconnect = () => {
    setConnectionString('');
    setIsConnected(false);
    setTempConnection('');
  };

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Connect to Database
            </CardTitle>
            <CardDescription>
              Enter your PostgreSQL connection string to start querying
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleConnect} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="connectionString">Connection String</Label>
                <Input
                  id="connectionString"
                  type="password"
                  placeholder="postgresql://user:password@host:port/database"
                  value={tempConnection}
                  onChange={(e) => setTempConnection(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Connect
              </Button>
            </form>
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
