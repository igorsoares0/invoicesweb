import Link from "next/link";
import { Button } from "@/components/ui/button";
import { withSearchParams } from "@/lib/url";

export function Pagination({
  pathname,
  searchParams,
  page,
  limit,
  total,
}: {
  pathname: string;
  searchParams: Record<string, string | undefined>;
  page: number;
  limit: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  const href = (target: number) => withSearchParams(pathname, searchParams, { page: target === 1 ? null : target });
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t px-4 py-3 text-[13px]">
      <span className="text-muted-foreground">
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page - 1)}>Previous</Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page + 1)}>Next</Link>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
