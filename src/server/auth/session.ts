import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createOrganizerAuthClient, organizerCookieOptions } from "./client";

export async function createActionAuthClient() {
  const jar = await cookies();
  return createOrganizerAuthClient({
    getItem: (key) => jar.get(key)?.value ?? null,
    setItem: (key, value) => {
      jar.set(key, value, organizerCookieOptions);
    },
    removeItem: (key) => {
      jar.delete(key);
    },
  });
}

export async function resolveOrganizerSession() {
  const jar = await cookies();
  const auth = createOrganizerAuthClient({
    getItem: (key) => jar.get(key)?.value ?? null,
    // Server Components cannot write cookies. The Proxy refreshes before render.
    setItem: () => {},
    removeItem: () => {},
  });
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) return null;
  const session = await auth.auth.getSession();
  if (!session.data.session) return null;
  return { user: data.user, accessToken: session.data.session.access_token };
}

export async function requireOrganizerSession() {
  const session = await resolveOrganizerSession();
  if (!session) redirect("/admin/sign-in");
  return session;
}
