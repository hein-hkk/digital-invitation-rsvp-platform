"use client";

import { useState } from "react";

export function CopyInvitationLink({ url }: { url: string }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Invitation link copied");
    } catch {
      setMessage("Copy failed. Select and copy the link below.");
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          aria-label="Current personalized Invitation URL"
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded border border-border-strong bg-surface px-3 py-2"
        />
        <button
          type="button"
          onClick={copy}
          className="min-h-11 rounded bg-accent px-5 py-2 font-medium text-white"
        >
          Copy Link
        </button>
      </div>
      <p role="status" className="text-sm text-text-muted">
        {message}
      </p>
    </div>
  );
}
