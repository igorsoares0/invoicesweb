import { CheckIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Wordmark } from "@/components/brand/logo";
import { userService } from "@/server/services/user-service";

const PROMISES = [
  ["Pick a client, add lines, send", "The whole flow is one screen with a live preview."],
  ["Estimates that turn into invoices", "One click, prices locked, nothing retyped."],
  ["You own the PDF", "Download it any time, even after you cancel."],
] as const;

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (session?.user?.id && (await userService.getById(session.user.id))) redirect("/overview");

  return (
    <div className="grid min-h-dvh bg-card lg:grid-cols-[minmax(0,470px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,660px)_minmax(0,1fr)]">
      <aside className="hidden flex-col gap-10 border-r bg-background px-12 py-12 lg:flex">
        <Wordmark />
        <div className="flex flex-col gap-4">
          <h1 className="max-w-md text-[26px] leading-[1.25] font-semibold tracking-[-0.01em]">
            Send your first invoice in the next five minutes.
          </h1>
          <p className="max-w-md text-[15px] text-muted-foreground">
            No card to start. 14 days of Pro, then free forever — three invoices a month.
          </p>
        </div>
        <ul className="flex flex-col gap-4">
          {PROMISES.map(([title, body]) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-tint-2 text-primary">
                <CheckIcon className="size-3" strokeWidth={3} />
              </span>
              <span>
                <span className="block font-medium">{title}</span>
                <span className="block text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-auto rounded-lg border bg-card px-5 py-4 shadow-card" aria-hidden>
          <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.04em] text-muted-2 uppercase">
            <span>Invoice preview</span>
            <span className="font-mono font-normal tracking-normal normal-case">INV-0001</span>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-bold">$2,400.00</span>
            <span className="text-[13px] text-muted-foreground">due in 14 days</span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <span className="h-1.5 rounded-full bg-divider" />
            <span className="h-1.5 w-3/4 rounded-full bg-divider" />
            <span className="h-1.5 w-1/2 rounded-full bg-divider" />
          </div>
        </div>
      </aside>
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[352px]">
          <div className="mb-8 lg:hidden">
            <Wordmark />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
