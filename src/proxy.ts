import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, ENTRY_COOKIE, LEGACY_COOKIES } from "@/lib/routes";

/**
 * Fast, optimistic routing guard.
 *  - "/" always goes to the entry page (/welcome).
 *  - /admin requires an admin session cookie (the session itself is verified
 *    against the database in the admin layout and in every server action).
 *  - Public pages require an entry choice (guest or admin) made on /welcome
 *    during the current browser session.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasAdminCookie = Boolean(request.cookies.get(ADMIN_COOKIE)?.value);
  const hasEntry = Boolean(request.cookies.get(ENTRY_COOKIE)?.value) || hasAdminCookie;

  const toWelcome = (query: string) => {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    url.search = query;
    return NextResponse.redirect(url);
  };

  let response: NextResponse;
  if (pathname === "/") {
    response = toWelcome("");
  } else if (pathname.startsWith("/admin")) {
    response = hasAdminCookie
      ? NextResponse.next()
      : toWelcome(`?mode=admin&next=${encodeURIComponent(pathname + search)}`);
  } else if (pathname === "/welcome" || hasEntry) {
    response = NextResponse.next();
  } else {
    response = toWelcome(`?next=${encodeURIComponent(pathname + search)}`);
  }

  // Remove persistent cookies left by earlier versions so they cannot outlive
  // the browser session.
  for (const name of LEGACY_COOKIES) {
    if (request.cookies.has(name)) response.cookies.delete(name);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api|media|_next/static|_next/image|brand|images|icon.svg|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
