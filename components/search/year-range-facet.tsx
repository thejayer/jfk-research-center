"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SearchFilters as FacetData } from "@/lib/api-types";

export function YearRangeFacet({
  filters,
  open,
  onToggleOpen,
}: {
  filters: FacetData;
  open: boolean;
  onToggleOpen: () => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { min, max } = filters.yearBounds;

  const urlFrom = clamp(parseIntOr(params?.get("yearFrom"), min), min, max);
  const urlTo = clamp(parseIntOr(params?.get("yearTo"), max), min, max);

  const [from, setFrom] = useState(urlFrom);
  const [to, setTo] = useState(urlTo);

  useEffect(() => {
    setFrom(urlFrom);
    setTo(urlTo);
  }, [urlFrom, urlTo]);

  const isActive = urlFrom !== min || urlTo !== max;

  const commit = useCallback(
    (nextFrom: number, nextTo: number) => {
      const lo = Math.min(nextFrom, nextTo);
      const hi = Math.max(nextFrom, nextTo);
      const sp = new URLSearchParams(Array.from(params?.entries() ?? []));
      if (lo !== min) sp.set("yearFrom", String(lo));
      else sp.delete("yearFrom");
      if (hi !== max) sp.set("yearTo", String(hi));
      else sp.delete("yearTo");
      router.replace(`/search?${sp.toString()}`);
    },
    [params, router, min, max],
  );

  const clear = useCallback(() => {
    const sp = new URLSearchParams(Array.from(params?.entries() ?? []));
    sp.delete("yearFrom");
    sp.delete("yearTo");
    router.replace(`/search?${sp.toString()}`);
  }, [params, router]);

  const maxCount = useMemo(
    () =>
      Math.max(
        1,
        ...filters.years.map((y) => filters.yearCounts[y] ?? 0),
      ),
    [filters.years, filters.yearCounts],
  );

  const span = Math.max(1, max - min);
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const pctLo = ((lo - min) / span) * 100;
  const pctHi = ((hi - min) / span) * 100;

  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 0",
          color: "var(--text)",
          fontSize: "0.9rem",
          fontWeight: 500,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          Event date
          {isActive && (
            <span
              style={{
                fontSize: "0.72rem",
                padding: "2px 7px",
                borderRadius: 999,
                background: "var(--accent-soft)",
                color: "var(--accent)",
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {urlFrom}–{urlTo}
            </span>
          )}
        </span>
        <span
          aria-hidden
          style={{
            color: "var(--text-muted)",
            transform: `rotate(${open ? 90 : 0}deg)`,
            transition: "transform var(--motion)",
            fontSize: "0.8rem",
          }}
        >
          ▸
        </span>
      </button>
      {open && (
        <div style={{ paddingBottom: 14 }}>
          {isActive && (
            <button
              type="button"
              onClick={clear}
              style={{
                fontSize: "0.74rem",
                color: "var(--text-muted)",
                padding: "2px 0",
                marginBottom: 8,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}

          <div
            className="muted num"
            style={{
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              marginBottom: 6,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {lo} – {hi}
          </div>

          <div
            aria-hidden
            style={{
              position: "relative",
              height: 36,
              display: "flex",
              alignItems: "flex-end",
              gap: 1,
              marginBottom: 4,
            }}
          >
            {filters.years.map((y) => {
              const yn = parseInt(y, 10);
              const count = filters.yearCounts[y] ?? 0;
              const h = count > 0 ? Math.max(2, (count / maxCount) * 32) : 1;
              const inRange = yn >= lo && yn <= hi;
              return (
                <div
                  key={y}
                  style={{
                    flex: 1,
                    height: h,
                    background: inRange
                      ? "var(--accent)"
                      : "var(--border-strong)",
                    opacity: count > 0 ? 1 : 0.35,
                    borderRadius: 1,
                  }}
                  title={`${y}: ${count.toLocaleString()}`}
                />
              );
            })}
          </div>

          <div className="year-range" style={{ position: "relative", height: 22 }}>
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                height: 2,
                background: "var(--border)",
                transform: "translateY(-50%)",
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: "50%",
                left: `${pctLo}%`,
                right: `${100 - pctHi}%`,
                height: 2,
                background: "var(--accent)",
                transform: "translateY(-50%)",
              }}
            />
            <input
              type="range"
              aria-label="Event date: from"
              min={min}
              max={max}
              step={1}
              value={from}
              onChange={(e) => setFrom(parseInt(e.target.value, 10))}
              onMouseUp={() => commit(from, to)}
              onTouchEnd={() => commit(from, to)}
              onKeyUp={() => commit(from, to)}
            />
            <input
              type="range"
              aria-label="Event date: to"
              min={min}
              max={max}
              step={1}
              value={to}
              onChange={(e) => setTo(parseInt(e.target.value, 10))}
              onMouseUp={() => commit(from, to)}
              onTouchEnd={() => commit(from, to)}
              onKeyUp={() => commit(from, to)}
            />
          </div>

          <div
            className="muted num"
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              marginTop: 4,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>{min}</span>
            <span>{max}</span>
          </div>
        </div>
      )}

      <style>{`
        .year-range input[type="range"] {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 22px;
          background: transparent;
          appearance: none;
          -webkit-appearance: none;
          pointer-events: none;
          accent-color: var(--accent);
        }
        .year-range input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--bg);
          border: 2px solid var(--accent);
          cursor: grab;
          pointer-events: auto;
          box-shadow: var(--shadow-sm);
        }
        .year-range input[type="range"]:active::-webkit-slider-thumb {
          cursor: grabbing;
        }
        .year-range input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--bg);
          border: 2px solid var(--accent);
          cursor: grab;
          pointer-events: auto;
        }
        .year-range input[type="range"]::-webkit-slider-runnable-track {
          height: 22px;
          background: transparent;
        }
        .year-range input[type="range"]::-moz-range-track {
          height: 22px;
          background: transparent;
        }
      `}</style>
    </div>
  );
}

function parseIntOr(s: string | null | undefined, fallback: number): number {
  if (!s) return fallback;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
