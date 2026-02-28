/**
 * playground/layout.tsx — Sidebar layout wrapper for the playground.
 *
 * Provides:
 *  1. A collapsible sidebar (shadcn Sidebar) with navigation links and a chat session list
 *  2. A main content area where `children` (the playground page) renders
 *
 * HOW TO EDIT:
 *  - To add new navigation links, add entries to `NAV_ITEMS`.
 *  - To change how sessions appear in the sidebar, edit the `sorted.map(...)` block.
 *  - To change the rename behavior, edit `InlineRenameInput`.
 *  - To change the sidebar footer branding, edit the `<SidebarFooter>` block.
 */

'use client';

import { useState, useRef } from 'react';
import {
  Database,
  Home,
  Settings,
  Play,
  Plus,
  MessageSquare,
  Trash2,
  BotMessageSquare,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChatStore } from '@/app/store/chatStore';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Static navigation links shown at the top of the sidebar.
 * Each item has a title, URL, and Lucide icon component.
 * Links with `url: "#"` are placeholders — wire them up when those pages exist.
 */
const NAV_ITEMS = [
  { title: 'Home', url: '/', icon: Home },
  { title: 'Playground', url: '/playground', icon: Play },
  { title: 'Database', url: '#', icon: Database },
  { title: 'Settings', url: '#', icon: Settings },
] as const;

// ─── Sidebar ──────────────────────────────────────────────────────────────────

/**
 * Inline text input that replaces a session title for renaming.
 * Appears when the user double-clicks a session name in the sidebar.
 *
 * Behavior:
 *  - Enter/blur → commit the rename (if non-empty, otherwise cancel)
 *  - Escape     → cancel without saving
 *  - Clicks inside the input are stopped from propagating (so they
 *    don't trigger the parent menu button's onClick).
 */
function InlineRenameInput({
  value,
  onSave,
  onCancel,
  onDeleteClick,
}: {
  value: string;
  onSave: (title: string) => void;
  onCancel: () => void;
  onDeleteClick?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const deletePendingRef = useRef(false);

  /** Save the trimmed draft, or cancel if it's empty. */
  const commit = () => {
    // If delete was clicked, don't commit - the delete handler will run
    if (deletePendingRef.current) return;
    const trimmed = draft.trim();
    if (trimmed) onSave(trimmed);
    else onCancel();
  };

  return (
    <>
      <Input
        value={draft}
        autoFocus
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
        className='h-7 flex-1'
      />
      {/* Inline delete button while editing */}
      {onDeleteClick && (
        <div
          role='button'
          tabIndex={0}
          className='h-5 w-5 flex items-center justify-center rounded-md hover:bg-accent ml-1'
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deletePendingRef.current = true;
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDeleteClick();
          }}>
          <Trash2 className='h-3 w-3' />
        </div>
      )}
    </>
  );
}

/**
 * The full sidebar component.
 *
 * Sections:
 *  1. Navigation — static links from `NAV_ITEMS`
 *  2. Chats      — list of chat sessions sorted by most-recently-updated
 *     - Click a session → make it active
 *     - Double-click the title → rename inline
 *     - Trash icon → delete the session
 *     - Plus button → create a new session
 */
function AppSidebar() {
  // Pull store state + actions via individual selectors (avoids unnecessary re-renders)
  const sessions = useChatStore((s) => s.sessions);
  const activeId = useChatStore((s) => s.activeSessionId);
  const createSession = useChatStore((s) => s.createSession);
  const setActive = useChatStore((s) => s.setActiveSession);
  const remove = useChatStore((s) => s.deleteSession);
  const rename = useChatStore((s) => s.renameSession);

  /** Tracks which session is currently being renamed (null = none). */
  const [editingId, setEditingId] = useState<string | null>(null);

  /** Sessions sorted newest-first by `updatedAt`. */
  const sorted = Object.values(sessions).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );

  return (
    <Sidebar>
      <SidebarContent>
        {/* ── Sidebar Title ────────────────────────────────────────────── */}
        <div className='flex items-center gap-3 px-4 pt-4 pb-2'>
          <span
            style={{
              background: '#6B74C9',
              borderRadius: '10px',
              padding: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <BotMessageSquare className='h-6 w-6 text-white' />
          </span>
          <h1 className='text-2xl font-bold text-sidebar-foreground/80 tracking-tight'>
            Envoy
          </h1>
        </div>

        {/* ── Chat session list ─────────────────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel className='flex items-center justify-between'>
            <span>CONNECTIONS</span>
            {/* Plus button: create a new blank session */}
            <Button
              variant='ghost'
              size='icon'
              className='h-5 w-5'
              onClick={() => createSession()}>
              <Plus className='h-4 w-4' />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sorted.length === 0 ?
                <p
                  key='empty-state'
                  className='px-2 text-sm text-muted-foreground'>
                  No chats yet
                </p>
              : sorted.map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton
                      isActive={session.id === activeId}
                      onClick={() => setActive(session.id)}
                      className='group'
                      style={{
                        width: '327px',
                        height: '68px',
                        background:
                          session.id === activeId ?
                            'rgba(82,82,234,0.15)'
                          : undefined,
                        border:
                          session.id === activeId ?
                            '1.5px solid rgba(82,82,234,0.3)'
                          : '1.5px solid transparent',
                        borderRadius: '12px',
                      }}>
                      <Database className='h-4 w-4' />

                      <div className='flex flex-col flex-1'>
                        {/* Show rename input OR static title */}
                        {editingId === session.id ?
                          <InlineRenameInput
                            value={session.title}
                            onSave={(t) => {
                              rename(session.id, t);
                              setEditingId(null);
                            }}
                            onCancel={() => setEditingId(null)}
                            onDeleteClick={() => {
                              setEditingId(null);
                              remove(session.id);
                            }}
                          />
                        : <>
                            <span
                              className='truncate font-medium text-[14px] text-sidebar-foreground/70'
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setEditingId(session.id);
                              }}
                              title='Double-click to rename'>
                              {session.title}
                            </span>
                            <span className='text-xs text-sidebar-foreground/40 mt-1 block'>
                              {session.connectionString?.slice(0, 20) || ''}
                              {(
                                session.connectionString &&
                                session.connectionString.length > 20
                              ) ?
                                '...'
                              : ''}
                            </span>
                          </>
                        }
                      </div>

                      {/* Trash icon — only visible on hover (via group-hover), hidden when editing */}
                      {editingId !== session.id && (
                        <div
                          role='button'
                          tabIndex={0}
                          className='h-5 w-5 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent'
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            remove(session.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              remove(session.id);
                            }
                          }}
                          onMouseDown={(e) => {
                            // Prevent focus change that might trigger blur handlers
                            e.preventDefault();
                          }}>
                          <Trash2 className='h-3 w-3' />
                        </div>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              }
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Sidebar footer — branding and settings button at bottom */}
      <SidebarFooter>
        <div className='pb-2'>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href='#'>
                  <Settings />
                  <span>Settings</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
        <p className='text-xs text-muted-foreground px-2 mt-2'>Postgres MCP</p>
      </SidebarFooter>
    </Sidebar>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

/**
 * Layout component wrapping the `/playground` route.
 * Uses shadcn's SidebarProvider for collapsible sidebar behavior.
 * The `<SidebarTrigger />` is the hamburger icon that toggles the sidebar.
 */
export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className='flex-1 min-w-0 overflow-hidden'>
        <div className='p-4'>
          <SidebarTrigger />
        </div>
        {children}
      </main>
    </SidebarProvider>
  );
}
