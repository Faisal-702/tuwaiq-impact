import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, LEGACY_COOKIES, STUDENT_COOKIE } from "@/lib/routes";

/**
 * Fast, optimistic routing guard (cookie presence only).
 *  - "/" always goes to the entry page (/welcome).
 *  - /admin requires an admin session cookie.
 *  - Every other page requires a student or admin session cookie.
 * Sessions themselves are verified against the database on the server: the
 * admin layout and every admin action call requireAdmin(), and every
 * student-facing page, API route and action calls requireViewer()/getViewer().
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasAdminCookie = Boolean(request.cookies.get(ADMIN_COOKIE)?.value);
  const hasStudentCookie = Boolean(request.cookies.get(STUDENT_COOKIE)?.value);

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
  } else if (pathname === "/welcome" || hasAdminCookie || hasStudentCookie) {
    response = NextResponse.next();
  } else {
    response = toWelcome(`?next=${encodeURIComponent(pathname + search)}`);
  }

  // Remove cookies left by earlier versions (persistent cookies and the old
  // guest marker) so they cannot outlive the browser session or grant access.
  for (const name of LEGACY_COOKIES) {
    if (request.cookies.has(name)) response.cookies.delete(name);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api|media|_next/static|_next/image|brand|images|lottie|icon.svg|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
