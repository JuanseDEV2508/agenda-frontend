"use client";

import { EVENT_TYPE_STYLES, labelForEventType } from "@/features/agenda/constants";
import type { EventType } from "@/features/agenda/types";
import { cn } from "@/lib/utils/cn";

import { EventTypeIcon } from "./event-icons";

export function EventTypeBadge({
  eventType,
  size = "md",
  className,
}: {
  eventType: EventType | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const style = eventType ? EVENT_TYPE_STYLES[eventType] : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs",
        style?.badge ?? "bg-zinc-100 text-zinc-700 ring-zinc-600/20",
        className,
      )}
    >
      <EventTypeIcon eventType={eventType} className={size === "sm" ? "size-3" : "size-3.5"} />
      {labelForEventType(eventType)}
    </span>
  );
}

export { EventTypeIcon };
