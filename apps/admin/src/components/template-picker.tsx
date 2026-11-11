import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type TemplateId = "galias" | "pro";

export const TEMPLATES: { id: TemplateId; name: string; description: string }[] = [
  {
    id: "pro",
    name: "Pro",
    description: "Editorial y moderna: fotos grandes, animaciones al hacer scroll.",
  },
  {
    id: "galias",
    name: "Galias",
    description: "Catálogo clásico con filtro por ciudad y ficha de proyecto completa.",
  },
];

/** A tiny CSS mock of each template, so the picker needs no screenshots. */
function Thumb({ id }: { id: TemplateId }) {
  return id === "pro" ? (
    <div className="flex h-24 flex-col justify-end gap-1 rounded-md bg-[#16140f] p-2">
      <div className="h-2 w-3/4 rounded-sm bg-[#f7f4ef]" />
      <div className="h-2 w-1/2 rounded-sm bg-[#b0894f]" />
      <div className="mt-1 h-2 w-8 rounded-full bg-[#f7f4ef]" />
    </div>
  ) : (
    <div className="flex h-24 flex-col gap-1 rounded-md bg-[#f6f6f7] p-2">
      <div className="h-2 w-2/3 rounded-sm bg-[#1a1d21]" />
      <div className="mt-auto grid grid-cols-3 gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 rounded-sm border border-[#e7e9ec] bg-white">
            <div className="h-4 rounded-t-sm bg-[#e7e9ec]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TemplatePicker({
  value,
  onChange,
}: {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Plantilla">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "relative rounded-xl border p-2 text-left transition",
            value === t.id
              ? "border-foreground ring-foreground ring-1"
              : "hover:border-foreground/40",
          )}
        >
          <Thumb id={t.id} />
          <p className="mt-2 text-sm font-medium">{t.name}</p>
          <p className="text-muted-foreground text-xs leading-snug">{t.description}</p>
          {value === t.id && (
            <span className="bg-foreground text-background absolute top-3 right-3 grid size-5 place-items-center rounded-full">
              <Check className="size-3" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
