import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container" style={{ paddingBottom: 96 }}>
      <div style={{ paddingTop: 20, marginBottom: 28 }}>
        <Skeleton width={200} height={12} />
      </div>
      <div style={{ marginBottom: 36 }}>
        <Skeleton width={380} height={34} style={{ marginBottom: 14 }} />
        <SkeletonText lines={4} />
      </div>
      <div style={{ marginBottom: 36 }}>
        <Skeleton width={200} height={14} style={{ marginBottom: 12 }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} height={110} />
          ))}
        </div>
      </div>
    </div>
  );
}
