import type { CaseTimelineEvent, CaseTimelineIndex } from "@/lib/api-types";
import { EventCard } from "./event-card";

const DALLAS_START = "1963-11-22";
const DALLAS_END = "1963-11-25";

const DAY_LABELS: Record<string, { weekday: string; full: string }> = {
  "1963-11-22": { weekday: "Friday", full: "November 22, 1963" },
  "1963-11-23": { weekday: "Saturday", full: "November 23, 1963" },
  "1963-11-24": { weekday: "Sunday", full: "November 24, 1963" },
  "1963-11-25": { weekday: "Monday", full: "November 25, 1963" },
};

export function DallasView({ data }: { data: CaseTimelineIndex }) {
  const events = data.events
    .filter((e) => e.date >= DALLAS_START && e.date <= DALLAS_END)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const at = a.timeLocal ?? "";
      const bt = b.timeLocal ?? "";
      return at < bt ? -1 : at > bt ? 1 : 0;
    });

  const byDay = new Map<string, CaseTimelineEvent[]>();
  for (const e of events) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date)!.push(e);
  }
  const days = Array.from(byDay.keys()).sort();

  return (
    <section aria-label="72 hours in Dallas, November 22–25 1963">
      <div
        style={{
          padding: "16px 18px",
          marginBottom: 24,
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-md)",
          background: "color-mix(in srgb, var(--text) 4%, var(--surface))",
          maxWidth: "72ch",
        }}
      >
        <div
          className="eyebrow"
          style={{ fontSize: "0.7rem", marginBottom: 6, letterSpacing: "0.12em" }}
        >
          Marquee window
        </div>
        <p
          className="muted"
          style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.55 }}
        >
          {events.length} hour-by-hour events from the motorcade through the
          transfer of Oswald and his shooting by Ruby. Times are local Central
          Standard Time as recorded in the Warren Commission Report and HSCA
          chronology.
        </p>
      </div>

      <ol
        className="dallas-track"
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          position: "relative",
        }}
      >
        {days.map((day) => {
          const dayEvents = byDay.get(day)!;
          const labels = DAY_LABELS[day];
          return (
            <li key={day} style={{ marginBottom: 28 }}>
              <h2
                id={`dallas-${day}`}
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.4rem",
                  letterSpacing: "-0.005em",
                  marginBottom: 4,
                }}
              >
                {labels?.weekday ?? day}
              </h2>
              <div
                className="muted num"
                style={{
                  fontSize: "0.82rem",
                  letterSpacing: "0.04em",
                  marginBottom: 14,
                }}
              >
                {labels?.full ?? day} · {dayEvents.length}{" "}
                {dayEvents.length === 1 ? "event" : "events"}
              </div>
              <ol
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {dayEvents.map((e) => (
                  <li key={e.id} style={{ display: "flex", gap: 14 }}>
                    <div
                      className="num"
                      aria-hidden="true"
                      style={{
                        flex: "0 0 auto",
                        width: 56,
                        paddingTop: 14,
                        fontSize: "0.82rem",
                        color: "var(--text-muted)",
                        letterSpacing: "0.04em",
                        textAlign: "right",
                      }}
                    >
                      {e.timeLocal ?? "—"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <EventCard event={e} as="article" />
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
