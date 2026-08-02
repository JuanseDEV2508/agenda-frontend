"use client";

import { useMemo } from "react";

import type { AgendaEvent } from "@/features/agenda/types";
import { groupEventsByDay } from "@/features/agenda/utils/layout";
import {
  capitalize,
  formatEventTimeRange,
  parseCalendarDate,
  type CalendarDate,
  type VisibleRange,
} from "@/lib/dates";
import { cn } from "@/lib/utils/cn";

import { EventStatusBadge } from "./event-status-badge";
import { EventTypeIcon } from "./event-type-badge";

/**
 * Agenda en lista.
 *
 * Es la experiencia prioritaria en móvil, donde una rejilla mensual no es
 * usable (§28), y también sirve como vista de lista en escritorio.
 */
export function AgendaList({
  range,
  events,
  timezone,
  today,
  showAdvisor,
  onSelectEvent,
}: {
  range: VisibleRange;
  events: AgendaEvent[];
  timezone: string;
  today: CalendarDate;
  showAdvisor: boolean;
  onSelectEvent: (event: AgendaEvent) => void;
}) {
  const eventsByDay = useMemo(() => groupEventsByDay(events, timezone), [events, timezone]);
  const daysWithEvents = useMemo(
    () => range.days.filter((day) => (eventsByDay.get(day)?.length ?? 0) > 0),
    [range.days, eventsByDay],
  );

  return (
    <div className="space-y-4">
      {daysWithEvents.map((day) => {
        const date = parseCalendarDate(day);
        const dayEvents = eventsByDay.get(day) ?? [];

        return (
          <section key={day} aria-labelledby={`dia-${day}`}>
            <h3
              id={`dia-${day}`}
              className={cn(
                "mb-2 flex items-center gap-2 text-sm font-semibold",
                day === today
                  ? "text-brand-700 dark:text-brand-300"
                  : "text-zinc-700 dark:text-zinc-300",
              )}
            >
              {capitalize(
                new Intl.DateTimeFormat("es", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(date),
              )}
              {day === today ? (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-100">
                  Hoy
                </span>
              ) : null}
            </h3>

            <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
              {dayEvents.map((event) => (
                <li key={`${day}-${event.id}`}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent(event)}
                    className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  >
                    <EventTypeIcon
                      eventType={event.eventType}
                      className="mt-0.5 size-4 shrink-0 text-zinc-500"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {event.title}
                        </span>
                        <EventStatusBadge status={event.status} size="sm" />
                      </div>

                      <p className="mt-0.5 text-xs tabular-nums text-[var(--text-muted)]">
                        {formatEventTimeRange(event.startAt, event.endAt, timezone)}
                      </p>

                      {(showAdvisor && event.advisor?.name) || event.client?.name ? (
                        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                          {[
                            showAdvisor && event.advisor?.name
                              ? `Asesor: ${event.advisor.name}`
                              : null,
                            event.client?.name ? `Cliente: ${event.client.name}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
