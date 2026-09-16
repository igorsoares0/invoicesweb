"use client";

import { toast } from "sonner";
import { DetailCard } from "./detail-card";

/** Copy · Open · Revoke for a document's public link, or a way to issue a new one after a revoke. */
export function PublicLinkCard({
  path,
  busy,
  onRevoke,
  onCreate,
}: {
  path: string | null;
  busy: boolean;
  onRevoke: () => void;
  onCreate: () => void;
}) {
  return (
    <DetailCard title="Public link">
      <div className="px-4 pt-2 pb-4 text-[13.5px]">
        {path ? (
          <>
            <a
              href={path}
              target="_blank"
              rel="noreferrer"
              className="block truncate font-mono text-[12.5px] text-primary"
              data-testid="public-link"
            >
              {path}
            </a>
            <div className="mt-2 flex gap-3 text-muted-foreground">
              <button
                type="button"
                className="hover:text-foreground"
                onClick={async () => {
                  await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
                  toast.success("Link copied");
                }}
              >
                Copy
              </button>
              <a href={path} target="_blank" rel="noreferrer" className="hover:text-foreground">
                Open
              </a>
              <button type="button" disabled={busy} className="hover:text-destructive" onClick={onRevoke}>
                Revoke
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">The link was revoked. Anyone who opens the old one sees that it no longer works.</p>
            <button type="button" disabled={busy} className="mt-2 font-semibold text-primary" onClick={onCreate}>
              Create a new link
            </button>
          </>
        )}
      </div>
    </DetailCard>
  );
}
