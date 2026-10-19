import { NextResponse, type NextRequest } from "next/server";
import {
  createOrganizerAuthClient,
  organizerCookie,
  organizerCookieOptions,
} from "@/server/auth/client";
import { allowGuestInvitationRead } from "@/server/rate-limit";

function privateGuestFailure(status: 429 | 503, csp: string) {
  return new NextResponse(
    status === 429
      ? "Too many requests. Try again later."
      : "Invitation temporarily unavailable.",
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": csp,
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
      },
    },
  );
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDevelopment = process.env.NODE_ENV === "development";
  const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'${isDevelopment ? " 'unsafe-inline'" : ""}`,
    `img-src 'self' ${supabaseOrigin} blob: data:`,
    "font-src 'self'",
    `connect-src 'self' ${supabaseOrigin}${isDevelopment ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  if (/^\/i\/[^/]+$/.test(request.nextUrl.pathname)) {
    let allowed: boolean;
    try {
      allowed = await allowGuestInvitationRead(
        request.nextUrl.pathname.slice(3),
        request.headers,
      );
    } catch {
      return privateGuestFailure(503, csp);
    }
    if (!allowed) {
      return privateGuestFailure(429, csp);
    }
  }
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  if (
    (request.nextUrl.pathname !== "/admin" &&
      !request.nextUrl.pathname.startsWith("/admin/")) ||
    !request.cookies.has(organizerCookie)
  ) {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const auth = createOrganizerAuthClient({
    getItem: (key) => request.cookies.get(key)?.value ?? null,
    setItem: (key, value) => {
      request.cookies.set(key, value);
      requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
      response = NextResponse.next({ request: { headers: requestHeaders } });
      response.cookies.set(key, value, organizerCookieOptions);
    },
    removeItem: (key) => {
      request.cookies.delete(key);
      requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
      response = NextResponse.next({ request: { headers: requestHeaders } });
      response.cookies.delete(key);
    },
  });
  await auth.auth.getUser();
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
