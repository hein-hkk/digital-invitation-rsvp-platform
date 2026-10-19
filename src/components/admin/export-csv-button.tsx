"use client";

import { useState } from "react";

export function ExportCsvButton({ eventId }: { eventId: string }) {
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState(false);

  async function download() {
    setPreparing(true);
    setError(false);
    try {
      const response = await fetch(`/admin/events/${eventId}/export.csv`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Export failed");
      const filename =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([a-z0-9-]+\.csv)"/u)?.[1] ?? "event-rsvp.csv";
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setError(true);
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={preparing}
        onClick={download}
        className="min-h-11 rounded border border-border-strong px-4 py-2 font-medium disabled:opacity-60"
      >
        Export CSV
      </button>
      {preparing && <p role="status">Preparing export…</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          We couldn&apos;t export the CSV. Please try again.
        </p>
      )}
    </div>
  );
}
