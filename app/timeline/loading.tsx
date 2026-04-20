import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <div style={{ marginBottom: 28, maxWidth: "68ch" }}>
        <Skeleton width={120} height={12} style={{ marginBottom: 10 }} />
        <Skeleton width="80%" height={34} style={{ marginBottom: 14 }} />
        <SkeletonText lines={3} />
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 20,
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width={110} height={26} radius={999} />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: "12px 0",
          marginBottom: 24,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} width={72} height={28} radius={999} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} height={110} />
        ))}
      </div>
    </div>
  );
}
