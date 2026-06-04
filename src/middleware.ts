import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Force CF Edge to cache the rolepatch.com landing. The route already
 * has revalidate=3600 but CF was returning DYNAMIC for HTML because
 * s-maxage alone isn't enough — adding max-age + CDN-Cache-Control flips
 * the edge to HIT.
 *
 * Landing copy is fully static (no auth, no DB, no per-user variance).
 */
export function middleware(req: NextRequest) {
  if (req.method !== "GET" || req.nextUrl.pathname !== "/") {
    return NextResponse.next();
  }
  const res = NextResponse.next();
  res.headers.set(
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );
  res.headers.set(
    "CDN-Cache-Control",
    "public, s-maxage=86400, stale-while-revalidate=604800",
  );
  return res;
}

export const config = {
  matcher: "/",
};
