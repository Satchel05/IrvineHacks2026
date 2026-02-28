"use client";

import { useState } from "react";
import {
  Database,
  Home,
  Settings,
  Play,
  Plus,
  MessageSquare,
  Trash2,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatStore } from "@/app/store/chatStore";

const navItems = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Playground",
    url: "/playground",
    icon: Play,
  },
  {
    title: "Database",
    url: "#",
    icon: Database,
  },
  {
    title: "Settings",
    url: "#",
    icon: Settings,
  },
];

function AppSidebar() {
  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const createSession = useChatStore((s) => s.createSession);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const renameSession = useChatStore((s) => s.renameSession);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const startEditing = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  };

  const saveEditing = () => {
    if (!editingSessionId) return;
    const title = editingTitle.trim();
    if (title) {
      renameSession(editingSessionId, title);
    }
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const sessionList = Object.values(sessions).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>Chats</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => createSession()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sessionList.length === 0 ? (
                <p className="px-2 text-sm text-muted-foreground">
                  No chats yet
                </p>
              ) : (
                sessionList.map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton
                      isActive={session.id === activeSessionId}
                      onClick={() => setActiveSession(session.id)}
                      className="group"
                    >
                      <MessageSquare className="h-4 w-4" />
                      {editingSessionId === session.id ? (
                        <Input
                          value={editingTitle}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={saveEditing}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") saveEditing();
                            if (e.key === "Escape") cancelEditing();
                          }}
                          className="h-7"
                        />
                      ) : (
                        <span
                          className="truncate flex-1"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            startEditing(session.id, session.title);
                          }}
                          title="Double-click to rename"
                        >
                          {session.title}
                        </span>
                      )}
                      <div
                        role="button"
                        tabIndex={0}
                        className="h-5 w-5 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <p className="text-xs text-muted-foreground px-2">Postgres MCP</p>
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
      <main className="flex-1">
        <div className="p-4">
          <SidebarTrigger />
        </div>
        {children}
      </main>
    </SidebarProvider>
  );
}
