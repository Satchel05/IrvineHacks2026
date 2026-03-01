/**
 * ToolStatusBadge.tsx — Animated inline indicator for active tool execution.
 *
 * Shown inside the AssistantMessage card while the server is executing an
 * MCP tool call (e.g. execute_query). Disappears once streaming is done.
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Shimmer } from "./ai-elements/shimmer";
import { motion, AnimatePresence } from 'framer-motion';

interface ToolStatusBadgeProps {
  /** The tool name being executed, e.g. "execute_query". Null = hidden. */
  toolName: string | null;
}


export function AnimatedShimmer({ text, active }: { text: string; active: boolean }) {
  const [current, setCurrent] = useState(text);

  useEffect(() => {
    if (text !== current) {
      const t = setTimeout(() => setCurrent(text), 0);
      return () => clearTimeout(t);
    }
  }, [text, current]);

  return (
    <span className="relative flex items-center">
      <AnimatePresence mode="wait">
        <motion.span
          key={current + (active ? '-active' : '-done')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center translate-y-[3px]"
        >
          {active ? <Shimmer>{current}</Shimmer> : `${current} ✅`}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function ToolStatusBadge({ toolName }: ToolStatusBadgeProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toolName) {
      setVisible(true);
    } else {
      const t = setTimeout(() => setVisible(false), 4000000);
      return () => clearTimeout(t);
    }
  }, [toolName]);

  if (!visible && !toolName) return null;
  const isActive = !!toolName;

  return (
    <>
      <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-opacity duration-300",
        isActive ? "opacity-100" : "opacity-100" // keep visible to show checkmark
      )}
    >
      <AnimatedShimmer text={isActive ? `Calling ${toolName}...` : 'Done'} active={isActive} />
    </div>
    </>
  );
}