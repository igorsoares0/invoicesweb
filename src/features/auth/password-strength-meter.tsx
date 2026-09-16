import { cn } from "cn";
import { measurePassword } from "./password-strength";

const SEGMENT_COLORS = ["", "bg-destructive", "bg-warning", "bg-success", "bg-success"];

export function PasswordStrengthMeter({ password, id }: { password: string; id?: string }) {
  const { score, label } = measurePassword(password);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            data-filled={segment <= score}
            className={cn("h-1 rounded-full bg-border", segment <= score && SEGMENT_COLORS[score])}
          />
        ))}
      </div>
      <p id={id} className="text-[12.5px] text-muted-foreground" aria-live="polite">
        {label}
      </p>
    </div>
  );
}
