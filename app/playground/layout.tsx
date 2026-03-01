"use client";

import { useState, useRef } from "react";
import {
  Database,
  Home,
  Settings,
  Play,
  Plus,
  Trash2,
  BotMessageSquare,
  Pencil,
} from "lucide-react";
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
} from "@/components/ui/sidebar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatStore } from "@/app/store/chatStore";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { title: "Home", url: "/", icon: Home },
  { title: "Playground", url: "/playground", icon: Play },
  { title: "Database", url: "#", icon: Database },
  { title: "Settings", url: "#", icon: Settings },
] as const;

function InlineRenameInput({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) onSave(trimmed);
    else onCancel();
  };

  return (
    <Input
      value={draft}
      autoFocus
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onCancel();
      }}
      className="h-7 flex-1"
    />
  );
}

function AppSidebar() {
  const sessions = useChatStore((s) => s.sessions);
  const activeId = useChatStore((s) => s.activeSessionId);
  const createSession = useChatStore((s) => s.createSession);
  const setActive = useChatStore((s) => s.setActiveSession);
  const remove = useChatStore((s) => s.deleteSession);
  const rename = useChatStore((s) => s.renameSession);

  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = Object.values(sessions).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );

  return (
    <Sidebar>
      <SidebarContent>
        {/* ── Sidebar Title ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <span
            style={{
              background: "#6B74C9",
              borderRadius: "10px",
              padding: "8px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BotMessageSquare className="h-6 w-6 text-white" />
          </span>
          <h1 className="text-2xl font-bold text-sidebar-foreground/80 tracking-tight">
            Envoy
          </h1>
        </div>

        {/* ── Chat session list ──────────────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>CONNECTIONS</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 cursor-pointer"
              onClick={() => createSession()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sorted.length === 0 ? (
                <p className="px-2 text-sm text-muted-foreground">
                  No chats yet
                </p>
              ) : (
                sorted.map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <SidebarMenuButton
                          isActive={session.id === activeId}
                          onClick={() => setActive(session.id)}
                          className="group"
                          style={{
                            width: "327px",
                            height: "68px",
                            background:
                              session.id === activeId
                                ? "rgba(82,82,234,0.15)"
                                : undefined,
                            border:
                              session.id === activeId
                                ? "1.5px solid rgba(82,82,234,0.3)"
                                : "1.5px solid transparent",
                            borderRadius: "12px",
                          }}
                        >
                          <Database className="h-4 w-4 shrink-0" />

                          <div className="flex flex-col flex-1 min-w-0">
                            {editingId === session.id ? (
                              <InlineRenameInput
                                value={session.title}
                                onSave={(t) => {
                                  rename(session.id, t);
                                  setEditingId(null);
                                }}
                                onCancel={() => setEditingId(null)}
                              />
                            ) : (
                              <>
                                <span className="truncate font-medium text-[14px] text-sidebar-foreground/70">
                                  {session.title}
                                </span>
                                <span className="text-xs text-sidebar-foreground/40 mt-1 block truncate">
                                  {session.connectionString
                                    ? session.connectionString.slice(0, 20) +
                                      (session.connectionString.length > 20
                                        ? "..."
                                        : "")
                                    : ""}
                                </span>
                              </>
                            )}
                          </div>
                        </SidebarMenuButton>
                      </ContextMenuTrigger>

                      <ContextMenuContent className="w-48">
                        <ContextMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => setEditingId(session.id)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Rename
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                          onClick={() => {
                            setEditingId(null);
                            remove(session.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="pb-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <ThemeToggle />
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
        <p className="text-xs text-muted-foreground px-2 mt-2">Postgres MCP</p>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 min-w-0 overflow-hidden">
        <div className="p-4">
          <SidebarTrigger />
        </div>
        {children}
      </main>
    </SidebarProvider>
  );
}