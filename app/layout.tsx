import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "@/components/layout/shell";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "JFK Research Center",
    template: "%s · JFK Research Center",
  },
  description:
    "An editorial archive for researching the assassination of President John F. Kennedy, built on records from the U.S. National Archives Catalog.",
  metadataBase: new URL("https://jfk-research-center.local"),
  openGraph: {
    title: "JFK Research Center",
    description:
      "Search, browse, and read primary-source records related to the assassination of President John F. Kennedy.",
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

const themeInitScript = `
  (function() {
    try {
      var stored = localStorage.getItem('jfkrc-theme');
      var sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      var theme = stored || sys;
      document.documentElement.setAttribute('data-theme', theme);
    } catch (_) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin=""
        />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,400&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
