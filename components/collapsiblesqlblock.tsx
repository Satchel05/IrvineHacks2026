/**
 * CollapsibleSqlBlock.tsx — Dark SQL code block with expand/collapse toggle.
 *
 * Shows the first 3 lines of SQL with a "Show full query (N lines)" button.
 * Includes a copy-to-clipboard button in the footer bar.
 */

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSqlBlockProps {
  sql: string;
}

export function CollapsibleSqlBlock({ sql }: CollapsibleSqlBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = sql.trim().split("\n");
  const preview = lines.slice(0, 3).join("\n");
  const hasMore = lines.length > 3;

  const copy = () => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="rounded-md border bg-zinc-900 dark:bg-zinc-950 overflow-hidden text-sm">
      {/* Code area */}
      <pre className="px-4 pt-3 pb-1 font-mono text-xs leading-relaxed whitespace-pre text-zinc-100 overflow-x-auto">
        {expanded ? sql.trim() : preview}
        {!expanded && hasMore && <span className="text-zinc-500"> …</span>}
      </pre>

      {/* Footer bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-zinc-700">
        {hasMore ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                expanded && "rotate-180",
              )}
            />
            {expanded ? "Hide query" : `Show full query (${lines.length} lines)`}
          </button>
        ) : (
          <span />
        )}

        <button
          onClick={copy}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}