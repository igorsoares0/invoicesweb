import type { ReactNode } from "react";

export function SettingsCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-20 rounded-lg border bg-card px-5 py-5 shadow-card sm:px-7 sm:py-6"
    >
      <h2 id={`${id}-title`} className="text-[17px] font-semibold">
        {title}
      </h2>
      <p className="mt-0.5 mb-5 text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}
