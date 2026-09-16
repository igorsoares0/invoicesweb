import { ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import * as React from "react";

/** Native <select> styled like Input. Preferred for long option lists (countries, currencies) and on phones. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "h-[38px] w-full min-w-0 appearance-none rounded-md border border-input bg-card py-1 pr-8 pl-3 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/12 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/10 md:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-2"
      />
    </div>
  );
}

export { NativeSelect };
