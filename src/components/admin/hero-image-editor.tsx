"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  prepareHeroImageUploadAction,
  removeHeroImageAction,
  setHeroImageReferenceAction,
} from "@/modules/hero-image/actions";
import {
  HERO_IMAGE_BUCKET,
  HERO_IMAGE_MAX_BYTES,
  heroImageExtension,
} from "@/modules/hero-image/validation";

export function HeroImageEditor({
  eventId,
  previewUrl,
  mutable,
  supabaseUrl,
  supabaseAnonKey,
}: {
  eventId: string;
  previewUrl: string | null;
  mutable: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem(
      "heroImage",
    ) as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (
      !heroImageExtension(file.type) ||
      file.size === 0 ||
      file.size > HERO_IMAGE_MAX_BYTES
    ) {
      setMessage("Choose a JPEG, PNG, or WebP image up to 10 MiB.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const prepared = await prepareHeroImageUploadAction({
        eventId,
        fileName: file.name,
        contentType: file.type,
      });
      if (!prepared.ok) throw new Error(prepared.message);
      const browserStorage = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }).storage.from(HERO_IMAGE_BUCKET);
      const uploaded = await browserStorage.uploadToSignedUrl(
        prepared.storagePath,
        prepared.uploadToken,
        file,
        { contentType: file.type },
      );
      if (uploaded.error) throw new Error("Upload failed. Try again.");
      const finalized = await setHeroImageReferenceAction({
        eventId,
        storagePath: prepared.storagePath,
      });
      if (!finalized.ok) throw new Error(finalized.message);
      input.value = "";
      setMessage("Hero Image saved.");
      setPreviewFailed(false);
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
      const result = await removeHeroImageAction(eventId);
      if (!result.ok) throw new Error(result.message);
      setMessage("Hero Image removed.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Removal failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="hero-image-title"
      className="mt-8 rounded border border-border bg-surface p-6"
    >
      <h2 id="hero-image-title" className="font-display text-2xl">
        Hero Image
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        Optional private image for the Guest invitation. JPEG, PNG, or WebP; up
        to 10 MiB.
      </p>
      {previewUrl && !previewFailed && (
        // Signed private Storage URLs are short-lived and not handled by Next Image optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Current Hero Image"
          onError={() => setPreviewFailed(true)}
          className="mt-5 aspect-[4/5] max-h-80 w-full max-w-md rounded object-cover sm:aspect-[3/2]"
        />
      )}
      {!previewUrl && (
        <p className="mt-4 text-sm text-text-muted">No Hero Image set.</p>
      )}
      {mutable && (
        <div className="mt-5 space-y-4">
          <form onSubmit={upload} className="space-y-3">
            <label htmlFor="heroImage" className="block font-medium">
              {previewUrl ? "Replace image" : "Upload image"}
            </label>
            <input
              id="heroImage"
              name="heroImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              disabled={busy}
              className="block w-full text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-accent px-5 py-2 font-medium text-white disabled:opacity-50"
            >
              {busy ? "Working…" : "Save Hero Image"}
            </button>
          </form>
          {previewUrl && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded border border-border-strong px-5 py-2 font-medium disabled:opacity-50"
            >
              Remove Hero Image
            </button>
          )}
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
