import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionValue } from "@/lib/admin-auth";
import {
  isBlockedCrawlerUserAgent,
  isCostSensitivePath,
} from "@/lib/cost-controls";

// Gate /admin/* on a valid session cookie. /admin/login is excluded so the
// user can reach it unauthenticated; /api/admin/login is similarly excluded.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Emergency cost-control gate: known crawlers get an intentional 403
  // NextResponse before they can trigger expensive search/document work.
  if (
    isCostSensitivePath(pathname) &&
    isBlockedCrawlerUserAgent(req.headers.get("user-agent"))
  ) {
    return new NextResponse("crawler access disabled for cost control", {
      status: 403,
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  }

  const isAdmin = pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin/");
  if (!isAdmin) return NextResponse.next();

  const isLogin =
    pathname === "/admin/login" ||
    pathname === "/api/admin/login";

  if (isLogin) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE_NAME);
  if (!(await verifySessionValue(cookie?.value))) {
    // For API routes, return 401 JSON so the client can react.
    if (pathname.startsWith("/api/admin/")) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 },
      );
    }
    // For pages, bounce to login with a return-to hint.
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/search/:path*",
    "/api/search/:path*",
    "/document/:path*",
    "/api/document/:path*",
    "/compare/:path*",
    "/api/compare/:path*",
  ],
};
