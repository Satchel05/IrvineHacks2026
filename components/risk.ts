/**
 * risk.ts — Risk level config, types, and helpers.
 *
 * Single source of truth for all risk-level colors, labels, icons, and copy.
 * Import `getRiskConfig` wherever you need risk-aware styling.
 */

import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Skull,
} from "lucide-react";

export type RiskLevel = 0 | 1 | 2 | 3;

export interface RiskConfig {
  level: RiskLevel;
  label: string;
  subtitle: string;
  badge: string;
  icon: typeof ShieldCheck;
  headerBg: string;
  headerBorder: string;
  iconColor: string;
  badgeBg: string;
  countColor: string;
  notesBg: string;
  notesTitle: string;
  notesTitleColor: string;
  bulletColor: string;
  borderColor: string;
  bgColor: string;
}

const RISK_CONFIG: Record<RiskLevel, Omit<RiskConfig, "level">> = {
  0: {
    label: "Safe Operation",
    subtitle: "Standard read operation with minimal impact",
    badge: "LOW RISK",
    icon: ShieldCheck,
    headerBg: "bg-emerald-50 dark:bg-emerald-950/30",
    headerBorder: "border-emerald-200 dark:border-emerald-800",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    badgeBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    countColor: "text-emerald-600 dark:text-emerald-400",
    notesBg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
    notesTitle: "Notes",
    notesTitleColor: "text-emerald-700 dark:text-emerald-400",
    bulletColor: "text-emerald-600 dark:text-emerald-400",
    borderColor: "emerald-900",
    bgColor: "bg-emerald-600/10"
  },
  1: {
    label: "Moderate-Risk Operation Detected",
    subtitle: "Data modification with moderate impact",
    badge: "MODERATE RISK",
    icon: AlertTriangle,
    headerBg: "bg-amber-50 dark:bg-amber-950/30",
    headerBorder: "border-amber-200 dark:border-amber-800",
    iconColor: "text-amber-600 dark:text-amber-400",
    badgeBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    countColor: "text-amber-600 dark:text-amber-400",
    notesBg: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
    notesTitle: "Important Notes",
    notesTitleColor: "text-amber-700 dark:text-amber-400",
    bulletColor: "text-amber-500",
    borderColor: "amber-900",
    bgColor: "bg-amber-600/10"
  },
  2: {
    label: "High-Risk Operation Detected",
    subtitle: "Broad write — may affect many rows",
    badge: "HIGH RISK",
    icon: AlertOctagon,
    headerBg: "bg-red-50 dark:bg-red-950/30",
    headerBorder: "border-red-200 dark:border-red-800",
    iconColor: "text-red-600 dark:text-red-400",
    badgeBg: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    countColor: "text-red-600 dark:text-red-400",
    notesBg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
    notesTitle: "⚠ Critical Warnings ⚠",
    notesTitleColor: "text-red-700 dark:text-red-400",
    bulletColor: "text-red-500",
    borderColor: "red-900",
    bgColor: "bg-red-600/10",
  },
  3: {
    label: "CRITICAL: Extreme-Risk Operation",
    subtitle: "Destructive / schema change — immediate manual review required.",
    badge: "EXTREME RISK",
    icon: Skull,
    headerBg: "bg-red-50 dark:bg-red-950/30",
    headerBorder: "border-red-200 dark:border-red-800",
    iconColor: "text-red-600 dark:text-red-400",
    badgeBg: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    countColor: "text-red-600 dark:text-red-400",
    notesBg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
    notesTitle: "⚠ Critical Warnings ⚠",
    notesTitleColor: "text-red-700 dark:text-red-400",
    bulletColor: "text-red-500",
    borderColor: "red-900",
    bgColor: "bg-red-600/10"
  },
};

export function getRiskConfig(risk?: number): RiskConfig {
  const level = (
    risk != null && risk in RISK_CONFIG ? risk : 0
  ) as RiskLevel;
  return { level, ...RISK_CONFIG[level] };
}