/**
 * QueryActions.tsx — Notes/warnings panel and action button bar.
 *
 * Contains two components:
 *   - `NotesSection`  — Renders confirmation text as a color-coded bullet list
 *   - `ActionButtons` — Explain / Accept / Reject buttons + post-decision badge
 */

"use client";

import { Check, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Notes / Warnings ─────────────────────────────────────────────────────────

interface NotesSectionProps {
  text: string;
  notesBg: string;
  notesTitle: string;
  notesTitleColor: string;
  bulletColor: string;
}

/**
 * Splits the LLM's confirmation text into bullet points and renders them
 * in a color-coded panel (green/amber/orange/red based on risk level).
 */
export function NotesSection({
  text,
  notesBg,
  notesTitle,
  notesTitleColor,
  bulletColor,
}: NotesSectionProps) {
  const bullets = text
    .split(/\n|(?<=\.)\s+(?=[A-Z•\-])/)
    .map((s) => s.replace(/^[-•*]\s*/, "").trim())
    .filter((s) => s.length > 2);

  if (bullets.length === 0) return null;

  return (
    <div className={cn("rounded-md border p-3 space-y-2", notesBg)}>
      <p className={cn("text-xs font-semibold uppercase tracking-wider", notesTitleColor)}>
        {notesTitle}
      </p>
      <ul className="space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-xs text-foreground/80">
            <span className={cn("mt-0.5 shrink-0", bulletColor)}>•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Action Buttons ───────────────────────────────────────────────────────────

interface ActionButtonsProps {
  confirmationRequired?: boolean;
  decision: "accepted" | "rejected" | null;
  onConfirm?: (accepted: boolean) => void;
  onExplain?: () => void;
  isLatest?: boolean;
}

/**
 * Bottom action bar for each response card.
 *
 * Always shows:   "Explain this"
 * When pending:   "Accept Query" + "Reject Query"
 * After decision: A status badge (Accepted / Rejected) replaces the buttons
 */
export function ActionButtons({
  confirmationRequired,
  decision,
  onConfirm,
  onExplain,
  isLatest = true,
}: ActionButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onExplain} disabled={!isLatest}>
        <MessageSquare className="h-3 w-3" />
        Explain this
      </Button>

      {confirmationRequired && decision === null && (
        <>
          <Button
            size="sm"
            className="gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white ml-auto"
            onClick={() => onConfirm?.(true)}
          >
            <Check className="h-3 w-3" />
            Accept Query
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => onConfirm?.(false)}
          >
            <X className="h-3 w-3" />
            Reject Query
          </Button>
        </>
      )}

      {confirmationRequired && decision !== null && (
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            decision === "accepted"
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
          )}
        >
          {decision === "accepted" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {decision === "accepted" ? "Accepted — executing…" : "Rejected"}
        </span>
      )}
    </div>
  );
}