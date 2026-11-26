import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySignedSessionToken } from "./lib/security";
import { AUTH_COOKIE_NAME } from "./lib/auth-session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static / Next.js internal paths are ignored
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Get auth cookie
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = sessionCookie
    ? await verifySignedSessionToken(decodeURIComponent(sessionCookie))
    : null;

  const isLoginPage = pathname === "/login";

  // 1. If not authenticated and trying to access a protected route
  if (!session) {
    if (isLoginPage) {
      return NextResponse.next();
    }
    const redirectUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      redirectUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // 2. If authenticated and accessing /login, redirect to /dashboard
  if (isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If visiting root '/', redirect to /dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 3. If Staff, enforce URL-level page permissions
  if (session.role === "staff") {
    let cleanPath = pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
    if (cleanPath.startsWith("reports/")) {
      cleanPath = `report-${cleanPath.replace("reports/", "")}`;
    }

    // Staff cannot access /staff page (admin only)
    if (cleanPath === "staff") {
      return NextResponse.redirect(new URL("/dashboard?denied=1", request.url));
    }

    // Check staff permissions
    const permissions = session.permissions || {};
    const hasPermission =
      permissions[cleanPath] === "view" ||
      permissions[cleanPath] === "view_edit";

    // Dashboard is usually allowed, but if not even dashboard is in permissions, check
    if (!hasPermission && cleanPath !== "dashboard") {
      // Find staff's first permitted page
      const permittedPages = Object.keys(permissions).filter(
        (k) => permissions[k] === "view" || permissions[k] === "view_edit"
      );
      const fallback =
        permittedPages.length > 0
          ? `/${permittedPages[0].replace("report-", "reports/")}`
          : "/dashboard";

      if (pathname !== fallback) {
        return NextResponse.redirect(new URL(`${fallback}?denied=1`, request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - static image formats
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
