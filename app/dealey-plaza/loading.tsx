import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <div style={{ marginBottom: 24, maxWidth: "68ch" }}>
        <Skeleton width={120} height={12} style={{ marginBottom: 10 }} />
        <Skeleton width="65%" height={32} style={{ marginBottom: 14 }} />
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
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width={130} height={28} radius={999} />
        ))}
      </div>
      <SkeletonCard height={420} style={{ marginBottom: 24 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} height={80} />
        ))}
      </div>
    </div>
  );
}
