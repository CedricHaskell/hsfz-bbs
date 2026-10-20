import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { clientIpFromHeaders } from "./lib/client-ip";

// Best-effort read throttling per process. Persistent write limits live in SQLite.
const hits = new Map<string, { count: number; expires: number }>();

export function proxy(req: NextRequest) {
  const now = Date.now();
  for (const [key, entry] of hits) if (entry.expires <= now) hits.delete(key);
  const ip = clientIpFromHeaders(req.headers);
  if (ip !== "unknown") {
    const entry = hits.get(ip) ?? { count: 0, expires: now + 60_000 };
    entry.count++;
    if (hits.size < 10_000 || hits.has(ip)) hits.set(ip, entry);
    if (entry.count > 300) {
      return new NextResponse("请求过于频繁，请稍后再试", {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((entry.expires - now) / 1000)), "Cache-Control": "no-store" },
      });
    }
  }

  const nonce = randomBytes(16).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // KaTeX and the existing theme use inline styles.
    "img-src 'self' https: data: blob:",
    "font-src 'self' data: blob:",
    "worker-src 'self'",
    `connect-src 'self'${process.env.NODE_ENV === "development" ? " ws: wss:" : ""}`,
    "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'",
  ].join("; ");
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|uploads/|attachments/|pdf-assets/|robots.txt).*)"],
};
