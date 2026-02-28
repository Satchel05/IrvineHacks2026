/**
 * AssistantMessage.tsx — Orchestrator for structured LLM response cards.
 *
 * This file is intentionally thin. It:
 *   1. Parses the raw `content` string into a `StructuredResponse`
 *   2. Manages the accept/reject decision state
 *   3. Composes the sub-components into the final card layout
 *
 * Sub-components live in their own files:
 *   - risk.ts                → Risk level config + getRiskConfig()
 *   - structured.ts          → StructuredResponse type + extractStructured()
 *   - RiskHeader.tsx         → Colored header bar with icon + badge
 *   - CollapsibleSqlBlock.tsx → Dark SQL block with expand toggle
 *   - ResultTable.tsx        → Sortable data table + AffectedRecords count
 *   - QueryActions.tsx       → NotesSection bullets + ActionButtons bar
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { getRiskConfig } from "./risk";
import {
  extractStructured,
  cleanConfirmation,
  extractPrefixLines,
} from "./structured";
import { RiskHeader } from "./RiskHeader";
import { CollapsibleSqlBlock } from "./collapsiblesqlblock.tsx";
import { ResultTable, AffectedRecords } from "./ResultTable";
import { NotesSection, ActionButtons } from "./QueryActions";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AssistantMessageProps {
  content: string;
  /** Called when the user clicks Accept (true) or Reject (false). */
  onConfirm?: (accepted: boolean) => void;
  /** Called when the user clicks "Explain this". */
  onExplain?: () => void;
  /** Notifies the parent whether this message has a pending confirmation. */
  onConfirmationStateChange?: (pending: boolean) => void;
  /** Persists the accept/reject decision into the message store. */
  onDecisionPersist?: (decision: "accepted" | "rejected") => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AssistantMessage({
  content,
  onConfirm,
  onExplain,
  onConfirmationStateChange,
  onDecisionPersist,
}: AssistantMessageProps) {
  const structured = extractStructured(content);

  // Local decision — replaced by persisted value on re-mount
  const [localDecision, setLocalDecision] = useState<"accepted" | "rejected" | null>(null);
  const decision = structured?.confirmation_decision ?? localDecision;

  // Keep the state-change callback ref stable to avoid effect re-runs
  const onPendingChangeRef = useRef(onConfirmationStateChange);
  useEffect(() => { onPendingChangeRef.current = onConfirmationStateChange; });

  // Notify parent whenever pending state changes
  useEffect(() => {
    if (!structured?.confirmation_required) return;
    onPendingChangeRef.current?.(decision === null);
    return () => onPendingChangeRef.current?.(false);
  }, [decision, structured?.confirmation_required]);

  // ── Non-JSON fallback (tool status lines, errors, etc.) ────────────────
  if (!structured) {
    return <pre className="whitespace-pre-wrap text-sm font-sans">{content}</pre>;
  }

  // ── Destructure parsed response ────────────────────────────────────────
  const {
    sql,
    explanation,
    result,
    confirmation,
    confirmation_required,
    risk,
  } = structured;

  const riskCfg = getRiskConfig(risk);
  const prefixLines = extractPrefixLines(content, structured);

  const sqlString = typeof sql === "string" ? sql : "";
  const hasSql =
    sqlString.trim().length > 0 &&
    sqlString.trim() !== "{}" &&
    sqlString.trim() !== "null";

  const cleanedConfirmation = confirmation
    ? cleanConfirmation(String(confirmation))
    : "";

  const handleConfirm = (accepted: boolean) => {
    const d = accepted ? "accepted" : "rejected";
    setLocalDecision(d);
    onDecisionPersist?.(d);
    onConfirm?.(accepted);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="text-sm rounded-lg border overflow-hidden">

      <RiskHeader riskCfg={riskCfg} />

      <div className="p-4 space-y-4 bg-background">

        {/* Tool-call status lines, e.g. "Executing tool: query..." */}
        {prefixLines.map((line, i) => (
          <p key={i} className="text-muted-foreground text-xs">{line}</p>
        ))}

        {hasSql && <CollapsibleSqlBlock sql={sqlString.trim()} />}

        {explanation && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              What this query will do:
            </p>
            <p className="text-sm leading-relaxed text-foreground/90">{explanation}</p>
          </div>
        )}

        {result && <AffectedRecords result={result} countColor={riskCfg.countColor} />}
        {result && <ResultTable result={result} />}

        {cleanedConfirmation && (
          <NotesSection
            text={cleanedConfirmation}
            notesBg={riskCfg.notesBg}
            notesTitle={riskCfg.notesTitle}
            notesTitleColor={riskCfg.notesTitleColor}
            bulletColor={riskCfg.bulletColor}
          />
        )}

        <ActionButtons
          confirmationRequired={confirmation_required}
          decision={decision}
          onConfirm={handleConfirm}
          onExplain={onExplain}
        />

      </div>
    </div>
  );
}