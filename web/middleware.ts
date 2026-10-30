import { NextRequest, NextResponse } from "next/server";

// Permissive CORS for the extension (chrome-extension://*) and local dev pages.
// The extension itself calls through its background worker, so this is belt-and-braces.
function allowed(origin: string | null) {
  return !!origin && (origin.startsWith("chrome-extension://") || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = { Vary: "Origin" };
  if (allowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin!;
    headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }
  if (req.method === "OPTIONS") return new NextResponse(null, { status: 204, headers });
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: "/api/:path*" };
