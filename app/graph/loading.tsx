import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <div style={{ marginBottom: 24, maxWidth: "68ch" }}>
        <Skeleton width={120} height={12} style={{ marginBottom: 10 }} />
        <Skeleton width="70%" height={32} style={{ marginBottom: 14 }} />
        <SkeletonText lines={3} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Skeleton width="100%" height={40} radius={999} />
      </div>
      <SkeletonCard height={520} />
    </div>
  );
}
