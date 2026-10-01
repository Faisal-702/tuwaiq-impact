import { NextResponse, type NextRequest } from "next/server";

const ADMIN_COOKIE = "ti_admin_session";
const ENTRY_COOKIE = "ti_entry";

/**
 * Fast, optimistic routing guard.
 *  - /admin requires an admin session cookie (the session itself is verified
 *    against the database in the admin layout and in every server action).
 *  - Public pages require an entry choice (guest or admin) made on /welcome.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasAdminCookie = Boolean(request.cookies.get(ADMIN_COOKIE)?.value);
  const hasEntry = Boolean(request.cookies.get(ENTRY_COOKIE)?.value) || hasAdminCookie;

  if (pathname.startsWith("/admin")) {
    if (!hasAdminCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/welcome";
      url.search = `?mode=admin&next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === "/welcome") return NextResponse.next();

  if (!hasEntry) {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|media|_next/static|_next/image|brand|images|icon.svg|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
