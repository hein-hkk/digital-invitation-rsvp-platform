"use client";

import { useState } from "react";

export function HeroImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className="mx-auto mt-12 aspect-[4/5] w-full overflow-hidden rounded-lg sm:mt-16 sm:aspect-[3/2]">
      {/* Private signed URLs are rendered directly; the frame disappears on load failure. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
