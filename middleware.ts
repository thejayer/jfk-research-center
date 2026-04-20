import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionValue } from "@/lib/admin-auth";

// Gate /admin/* on a valid session cookie. /admin/login is excluded so the
// user can reach it unauthenticated; /api/admin/login is similarly excluded.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
