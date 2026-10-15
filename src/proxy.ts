import { NextResponse, type NextRequest } from "next/server";
import {
  createOrganizerAuthClient,
  organizerCookie,
  organizerCookieOptions,
} from "@/server/auth/client";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!request.cookies.has(organizerCookie)) return response;

  const auth = createOrganizerAuthClient({
    getItem: (key) => request.cookies.get(key)?.value ?? null,
    setItem: (key, value) => {
      request.cookies.set(key, value);
      response = NextResponse.next({ request });
      response.cookies.set(key, value, organizerCookieOptions);
    },
    removeItem: (key) => {
      request.cookies.delete(key);
      response = NextResponse.next({ request });
      response.cookies.delete(key);
    },
  });
  await auth.auth.getUser();
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
