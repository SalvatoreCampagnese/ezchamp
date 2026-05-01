"use client";

/**
 * eSports neon spinner — two counter-rotating rings drawn with conic gradients
 * (cyan → magenta → violet) plus a soft pulsing core. Pure CSS, no asset.
 *
 * Sizes: sm (24px), md (40px), lg (64px).
 */
export function Spinner({
  size = "md",
  label,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}) {
  const px = size === "sm" ? 24 : size === "lg" ? 64 : 40;
  return (
    <div className={`spinner-wrap ${className}`} role="status" aria-live="polite">
      <span className="spinner" style={{ width: px, height: px }}>
        <span className="spinner-ring" />
        <span className="spinner-ring is-inner" />
        <span className="spinner-core" />
      </span>
      {label && (
        <span className="spinner-label">{label}</span>
      )}
    </div>
  );
}

/**
 * Full-section centered spinner (handy for page-level loading states).
 */
export function SpinnerBlock({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <Spinner size="lg" label={label} />
    </div>
  );
}
