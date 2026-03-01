"use client";

interface LoadingAnimationProps {
  /** Main loading text below the icon */
  title?: string;
  /** Secondary text below the title */
  subtitle?: string;
  /** Size of the database icon in pixels */
  iconSize?: number;
  /** Size of the spinner in pixels */
  spinnerSize?: number;
  /** Gap between elements in pixels */
  gap?: number;
  /** Padding around the container (e.g. "32px") */
  padding?: string;
  /** Color of the database icon (e.g. "#64748B") */
  iconColor?: string;
  /** Color of the spinner gradient and dot (e.g. "#3B82F6") */
  spinnerColor?: string;
}

/** Gray database icon: cylindrical with 3 stacked disk layers */
function DatabaseIcon({
  size,
  color = "#6366F1",
}: {
  size: number;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: size, height: size }}
    >
      <ellipse cx="24" cy="12" rx="12" ry="4" fill={color} opacity="0.3" />
      <path
        d="M36 12v24c0 2.2-5.4 4-12 4s-12-1.8-12-4V12"
        stroke={color}
        strokeWidth="2"
        fill="none"
      />
      <ellipse cx="24" cy="12" rx="12" ry="4" stroke={color} strokeWidth="2" fill="none" />
      <ellipse cx="24" cy="24" rx="12" ry="4" stroke={color} strokeWidth="2" fill="none" />
      <ellipse cx="24" cy="36" rx="12" ry="4" stroke={color} strokeWidth="2" fill="none" />
    </svg>
  );
}

/** Spinner: ring with angular gradient (transparent → color), rotating, with dot on edge */
function SpinnerRing({ size, color = "#7a7ceb" }: { size: number; color?: string }) {
  const dotSize = Math.max(4, size * 0.2);
  const ringThickness = Math.max(3, size * 0.1);

  return (
    <div className="relative animate-spin" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${color} 360deg)`,
          mask: `radial-gradient(farthest-side, transparent calc(100% - ${ringThickness}px), black calc(100% - ${ringThickness}px))`,
          WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${ringThickness}px), black calc(100% - ${ringThickness}px))`,
        }}
      />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: dotSize,
          height: dotSize,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

const DEFAULTS = {
  title: "Learning your database schema...",
  subtitle: "This may take a few seconds",
  iconSize: 96,
  spinnerSize: 40,
  gap: 16,
  iconColor: "#94A3B8",
  spinnerColor: "#7a7ceb",
};

export function LoadingAnimation({
  title = DEFAULTS.title,
  subtitle = DEFAULTS.subtitle,
  iconSize = DEFAULTS.iconSize,
  spinnerSize = DEFAULTS.spinnerSize,
  gap = DEFAULTS.gap,
  padding,
  iconColor,
  spinnerColor = DEFAULTS.spinnerColor,
}: LoadingAnimationProps) {
  return (
    <div
      className="flex max-w-md flex-col items-center justify-center text-center"
      style={{
        gap,
        padding,
      }}
    >
      <div className="text-foreground">
        <DatabaseIcon size={iconSize} color={iconColor ?? "currentColor"} />
      </div>
      <div className="space-y-2">
        {title && (
          <p className="text-lg font-semibold text-foreground sm:text-xl">
            {title}
          </p>
        )}
        {subtitle && (
          <p className="text-base text-muted-foreground sm:text-lg">
            {subtitle}
          </p>
        )}
      </div>
      <SpinnerRing size={spinnerSize} color={spinnerColor} />
    </div>
  );
}
