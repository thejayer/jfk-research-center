import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container" style={{ paddingBottom: 96 }}>
      <div style={{ paddingTop: 20, marginBottom: 24 }}>
        <Skeleton width={240} height={12} />
      </div>
      <div style={{ marginBottom: 28 }}>
        <Skeleton width="70%" height={28} style={{ marginBottom: 10 }} />
        <Skeleton width={180} height={12} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 24,
        }}
      >
        <SkeletonCard height={140} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 16,
          }}
        >
          <Skeleton width={160} height={14} />
          <SkeletonCard height={200} />
          <SkeletonText lines={6} />
          <SkeletonCard height={200} />
        </div>
      </div>
    </div>
  );
}
