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
import FancyCodeBlock from './FancyCodeBlock';

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
    <div className='rounded-md border bg-muted/50 overflow-hidden text-sm'>
      <div className='flex items-center justify-between px-3 py-1.5 border-b bg-muted text-muted-foreground text-xs font-mono'>
        <span>SQL</span>
        <button
          onClick={copy}
          className='hover:text-foreground transition-colors'>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <FancyCodeBlock language='sql'>{sql}</FancyCodeBlock>
    </div>
  );
}