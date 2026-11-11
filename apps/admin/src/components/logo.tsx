import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-foreground" />
        <path d="M8 24V12l8-5 8 5v12h-6v-7h-4v7z" className="fill-background" />
      </svg>
      Fachada
    </span>
  );
}
