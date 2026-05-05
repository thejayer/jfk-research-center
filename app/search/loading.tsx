import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <div
        style={{
          position: "sticky",
          top: "var(--header-height)",
          zIndex: 30,
          background: "color-mix(in srgb, var(--surface) 92%, transparent)",
          backdropFilter: "saturate(1.15) blur(10px)",
          WebkitBackdropFilter: "saturate(1.15) blur(10px)",
          borderBottom: "1px solid var(--border)",
          boxShadow: "var(--shadow-sticky-band)",
        }}
      >
        <div
          className="container"
          style={{
            paddingTop: 16,
            paddingBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <Skeleton height={48} radius="var(--radius-md)" />
          <Skeleton height={38} radius="var(--radius-md)" />
        </div>
      </div>

      <div
        className="container"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 28,
          paddingTop: 44,
          paddingBottom: 80,
        }}
      >
        <div
          className="search-loading-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: 36,
          }}
        >
          <aside
            aria-hidden="true"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <SkeletonCard height={220} />
            <SkeletonCard height={130} />
          </aside>

          <main>
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              Searching the archive...
            </div>
            <div
              style={{
                paddingBottom: 18,
                marginBottom: 18,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <Skeleton width="42%" height={28} />
              <div style={{ marginTop: 14, maxWidth: 560 }}>
                <SkeletonText lines={2} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} height={132} />
              ))}
            </div>
          </main>
        </div>
      </div>

      <style>{`
        @media (min-width: 920px) {
          .search-loading-layout {
            grid-template-columns: 280px minmax(0, 1fr) !important;
            align-items: start;
          }
        }
      `}</style>
    </div>
  );
}
