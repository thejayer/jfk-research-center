"use client";

import { useEffect } from "react";

/**
 * On mount, if the URL hash matches `#chunk-N`, smooth-scroll to the
 * matching element and briefly flash a highlight. Mounted once per
 * document page; relies on each chunk card carrying `id="chunk-N"`.
 */
export function ChunkHashHandler() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!/^chunk-\d+$/.test(hash)) return;
    // Defer to the next frame so the layout has stabilized.
    const id = window.requestAnimationFrame(() => {
      const el = document.getElementById(hash);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("chunk-highlight");
      window.setTimeout(() => el.classList.remove("chunk-highlight"), 2400);
    });
    return () => window.cancelAnimationFrame(id);
  }, []);
  return null;
}
