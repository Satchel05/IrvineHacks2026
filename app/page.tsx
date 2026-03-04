/**
 * Main page now mounts playground functionality at root.
 */
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
import { Database, Eye, EyeOff } from 'lucide-react';
import { useChatStore } from '@/app/store/chatStore';

function PasswordInput({ value, onChange }: { value: string; onChange: (v: string) => void; }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className='relative'>
      <Input
        id='connectionString'
        type={visible ? 'text' : 'password'}
        placeholder='postgresql://user:password@host:port/database'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='pr-10'
        required
      />
      <button
        type='button'
        onClick={() => setVisible((v) => !v)}
        className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors'>
        {visible ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
      </button>
    </div>
  );
}

function ConnectionCard({ savedUrl, onConnect, onReconnect }: { savedUrl: string; onConnect: (url: string) => void; onReconnect: () => void; }) {
  const [draft, setDraft] = useState(savedUrl);
  const hasSaved = Boolean(savedUrl);
  return (
    <div className='flex-1 flex items-center justify-center p-8 h-full'>
      <Card className='w-full max-w-3xl min-h-[500px] flex flex-col justify-center bg-gray-45 dark:bg-card'>
        <CardHeader className='text-center pb-10 pt-14'>
          <CardTitle className='flex items-center justify-center gap-3 text-3xl'>
            <Database className='h-7 w-7' />
            {hasSaved ? 'Reconnect to Database' : 'Connect to Database'}
          </CardTitle>
          <CardDescription className='text-base mt-3'>
            {hasSaved ?
              'Reconnect this tab using its saved database connection'
            : 'Enter your PostgreSQL connection string to start querying'}
          </CardDescription>
        </CardHeader>
        <CardContent className='px-14 pb-16'>
          {hasSaved ?
            <Button className='w-full' onClick={onReconnect}>Reconnect</Button>
          : <form onSubmit={(e) => { e.preventDefault(); const url = draft.trim(); if (url) onConnect(url); }} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='connectionString'>Connection String</Label>
                <PasswordInput value={draft} onChange={setDraft} />
              </div>
              <Button type='submit' className='w-full'>Connect</Button>
            </form>
          }
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBar({ title, onDisconnect }: { title: string; onDisconnect: () => void; }) {
  return (
    <div className='border-b px-4 py-2 flex items-center justify-between bg-muted/50'>
      <div className='flex items-center gap-2 text-sm'>
        <div className='h-2 w-2 rounded-full bg-green-500' />
        <span className='text-muted-foreground'>Connected</span>
        <span className='text-muted-foreground'>•</span>
        <span className='font-medium truncate max-w-50'>{title}</span>
      </div>
      {/* <Button variant="ghost" size="sm" onClick={onDisconnect}>Disconnect</Button> */}
    </div>
  );
}

function extractNeonEndpointSlug(connectionString: string): string | null {
  try {
    const { hostname } = new URL(connectionString);
    if (!hostname.startsWith('ep-')) return null;
    const parts = hostname.split('-');
    if (parts.length < 3) return null;
    return `${parts[1]}-${parts[2]}`;
  } catch { return null; }
}

export default function HomePage() {
  const activeId = useChatStore((s) => s.activeSessionId);
  const session = useChatStore((s) =>
    s.activeSessionId ? s.sessions[s.activeSessionId] : null,
  );
  const createSession = useChatStore((s) => s.createSession);
  const setConnection = useChatStore((s) => s.setSessionConnection);
  const setConnected = useChatStore((s) => s.setSessionConnected);
  const rename = useChatStore((s) => s.renameSession);

  const url = session?.connectionString ?? '';
  const connected = session?.isConnected ?? Boolean(url);

  if (!connected) {
    return (
      <ConnectionCard
        savedUrl={url}
        onConnect={(u) => {
          const id = activeId ?? createSession();
          setConnection(id, u);
          setConnected(id, true);
          const slug = extractNeonEndpointSlug(u);
          if (slug) rename(id, slug);
        }}
        onReconnect={() => {
          if (activeId && url) setConnected(activeId, true);
        }}
      />
    );
  }

  return (
    <div className='flex flex-col h-[calc(100vh-0.1rem)] overflow-hidden'>
      <StatusBar
        title={session?.title ?? 'Database'}
        onDisconnect={() => {
          if (activeId) setConnected(activeId, false);
        }}
      />
      <div className='flex-1 min-h-0 flex flex-col overflow-hidden'>
        <div className='h-full flex flex-col'>
          <Chat connectionString={url} />
        </div>
      </div>
    </div>
  );
}
