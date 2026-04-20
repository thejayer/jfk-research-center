import type { CSSProperties } from "react";

export function Skeleton({
  width,
  height,
  radius,
  style,
}: {
  width?: number | string;
  height?: number | string;
  /** Override border-radius. Defaults to var(--radius-sm). */
  radius?: number | string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className="skeleton"
      style={{
        width,
        height,
        ...(radius !== undefined ? { borderRadius: radius } : null),
        ...style,
      }}
    />
  );
}

export function SkeletonCard({
  height = 120,
  style,
}: {
  height?: number | string;
  style?: CSSProperties;
}) {
  return (
    <Skeleton
      height={height}
      radius="var(--radius-md)"
      style={{ border: "1px solid var(--border)", ...style }}
    />
  );
}

export function SkeletonText({
  lines = 3,
  width = "100%",
}: {
  lines?: number;
  width?: number | string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={i === lines - 1 ? "62%" : width}
        />
      ))}
    </div>
  );
}
