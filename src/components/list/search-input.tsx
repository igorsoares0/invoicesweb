"use client";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { withSearchParams } from "@/lib/url";

/** Search box bound to `?q=`. Typing updates the URL after a short pause and resets pagination. */
export function SearchInput({ placeholder = "Search", label }: { placeholder?: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlValue = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlValue);
  const lastPushed = useRef(urlValue);

  useEffect(() => {
    if (value === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = value;
      router.replace(withSearchParams(pathname, searchParams, { q: value.trim(), page: null }), { scroll: false });
    }, 250);
    return () => clearTimeout(timer);
  }, [value, pathname, router, searchParams]);

  return (
    <div className="relative w-full sm:max-w-[310px]">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-2" />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="pl-9"
      />
    </div>
  );
}
