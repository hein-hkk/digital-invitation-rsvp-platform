"use client";

import { useState } from "react";

export function HeroImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className="wedding-photo" data-reveal="photo">
      <div className="wedding-photo__frame">
        {/* Private signed URLs are rendered directly; the frame disappears on load failure. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" onError={() => setFailed(true)} />
      </div>
    </div>
  );
}
