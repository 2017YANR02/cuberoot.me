import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionEdge } from "@/lib/session-edge";
import { USER_COOKIE, verifyUserTokenEdge } from "@/lib/auth-user-edge";

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const ok = await verifySessionEdge(token);
    if (ok) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/instructor")) {
    const token = req.cookies.get(USER_COOKIE)?.value;
    const userId = await verifyUserTokenEdge(token);
    if (userId) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/instructor/:path*"],
};
