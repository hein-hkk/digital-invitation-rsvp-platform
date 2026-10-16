import Link from "next/link";

export default function EventsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Your Events</h1>
      <p className="mt-4 text-text-muted">Create and manage your Events.</p>
      <Link
        href="/admin/events"
        className="mt-6 inline-block rounded bg-accent px-4 py-2 font-medium text-white"
      >
        View Events
      </Link>
    </main>
  );
}
