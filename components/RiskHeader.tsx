import { cn } from "@/lib/utils";
import type { RiskConfig } from "./risk";
import { useTheme } from "./theme-provider";

interface RiskHeaderProps {
  riskCfg: RiskConfig;
}

export function RiskHeader({ riskCfg }: RiskHeaderProps) {
  const Icon = riskCfg.icon;
  const { theme } = useTheme()
  const labelTextColor = theme === "dark" ? "text-white" : "text-slate-800";

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 border rounded-t-md",
      )}
      role="alert"
      aria-live="assertive"
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-red-700 p-2",
          "min-w-[36px] min-h-[36px]",
          riskCfg.iconColor || "text-red-600", riskCfg.notesBg
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>

      <div className="flex flex-col min-w-0">
        <p className={cn("font-bold text-sm uppercase leading-tight tracking-wide", labelTextColor)}>
          {riskCfg.label}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
          {riskCfg.subtitle}
        </p>
      </div>
    </div>
  );
}