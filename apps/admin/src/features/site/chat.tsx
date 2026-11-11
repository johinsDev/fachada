import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, FileCode2, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { API_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Pon el fondo del encabezado oscuro y el texto en blanco",
  "Agrega una sección de preguntas frecuentes sobre el subsidio",
  "Cambia el título principal por algo más cálido",
];

/** The files the agent wrote or deleted in one assistant message. */
function touchedFiles(message: UIMessage): string[] {
  const files = new Set<string>();
  for (const part of message.parts) {
    if (!part.type.startsWith("tool-")) continue;
    const name = part.type.slice(5);
    const input = (part as { input?: { path?: string } }).input;
    if ((name === "writeFile" || name === "deleteFile") && input?.path) files.add(input.path);
  }
  return [...files];
}

function isWorking(message: UIMessage): string | null {
  const last = message.parts.at(-1);
  if (!last?.type.startsWith("tool-")) return null;
  const state = (last as { state?: string }).state;
  if (state === "output-available" || state === "output-error") return null;
  const name = last.type.slice(5);
  return name === "checkBuild"
    ? "Revisando que el sitio compile…"
    : name === "writeFile"
      ? "Escribiendo…"
      : "Leyendo el sitio…";
}

export function SiteChat({
  initialMessages,
  onTurnEnd,
}: {
  initialMessages: UIMessage[];
  onTurnEnd: () => void;
}) {
  const [input, setInput] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: `${API_URL}/site/chat`, credentials: "include" }),
    onFinish: onTurnEnd,
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    // scrollIntoView returns a Promise in recent browsers; an effect must not return it.
    void bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send(text: string) {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3 pt-6 text-center">
            <Sparkles className="text-muted-foreground mx-auto size-6" />
            <p className="text-sm font-medium">Pide un cambio y míralo en el preview</p>
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="hover:bg-muted w-full rounded-lg border px-3 py-2 text-left text-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => {
          const text = message.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { text: string }).text)
            .join("");
          const files = message.role === "assistant" ? touchedFiles(message) : [];
          const working =
            message.role === "assistant" && busy && message === messages.at(-1)
              ? isWorking(message)
              : null;
          return (
            <div
              key={message.id}
              className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm",
                  message.role === "user" ? "bg-foreground text-background" : "bg-muted",
                )}
              >
                {text && <p className="whitespace-pre-wrap">{text}</p>}
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t pt-2">
                    {files.map((f) => (
                      <li
                        key={f}
                        className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs"
                      >
                        <FileCode2 className="size-3" /> {f}
                      </li>
                    ))}
                  </ul>
                )}
                {working && (
                  <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                    <Loader2 className="size-3 animate-spin" /> {working}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {status === "submitted" && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Pensando…
          </p>
        )}
        {error && (
          <p className="text-destructive text-sm">
            No se pudo completar el cambio. Intenta de nuevo.
          </p>
        )}
        <div ref={bottom} />
      </div>
      <form
        className="border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={3}
            placeholder="Describe el cambio que quieres en tu sitio…"
            className="resize-none pr-12"
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-2 bottom-2 size-8"
            disabled={busy || !input.trim()}
            aria-label="Enviar"
          >
            <ArrowUp />
          </Button>
        </div>
      </form>
    </div>
  );
}
