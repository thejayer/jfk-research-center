"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import styles from "./site-header.module.css";

type NavItem = {
  label: string;
  href: string;
  description?: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

type MenuKey = "dealey" | "explore";

const PRIMARY_NAV: NavItem[] = [
  { label: "Evidence", href: "/evidence" },
  { label: "Timeline", href: "/timeline" },
];

const DEALEY_GROUPS: NavGroup[] = [
  {
    title: "Dealey Plaza",
    items: [
      {
        label: "Witness map",
        href: "/dealey-plaza",
        description: "Interactive schematic with witness positions and claims.",
      },
      {
        label: "Trajectory sandbox",
        href: "/dealey-plaza/trajectory",
        description: "3D assumptions, presets, and deterministic ray math.",
      },
      {
        label: "Topic dossier",
        href: "/topic/dealey-plaza",
        description: "Documents, context, and related evidence for the plaza.",
      },
    ],
  },
];

const EXPLORE_GROUPS: NavGroup[] = [
  {
    title: "Research",
    items: [
      {
        label: "Search",
        href: "/search",
        description: "Search documents, entities, topics, and timelines.",
      },
      {
        label: "Topics",
        href: "/topics",
        description: "Browse curated subject areas and dossiers.",
      },
      {
        label: "Entities",
        href: "/entities",
        description: "People, agencies, locations, and organizations.",
      },
      {
        label: "Bibliography",
        href: "/bibliography",
        description: "Reference list for sources used across the site.",
      },
    ],
  },
  {
    title: "Analysis",
    items: [
      {
        label: "Network graph",
        href: "/graph",
        description: "Explore entity co-occurrence and relationships.",
      },
      {
        label: "Compare",
        href: "/compare",
        description: "Put evidence and documents side by side.",
      },
      {
        label: "Established facts",
        href: "/established-facts",
        description: "High-confidence record-backed facts.",
      },
      {
        label: "Open questions",
        href: "/open-questions",
        description: "Unresolved questions and competing interpretations.",
      },
      {
        label: "Tension map",
        href: "/tensions",
        description:
          "Threads grouped by tension types: contradiction, timing, redaction, gap, pattern, related.",
      },
    ],
  },
  {
    title: "Project",
    items: [
      {
        label: "Research paths",
        href: "/research-paths",
        description: "Guided entry points through the archive.",
      },
      {
        label: "Methodology",
        href: "/about/methodology",
        description: "How the archive handles sources and uncertainty.",
      },
      {
        label: "Roadmap",
        href: "/about/roadmap",
        description: "What is planned next for the research center.",
      },
      {
        label: "Releases",
        href: "/releases",
        description: "Release notes and newly available records.",
      },
    ],
  },
];

const MOBILE_GROUPS: NavGroup[] = [
  {
    title: "Start",
    items: [
      { label: "Search", href: "/search" },
      { label: "Evidence", href: "/evidence" },
      { label: "Timeline", href: "/timeline" },
      { label: "Topics", href: "/topics" },
    ],
  },
  ...DEALEY_GROUPS,
  {
    title: "Research",
    items: [
      { label: "Entities", href: "/entities" },
      { label: "Bibliography", href: "/bibliography" },
      { label: "Research paths", href: "/research-paths" },
    ],
  },
  EXPLORE_GROUPS[1]!,
  {
    title: "Project",
    items: [
      { label: "About", href: "/about" },
      { label: "Methodology", href: "/about/methodology" },
      { label: "Editorial policy", href: "/about/editorial-policy" },
      { label: "Roadmap", href: "/about/roadmap" },
      { label: "Releases", href: "/releases" },
      { label: "Corrections", href: "/corrections" },
    ],
  },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
    setActiveMenu(null);
  }, [pathname]);

  useEffect(() => {
    if (!open && !activeMenu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setActiveMenu(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, activeMenu]);

  useEffect(() => {
    if (!activeMenu) return;
    function onPointerDown(e: PointerEvent) {
      if (!headerRef.current?.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [activeMenu]);

  /**
   * /dealey-plaza and /about only highlight on exact matches because their
   * child pages appear beside them in the same menus. Other routes use prefix
   * matching so sub-routes still keep their parent navigation destination active.
   */
  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/" &&
      href !== "/dealey-plaza" &&
      href !== "/about" &&
      pathname.startsWith(`${href}/`));

  // Uses isActive so the Dealey Plaza/About exact-match exceptions stay consistent.
  const hasActiveItem = (groups: NavGroup[]) =>
    groups.some((group) => group.items.some((item) => isActive(item.href)));

  const toggleMenu = (menu: MenuKey) => {
    setOpen(false);
    setActiveMenu((current) => (current === menu ? null : menu));
  };

  return (
    <header className={styles.header} ref={headerRef}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand} aria-label="JFK Research Center home">
          <Logo />
          <span className={styles.brandText}>
            <span className={styles.brandLine}>JFK Research Center</span>
            <span className={styles.brandSub}>Archival Study / MVP</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.navLink}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <div className={styles.navMenu}>
            <button
              type="button"
              className={styles.menuTrigger}
              aria-expanded={activeMenu === "dealey"}
              aria-controls="dealey-nav-menu"
              data-active={activeMenu === "dealey" || hasActiveItem(DEALEY_GROUPS)}
              onClick={() => toggleMenu("dealey")}
            >
              Dealey Plaza
              <ChevronIcon />
            </button>
            {activeMenu === "dealey" && (
              <DropdownMenu
                id="dealey-nav-menu"
                label="Dealey Plaza navigation"
                groups={DEALEY_GROUPS}
                isActive={isActive}
                onItemClick={() => setActiveMenu(null)}
              />
            )}
          </div>
          <div className={styles.navMenu}>
            <button
              type="button"
              className={styles.menuTrigger}
              aria-expanded={activeMenu === "explore"}
              aria-controls="explore-nav-menu"
              data-active={activeMenu === "explore" || hasActiveItem(EXPLORE_GROUPS)}
              onClick={() => toggleMenu("explore")}
            >
              Explore
              <ChevronIcon />
            </button>
            {activeMenu === "explore" && (
              <DropdownMenu
                id="explore-nav-menu"
                label="Explore site navigation"
                groups={EXPLORE_GROUPS}
                isActive={isActive}
                onItemClick={() => setActiveMenu(null)}
              />
            )}
          </div>
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
            onClick={() => {
              setActiveMenu(null);
              setOpen((v) => !v);
            }}
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
          {MOBILE_GROUPS.map((group) => (
            <div key={group.title} className={styles.mobileGroup}>
              <div className={styles.mobileGroupTitle}>{group.title}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.mobileLink}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      )}
    </header>
  );
}

function DropdownMenu({
  id,
  label,
  groups,
  isActive,
  onItemClick,
}: {
  id: string;
  label: string;
  groups: NavGroup[];
  isActive: (href: string) => boolean;
  onItemClick: () => void;
}) {
  return (
    <nav id={id} className={styles.dropdown} aria-label={label}>
      {groups.map((group) => (
        <section key={group.title} className={styles.dropdownGroup}>
          <h2 className={styles.dropdownTitle}>{group.title}</h2>
          <div className={styles.dropdownLinks}>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={styles.dropdownLink}
                aria-current={isActive(item.href) ? "page" : undefined}
                onClick={onItemClick}
              >
                <span className={styles.dropdownLabel}>{item.label}</span>
                {item.description && (
                  <span className={styles.dropdownDescription}>
                    {item.description}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </nav>
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

function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
