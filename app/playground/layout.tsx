// This route has been removed. All traffic is now directed to the root page.
"use client";

import { useState, useEffect, useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar";
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
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH = 352; // px — must match your --sidebar-width value

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

  const sorted = Object.entries(sessions)
    .map(([storeId, session]) => ({
      ...session,
      id: session.id || storeId,
      storeId,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <Sidebar>
      <SidebarContent>
        {/* ── Sidebar Title ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <span
            style={{
              background: "#6366F1",
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
                  <SidebarMenuItem key={session.storeId}>
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
                            color:
                              session.id === activeId ? "#6366F1" : undefined,
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
                                <span
                                  className={cn(
                                    "truncate font-medium text-[14px] text-sidebar-foreground/70",
                                    session.id === activeId
                                      ? "text-color-indigo-500 font-bold"
                                      : "",
                                  )}
                                >
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

// ─── The magic: a thin wrapper that overrides shadcn's sidebar animation ──────
//
// Strategy: shadcn's <Sidebar> renders a fixed-position container div with
// data-state="expanded|collapsed". We intercept open state ourselves and:
//   1. Apply `translate-x-0` / `-translate-x-full` on the sidebar wrapper
//      via a CSS class so WE own the animation timing & easing.
//   2. Animate the main content's margin-left in sync for a satisfying "push".
//   3. Use a cubic-bezier spring curve for that premium feel.
//
// We SKIP SidebarProvider's built-in keyboard shortcut (Ctrl+B) since it
// fires a state change without triggering our animation layer — instead we
// handle Ctrl+B ourselves here.
// ──────────────────────────────────────────────────────────────────────────────

export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  // Track whether we've mounted so we can skip the initial "snap" on load
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/*
        Inject a globalz <style> that:
        1. Overrides shadcn's fixed sidebar container with our own transition.
        2. Kills the default offcanvas left-offset animation so only ours fires.
        3. Adds a spring-eased transition to both sidebar & content margin.
      */}
      <style>{`
        /* Gap: shrinks to push content, overflow visible so sidebar slides out */
        [data-slot="sidebar-gap"] {
          position: relative !important;
          overflow: visible !important;
          flex-shrink: 0 !important;
          transition: width 480ms cubic-bezier(0.32, 0.72, 0, 1) !important;
          will-change: width;
        }

        [data-sidebar-open="true"] [data-slot="sidebar-gap"] {
          width: var(--sidebar-width) !important;
        }

        [data-sidebar-open="false"] [data-slot="sidebar-gap"] {
          width: 0px !important;
        }

        /* Container: absolutely positioned, slides left in sync with gap */
        [data-slot="sidebar-container"] {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: auto !important;
          width: var(--sidebar-width) !important;
          height: 100svh !important;
          will-change: transform;
          transition: transform 480ms cubic-bezier(0.32, 0.72, 0, 1) !important;
        }

        [data-sidebar-open="true"] [data-slot="sidebar-container"] {
          transform: translateX(0) !important;
        }

        /* Slide fully off screen to the left */
        [data-sidebar-open="false"] [data-slot="sidebar-container"] {
          transform: translateX(-100%) !important;
        }

        /* Disable transitions on first mount */
        [data-sidebar-init="false"] [data-slot="sidebar-gap"],
        [data-sidebar-init="false"] [data-slot="sidebar-container"] {
          transition: none !important;
        }
      `}</style>

      {/*
        We wrap SidebarProvider in a div we control.
        data-sidebar-open drives our CSS above.
        We pass `open` to SidebarProvider so shadcn still tracks state
        (needed for data-state attribute on sidebar inner components).
      */}
      <div
        data-sidebar-open={String(open)}
        data-sidebar-init={String(mounted.current)}
        className="flex w-full min-h-svh"
        style={{ "--sidebar-width": `${SIDEBAR_WIDTH}px` } as React.CSSProperties}
      >
        <SidebarProvider
          open={open}
          onOpenChange={setOpen}
          // Prevent SidebarProvider from adding its own wrapper styles that clash
          style={{ display: "contents" } as React.CSSProperties}
        >
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
        </SidebarProvider>
      </div>
    </>
  );
}