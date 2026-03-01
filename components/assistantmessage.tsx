"use client";

import { useState, useEffect, useRef } from "react";
import { getRiskConfig } from "./risk";
import {
  extractStructured,
  cleanConfirmation,
  extractPrefixLines,
} from "./structured";
import { RiskHeader } from "./RiskHeader";
import { CollapsibleSqlBlock } from "./collapsiblesqlblock";
import { ResultTable, AffectedRecords } from "./ResultTable";
import { NotesSection, ActionButtons } from "./QueryActions";
import MarkdownQueryBlock from "./MarkdownQueryBlock";
import { ToolStatusBadge } from "./ToolStatusBadge";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AssistantMessageProps {
  content: string;
  /**
   * Name of the MCP tool currently executing (e.g. "execute_query").
   * Passed down from chat.tsx during streaming; null when idle.
   * Rendered as an animated badge — never baked into message content.
   */
  activeToolName?: string | null;
  /** Called when the user clicks Accept (true) or Reject (false). */
  onConfirm?: (accepted: boolean) => void;
  /** Called when the user clicks "Explain this". */
  onExplain?: () => void;
  /** Notifies the parent whether this message has a pending confirmation. */
  onConfirmationStateChange?: (pending: boolean) => void;
  /** Persists the accept/reject decision into the message store. */
  onDecisionPersist?: (decision: "accepted" | "rejected") => void;
  isLatest?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AssistantMessage({
  content,
  activeToolName = null,
  onConfirm,
  onExplain,
  onConfirmationStateChange,
  isLatest = true,
  onDecisionPersist,
}: AssistantMessageProps) {
  const structured = extractStructured(content);

  // Local decision — replaced by persisted value on re-mount
  const [localDecision, setLocalDecision] = useState<
    "accepted" | "rejected" | null
  >(null);
  const decision = structured?.confirmation_decision ?? localDecision;

  // Keep the state-change callback ref stable to avoid effect re-runs
  const onPendingChangeRef = useRef(onConfirmationStateChange);
  useEffect(() => {
    onPendingChangeRef.current = onConfirmationStateChange;
  });

  // Notify parent whenever pending state changes
  useEffect(() => {
    if (!structured?.confirmation_required) return;
    onPendingChangeRef.current?.(decision === null);
    return () => onPendingChangeRef.current?.(false);
  }, [decision, structured?.confirmation_required]);

  // ── Non-JSON fallback (tool status lines, errors, etc.) ────────────────
  if (!structured) {
    return (
      <div className="space-y-2">
        <ToolStatusBadge toolName={activeToolName} />
        {content.trim() && (
          <pre className="whitespace-pre-wrap break-words text-sm font-sans">
            {content}
          </pre>
        )}
      </div>
    );
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
    <div className="text-sm rounded-lg border overflow-hidden w-full max-w-full">
      <RiskHeader riskCfg={riskCfg} />

      <div className="p-4 space-y-4 bg-background">
        {/* Animated tool execution badge — only visible while streaming */}
        <ToolStatusBadge toolName={activeToolName} />

        {/* Tool-call status lines, e.g. "Executing tool: query..." */}
        {prefixLines.map((line, i) => (
          <p key={i} className="text-muted-foreground text-xs">
            {line}
          </p>
        ))}

        {hasSql && <CollapsibleSqlBlock sql={sqlString.trim()} />}

        {explanation && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              What this query will do:
            </p>
            <MarkdownQueryBlock>{explanation}</MarkdownQueryBlock>
          </div>
        )}

        {result && (
  <AffectedRecords
    result={result}
    sql={sqlString}
    riskCfg={riskCfg}
  />
)}
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
          isLatest={isLatest}
        />
      </div>
    </div>
  );
}
