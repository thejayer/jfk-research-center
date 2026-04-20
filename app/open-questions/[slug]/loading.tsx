import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container" style={{ paddingBottom: 96 }}>
      <div style={{ paddingTop: 20, marginBottom: 24 }}>
        <Skeleton width={260} height={12} />
      </div>
      <div style={{ marginBottom: 28 }}>
        <Skeleton width={140} height={12} style={{ marginBottom: 8 }} />
        <Skeleton width="70%" height={32} style={{ marginBottom: 14 }} />
        <SkeletonText lines={5} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Skeleton width={180} height={14} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} height={120} />
        ))}
      </div>
    </div>
  );
}
