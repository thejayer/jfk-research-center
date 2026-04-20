import { SkeletonCard } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container" style={{ padding: "60px 0" }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Searching the archive…
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} height={120} />
        ))}
      </div>
    </div>
  );
}
