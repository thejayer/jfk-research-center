"use client";

import { useState, type MouseEvent } from "react";

export function TimelinePermalink({
  eventId,
  title,
}: {
  eventId: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  const onClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const href = e.currentTarget.href;
    window.history.pushState({}, "", `#${eventId}`);
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard unavailable; URL is updated regardless.
    }
  };

  return (
    <a
      href={`#${eventId}`}
      className="timeline-permalink"
      aria-label={`Copy permalink to ${title}`}
      title={copied ? "Link copied" : "Copy permalink"}
      onClick={onClick}
    >
      {copied ? "✓" : "🔗"}
    </a>
  );
}
