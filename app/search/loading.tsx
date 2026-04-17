export default function Loading() {
  return (
    <div className="container" style={{ padding: "60px 0" }}>
      <div
        className="eyebrow"
        style={{ marginBottom: 14 }}
      >
        Searching the archive…
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 120,
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(90deg, var(--surface), var(--surface-2), var(--surface))",
              backgroundSize: "200% 100%",
              animation: "shimmer 1400ms ease-in-out infinite",
              border: "1px solid var(--border)",
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 0% 0%; }
          100% { background-position: -200% 0%; }
        }
      `}</style>
    </div>
  );
}
