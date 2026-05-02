"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import styles from "./site-header.module.css";

const NAV: Array<{ label: string; href: string }> = [
  { label: "Search", href: "/search" },
  { label: "Entities", href: "/entities" },
  { label: "Topics", href: "/topics" },
  { label: "Timeline", href: "/timeline" },
  { label: "Network", href: "/graph" },
  { label: "Evidence", href: "/evidence" },
  { label: "Open Questions", href: "/open-questions" },
  { label: "Established Facts", href: "/established-facts" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand} aria-label="JFK Research Center — home">
          <Logo />
          <span className={styles.brandText}>
            <span className={styles.brandLine}>JFK Research Center</span>
            <span className={styles.brandSub}>Archival Study · MVP</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link href="/search" className={styles.searchBtn} aria-label="Open search">
            <SearchIcon />
            <span>Search</span>
            <kbd className={styles.kbd}>/</kbd>
          </Link>
          <ThemeToggle />
          <button
            type="button"
            className={styles.menuBtn}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="primary-mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="primary-mobile-nav"
          className={styles.mobilePanel}
          aria-label="Primary"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.mobileLink}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function Logo() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="36" height="36" rx="3" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.2" />
      <path
        d="M12 10 L12 30"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M12 22 L20 14 L28 14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 14 L28 30"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="30" cy="12" r="1.8" fill="var(--accent)" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13.5 13.5 L10.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
