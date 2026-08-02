"use client";

import { AlertTriangle } from "lucide-react";

import { EVENT_STATUS_STYLES, EVENT_TYPE_STYLES, labelForEventStatus, labelForEventType } from "@/features/agenda/constants";
import type { AgendaEvent } from "@/features/agenda/types";
import { formatEventTime, formatEventTimeRange } from "@/lib/dates";
import { cn } from "@/lib/utils/cn";

import { EventTypeIcon } from "./event-type-badge";

/**
 * Representación compacta de un evento dentro del calendario.
 *
 * Muestra hora, título, tipo, estado y —cuando el rol puede ver varias
 * agendas— el asesor. Los eventos cancelados se distinguen además con
 * tachado, no sólo con color (§29).
 */
export function EventChip({
  event,
  timezone,
  showAdvisor = false,
  variant = "block",
  hasConflict = false,
  onSelect,
  className,
  style,
}: {
  event: AgendaEvent;
  timezone: string;
  showAdvisor?: boolean;
  variant?: "block" | "row";
  hasConflict?: boolean;
  onSelect: (event: AgendaEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const typeStyle = event.eventType ? EVENT_TYPE_STYLES[event.eventType] : null;
  const statusStyle = event.status ? EVENT_STATUS_STYLES[event.status] : null;
  const isCancelled = event.status === "CANCELLED" || event.status === "NO_SHOW";

  const timeLabel =
    variant === "row"
      ? formatEventTimeRange(event.startAt, event.endAt, timezone)
      : formatEventTime(event.startAt, timezone);

  const accessibleLabel = [
    labelForEventType(event.eventType),
    event.title,
    formatEventTimeRange(event.startAt, event.endAt, timezone),
    labelForEventStatus(event.status),
    event.advisor?.name ? `Asesor ${event.advisor.name}` : null,
    event.client?.name ? `Cliente ${event.client.name}` : null,
    hasConflict ? "Se solapa con otro evento" : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onSelect(event);
      }}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      style={style}
      className={cn(
        "group flex w-full min-w-0 gap-1.5 overflow-hidden rounded-md border px-1.5 py-1 text-left text-xs transition-shadow hover:shadow-sm focus-visible:z-10",
        typeStyle?.chip ?? "border-zinc-200 bg-zinc-50 text-zinc-900",
        isCancelled && "opacity-70",
        variant === "block" ? "flex-col" : "items-center",
        className,
      )}
    >
      <span className="flex w-full min-w-0 items-center gap-1">
        <span
          className={cn("h-3 w-0.5 shrink-0 rounded-full", typeStyle?.accent ?? "bg-zinc-400")}
          aria-hidden="true"
        />
        <span className="shrink-0 font-medium tabular-nums">{timeLabel}</span>
        {hasConflict ? (
          <AlertTriangle
            className="size-3 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
        ) : null}
        <span
          className={cn("min-w-0 flex-1 truncate", isCancelled && "line-through")}
          title={event.title}
        >
          {event.title}
        </span>
        <EventTypeIcon eventType={event.eventType} className="size-3 shrink-0 opacity-70" />
      </span>

      {variant === "block" ? (
        <span className="flex w-full min-w-0 items-center gap-1 text-[11px] opacity-80">
          <span
            className={cn("size-1.5 shrink-0 rounded-full", statusStyle?.dot ?? "bg-zinc-400")}
            aria-hidden="true"
          />
          <span className="truncate">
            {labelForEventStatus(event.status)}
            {showAdvisor && event.advisor?.name ? ` · ${event.advisor.name}` : ""}
            {event.client?.name ? ` · ${event.client.name}` : ""}
          </span>
        </span>
      ) : null}
    </button>
  );
}
