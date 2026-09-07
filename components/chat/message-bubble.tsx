"use client";

import { AlertTriangle } from "lucide-react";

import type { InboxMessage } from "@/features/inbox/types";
import { formatEventTime } from "@/lib/dates";
import { cn } from "@/lib/utils/cn";

const SENDER_LABEL: Record<InboxMessage["sender_type"], string> = {
  contact: "",
  bot: "Asistente",
  agent: "Asesor",
};

export function MessageBubble({ message, timeZone }: { message: InboxMessage; timeZone: string }) {
  if (message.direction === "system") {
    return (
      <p className="my-2 text-center text-xs text-[var(--text-muted)]">{message.content}</p>
    );
  }

  const isInbound = message.direction === "inbound";
  const failed = message.status === "failed";

  return (
    <div className={cn("flex", isInbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm sm:max-w-[70%]",
          isInbound
            ? "rounded-bl-sm bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : message.sender_type === "bot"
              ? "rounded-br-sm bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50"
              : "rounded-br-sm bg-brand-600 text-white",
        )}
      >
        {!isInbound && SENDER_LABEL[message.sender_type] ? (
          <p className="mb-0.5 text-[11px] font-medium opacity-80">
            {SENDER_LABEL[message.sender_type]}
          </p>
        ) : null}

        <p className="whitespace-pre-wrap break-words">{message.content}</p>

        <p
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[11px]",
            isInbound || message.sender_type === "bot" ? "text-[var(--text-muted)]" : "text-white/75",
          )}
        >
          {/* Solo se marca el fallo: `sent` nunca avanza a entregado o leído
              porque no hay webhook de estados de YCloud. */}
          {failed ? (
            <span className="flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-3" aria-hidden />
              No entregado
            </span>
          ) : null}
          <time dateTime={message.created_at}>{formatEventTime(message.created_at, timeZone)}</time>
        </p>
      </div>
    </div>
  );
}
