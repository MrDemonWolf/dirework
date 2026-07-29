"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scales a fixed-size child up/down to fill its parent while preserving aspect
 * ratio. The timer widget is drawn at a fixed pixel size (config.dimensions),
 * so on a large OBS browser source it would otherwise sit tiny in the corner.
 * `offsetWidth/Height` report the pre-transform layout size, so measuring the
 * child is unaffected by the scale we apply back to it.
 */
export function AutoScale({
  children,
  margin = 0.98,
}: {
  children: React.ReactNode;
  margin?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const childRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    const child = childRef.current;
    if (!container || !child) return;

    const fit = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const w = child.offsetWidth;
      const h = child.offsetHeight;
      if (!w || !h || !cw || !ch) return;
      setScale(Math.min(cw / w, ch / h) * margin);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    observer.observe(child);
    return () => observer.disconnect();
  }, [margin]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden"
    >
      <div ref={childRef} style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
        {children}
      </div>
    </div>
  );
}
