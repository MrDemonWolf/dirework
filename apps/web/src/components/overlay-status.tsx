"use client";

import { useEffect, useState } from "react";

// Shown in overlays only while there is no data to render. Kept deliberately
// quiet so a brief reconnect never flashes loud UI on stream — but a streamer
// setting up a browser source with a bad URL gets a clear hint.
export function OverlayStatus({ error }: { error?: boolean }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, []);

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-transparent">
        <p className="rounded-lg bg-black/50 px-3 py-1.5 font-sans text-sm text-white/80">
          DireWork overlay can&apos;t connect — retrying…
        </p>
      </div>
    );
  }

  if (slow) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-transparent">
        <p className="rounded-lg bg-black/50 px-3 py-1.5 font-sans text-sm text-white/80">
          Still connecting… double-check the overlay URL in your DireWork dashboard
        </p>
      </div>
    );
  }

  return null;
}
