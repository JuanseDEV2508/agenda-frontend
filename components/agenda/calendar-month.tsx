"use client";

import { useMemo } from "react";

import type { AgendaEvent } from "@/features/agenda/types";
import { groupEventsByDay } from "@/features/agenda/utils/layout";
import {
  parseCalendarDate,
  WEEKDAY_LABELS,
  type CalendarDate,
  type VisibleRange,
} from "@/lib/dates";
import { cn } from "@/lib/utils/cn";

import { EventChip } from "./event-chip";

/**
 * Vista mensual.
 *
 * Se distinguen tres interacciones sin que compitan entre sí (§9.6):
 *  - clic en el NÚMERO del día  → abre la vista diaria
 *  - clic en la celda vacía     → crea un evento ese día
 *  - clic en un evento          → abre su detalle
 */
const MAX_VISIBLE_PER_DAY = 3;

export function CalendarMonth({
  range,
  events,
  timezone,
  today,
  showAdvisor,
  canCreate,
  onSelectEvent,
  onCreateAt,
  onOpenDay,
}: {
  range: VisibleRange;
  events: AgendaEvent[];
  timezone: string;
  today: CalendarDate;
  showAdvisor: boolean;
  canCreate: boolean;
  onSelectEvent: (event: AgendaEvent) => void;
  onCreateAt: (date: CalendarDate) => void;
  onOpenDay: (date: CalendarDate) => void;
}) {
  const eventsByDay = useMemo(() => groupEventsByDay(events, timezone), [events, timezone]);
  const anchorMonth = parseCalendarDate(range.days[Math.floor(range.days.length / 2)]).getMonth();

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
      <div
        className="grid grid-cols-7 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]"
        role="presentation"
      >
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-medium text-[var(--text-muted)]"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {range.days.map((day) => {
          const date = parseCalendarDate(day);
          const dayEvents = eventsByDay.get(day) ?? [];
          const isOutsideMonth = date.getMonth() !== anchorMonth;
          const isToday = day === today;
          const visible = dayEvents.slice(0, MAX_VISIBLE_PER_DAY);
          const hidden = dayEvents.length - visible.length;

          return (
            <div
              key={day}
              className={cn(
                "group flex min-h-24 flex-col gap-1 border-b border-r border-[var(--border-subtle)] p-1.5 sm:min-h-32",
                isOutsideMonth && "bg-[var(--surface-muted)]",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  aria-label={`Ver el día ${formatDayAria(day)}`}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    isToday
                      ? "bg-brand-600 text-white"
                      : isOutsideMonth
                        ? "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                  )}
                >
                  {date.getDate()}
                </button>

                {canCreate ? (
                  <button
                    type="button"
                    onClick={() => onCreateAt(day)}
                    aria-label={`Crear evento el ${formatDayAria(day)}`}
                    className="rounded px-1 text-sm leading-none text-zinc-400 transition-opacity hover:bg-zinc-100 hover:text-zinc-700 focus-visible:opacity-100 dark:hover:bg-zinc-800 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    +
                  </button>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {visible.map((event) => (
                  <EventChip
                    key={`${day}-${event.id}`}
                    event={event}
                    timezone={timezone}
                    variant="row"
                    showAdvisor={showAdvisor}
                    onSelect={onSelectEvent}
                  />
                ))}

                {hidden > 0 ? (
                  <button
                    type="button"
                    onClick={() => onOpenDay(day)}
                    className="rounded px-1 py-0.5 text-left text-[11px] font-medium text-brand-700 hover:underline dark:text-brand-300"
                  >
                    +{hidden} {hidden === 1 ? "evento más" : "eventos más"}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDayAria(day: CalendarDate): string {
  const date = parseCalendarDate(day);
  return new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
