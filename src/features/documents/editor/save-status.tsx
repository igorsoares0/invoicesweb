"use client";

import { useEffect, useState } from "react";
import type { SaveStatus } from "./use-document-draft";

function ago(savedAt: number, now: number) {
  const seconds = Math.max(1, Math.round((now - savedAt) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes}m ago` : "a while ago";
}

export function SaveStatusText({ status, savedAt }: { status: SaveStatus; savedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  const text =
    status === "saving"
      ? "Saving…"
      : status === "pending"
        ? "Unsaved changes"
        : status === "invalid"
          ? "Fix the highlighted fields to save"
          : status === "error"
            ? "Couldn't save — retrying"
            : savedAt
              ? `Saved ${ago(savedAt, now)}`
              : "Draft created · number assigned";

  return (
    <span
      role="status"
      data-status={status}
      className={status === "invalid" || status === "error" ? "text-destructive" : "text-muted-foreground"}
    >
      {text}
    </span>
  );
}
