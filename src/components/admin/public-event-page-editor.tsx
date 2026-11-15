"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  preparePublicCoverUploadAction,
  removePublicCoverAction,
  savePublicEventSettingsAction,
  setPublicCoverReferenceAction,
} from "@/modules/public-event/actions";
import {
  PUBLIC_COVER_BUCKET,
  PUBLIC_COVER_MAX_BYTES,
  heroImageExtension,
} from "@/modules/public-event/validation";

export function PublicEventPageEditor({
  eventId,
  publicPageId,
  initiallyEnabled,
  initialAnnouncement,
  coverPreviewUrl,
  runtimeState,
  supabaseUrl,
  supabaseAnonKey,
}: {
  eventId: string;
  publicPageId: string;
  initiallyEnabled: boolean;
  initialAnnouncement: string | null;
  coverPreviewUrl: string | null;
  runtimeState: "draft" | "published" | "ended";
  supabaseUrl: string;
  supabaseAnonKey: string;
}) {
  const router = useRouter();
  const [announcement, setAnnouncement] = useState(initialAnnouncement ?? "");
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const mutable = runtimeState !== "ended";
  const publicPath = `/events/${publicPageId}`;

  async function save(targetEnabled: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await savePublicEventSettingsAction({
        eventId,
        enabled: targetEnabled,
        announcement,
      });
      if (!result.ok) throw new Error(result.message);
      setEnabled(targetEnabled);
      setMessage(
        targetEnabled
          ? "Public page settings saved."
          : "Public page is off. Settings saved.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save public page settings.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem(
      "publicCover",
    ) as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (
      !heroImageExtension(file.type) ||
      file.size === 0 ||
      file.size > PUBLIC_COVER_MAX_BYTES
    ) {
      setMessage("Choose a JPEG, PNG, or WebP image up to 10 MiB.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const prepared = await preparePublicCoverUploadAction({
        eventId,
        fileName: file.name,
        contentType: file.type,
      });
      if (!prepared.ok) throw new Error(prepared.message);
      const browserStorage = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }).storage.from(PUBLIC_COVER_BUCKET);
      const uploaded = await browserStorage.uploadToSignedUrl(
        prepared.storagePath,
        prepared.uploadToken,
        file,
        { contentType: file.type },
      );
      if (uploaded.error) throw new Error("Upload failed. Try again.");
      const finalized = await setPublicCoverReferenceAction({
        eventId,
        storagePath: prepared.storagePath,
      });
      if (!finalized.ok) throw new Error(finalized.message);
      input.value = "";
      setPreviewFailed(false);
      setMessage("Public cover saved.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Upload failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await removePublicCoverAction(eventId);
      if (!result.ok) throw new Error(result.message);
      setMessage("Public cover removed.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Removal failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        new URL(publicPath, window.location.origin).toString(),
      );
      setMessage("Public link copied.");
    } catch {
      setMessage(
        "Could not copy the link. Open the page and copy its address.",
      );
    }
  }

  function confirmEnable() {
    if (
      window.confirm(
        "Make this Event page available to anyone with its public link? The Venue Name and Address will be visible. Confirm the announcement and cover contain only information you want to share.",
      )
    )
      void save(true);
  }

  return (
    <section
      aria-labelledby="public-page-title"
      className="mt-8 rounded border border-border bg-surface p-6"
    >
      <h2 id="public-page-title" className="font-display text-2xl">
        Public Event Page
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        Share a Save the Date page without sharing an Invitation link. Anyone
        with the public URL can see the Event title, hosts, date, time, Venue
        Name, Venue Address, public announcement, and public cover. Map URL,
        arrival notes, personal Invitation details, and RSVP stay private.
      </p>
      <p className="mt-3 text-sm font-medium">
        Status:{" "}
        {runtimeState === "ended"
          ? "Unavailable after Event end"
          : enabled
            ? "On"
            : "Off"}
      </p>

      <div className="mt-5">
        <label htmlFor="publicAnnouncement" className="block font-medium">
          Public announcement{" "}
          <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <textarea
          id="publicAnnouncement"
          value={announcement}
          onChange={(event) => setAnnouncement(event.target.value)}
          disabled={!mutable || busy || !hydrated}
          rows={4}
          className="mt-2 w-full rounded border border-border-strong bg-surface px-3 py-2"
        />
        <p className="mt-1 text-xs text-text-muted">
          Write only information you want anyone with the public URL to read.
        </p>
      </div>

      {coverPreviewUrl && !previewFailed && (
        // Private Storage signed URL is for authenticated Owner preview only.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverPreviewUrl}
          alt="Current public cover"
          onError={() => setPreviewFailed(true)}
          className="mt-5 aspect-[4/5] max-h-80 w-full max-w-md rounded object-cover sm:aspect-[3/2]"
        />
      )}
      {!coverPreviewUrl && (
        <p className="mt-5 text-sm text-text-muted">No public cover set.</p>
      )}
      <p className="mt-2 text-xs text-text-muted">
        The public cover is separate from the private Hero Image. JPEG, PNG, or
        WebP; up to 10 MiB.
      </p>

      {mutable && (
        <div className="mt-5 space-y-4">
          <form onSubmit={upload} className="space-y-3">
            <label htmlFor="publicCover" className="block font-medium">
              {coverPreviewUrl ? "Replace public cover" : "Upload public cover"}
            </label>
            <input
              id="publicCover"
              name="publicCover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              disabled={busy || !hydrated}
              className="block w-full text-sm"
            />
            <button
              type="submit"
              disabled={busy || !hydrated}
              className="rounded bg-accent px-5 py-2 font-medium text-white disabled:opacity-50"
            >
              {busy ? "Working…" : "Save Public Cover"}
            </button>
          </form>
          {coverPreviewUrl && (
            <button
              type="button"
              onClick={remove}
              disabled={busy || !hydrated}
              className="rounded border border-border-strong px-5 py-2 font-medium disabled:opacity-50"
            >
              Remove Public Cover
            </button>
          )}
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={() => save(enabled)}
              disabled={busy || !hydrated}
              className="rounded border border-border-strong px-5 py-2 font-medium disabled:opacity-50"
            >
              Save Announcement
            </button>
            {runtimeState === "published" && !enabled && (
              <button
                type="button"
                onClick={confirmEnable}
                disabled={busy || !hydrated}
                className="rounded bg-accent px-5 py-2 font-medium text-white disabled:opacity-50"
              >
                Enable Public Page
              </button>
            )}
            {runtimeState === "published" && enabled && (
              <button
                type="button"
                onClick={() => save(false)}
                disabled={busy || !hydrated}
                className="rounded border border-border-strong px-5 py-2 font-medium disabled:opacity-50"
              >
                Disable Public Page
              </button>
            )}
            {runtimeState === "published" && (
              <a
                href={`/admin/events/${eventId}/public-preview`}
                className="font-medium text-accent underline underline-offset-4"
              >
                Preview Public Page
              </a>
            )}
          </div>
          <p className="text-xs text-text-muted">
            Save the announcement and cover before previewing.
          </p>
        </div>
      )}
      {runtimeState === "draft" && (
        <p className="mt-4 text-sm text-text-muted">
          Publish the Event to preview or enable its public page.
        </p>
      )}
      {runtimeState === "published" && enabled && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a
            href={publicPath}
            className="font-medium text-accent underline underline-offset-4"
          >
            Open Public Page
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="rounded border border-border-strong px-4 py-2 font-medium"
          >
            Copy Public Link
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
