/**
 * RiskHeader.tsx — Colored header bar showing risk level, icon, and badge.
 *
 * Rendered at the top of every AssistantMessage card.
 * Color scheme is driven by the `RiskConfig` from risk.ts.
 */

import { cn } from "@/lib/utils";
import type { RiskConfig } from "./risk";

interface RiskHeaderProps {
  riskCfg: RiskConfig;
}

export function RiskHeader({ riskCfg }: RiskHeaderProps) {
  const Icon = riskCfg.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b",
        riskCfg.headerBg,
        riskCfg.headerBorder,
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", riskCfg.iconColor)} />

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground">{riskCfg.label}</p>
        <p className="text-xs text-muted-foreground">{riskCfg.subtitle}</p>
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide",
          riskCfg.badgeBg,
        )}
      >
        {riskCfg.badge}
      </span>
    </div>
  );
}