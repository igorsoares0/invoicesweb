"use client";

import { cn } from "cn";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const DOCUMENT_WIDTH = 620;

/**
 * Scales a 620px document to the width of its container with CSS `zoom`, which (unlike a
 * transform) also scales the layout box, so nothing below it overlaps.
 */
export function FittedDocument({
  children,
  className,
  maxZoom = 2,
}: {
  children: ReactNode;
  className?: string;
  maxZoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => setZoom(Math.min(maxZoom, element.clientWidth / DOCUMENT_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [maxZoom]);

  return (
    <div ref={containerRef} className={cn("w-full overflow-hidden", className)}>
      <div className="fitted-document" style={{ zoom: zoom ?? undefined, visibility: zoom === null ? "hidden" : undefined }}>
        {children}
      </div>
    </div>
  );
}
