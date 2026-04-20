import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container" style={{ paddingBottom: 96 }}>
      <div style={{ paddingTop: 20, marginBottom: 28 }}>
        <Skeleton width={220} height={12} />
      </div>
      <div style={{ marginBottom: 36 }}>
        <Skeleton width={320} height={34} style={{ marginBottom: 14 }} />
        <SkeletonText lines={3} />
      </div>
      <div style={{ marginBottom: 36 }}>
        <Skeleton width={160} height={14} style={{ marginBottom: 12 }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} height={72} />
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 36 }}>
        <Skeleton width={180} height={14} style={{ marginBottom: 12 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} height={96} />
          ))}
        </div>
      </div>
    </div>
  );
}
