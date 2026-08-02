"use client";

import { EVENT_STATUS_STYLES, labelForEventStatus } from "@/features/agenda/constants";
import type { EventStatus } from "@/features/agenda/types";
import { cn } from "@/lib/utils/cn";

import { EventStatusIcon } from "./event-icons";

/**
 * Estado del evento: color + icono + texto.
 * Nunca se comunica el estado sólo con color (§12, §29).
 */
export function EventStatusBadge({
  status,
  size = "md",
  className,
}: {
  status: EventStatus | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const style = status ? EVENT_STATUS_STYLES[status] : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs",
        style?.badge ?? "bg-zinc-100 text-zinc-700 ring-zinc-600/20",
        className,
      )}
    >
      <EventStatusIcon status={status} className={size === "sm" ? "size-3" : "size-3.5"} />
      {labelForEventStatus(status)}
    </span>
  );
}

/** Punto de color del estado, para vistas muy compactas. Siempre acompañado de texto. */
export function EventStatusDot({
  status,
  className,
}: {
  status: EventStatus | null;
  className?: string;
}) {
  const style = status ? EVENT_STATUS_STYLES[status] : null;
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        style?.dot ?? "bg-zinc-400",
        className,
      )}
      aria-hidden="true"
    />
  );
}
