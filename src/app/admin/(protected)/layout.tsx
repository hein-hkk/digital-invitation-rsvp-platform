import { requireOrganizerSession } from "@/server/auth/session";
import { signOutOrganizer } from "@/modules/auth/actions";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireOrganizerSession();
  return (
    <div className="min-h-screen bg-page text-text">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link
          href="/admin/events"
          className="font-display text-xl font-semibold"
        >
          Events
        </Link>
        <form action={signOutOrganizer}>
          <button className="rounded border border-border-strong px-3 py-2 text-sm hover:bg-surface-subtle">
            Sign out<span className="sr-only"> of {user.email}</span>
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
