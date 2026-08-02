"use client";

import { useMemo } from "react";

import { DAY_GRID_END_HOUR, DAY_GRID_START_HOUR } from "@/features/agenda/constants";
import type { AgendaEvent } from "@/features/agenda/types";
import {
  computeVisibleHourRange,
  groupEventsByDay,
  hasConflict,
  layoutDayEvents,
  type PositionedEvent,
} from "@/features/agenda/utils/layout";
import {
  formatHourLabel,
  parseCalendarDate,
  type CalendarDate,
  type VisibleRange,
} from "@/lib/dates";
import { cn } from "@/lib/utils/cn";

import { EventChip } from "./event-chip";

/**
 * Rejilla horaria para las vistas de día y semana.
 *
 * Los eventos solapados se reparten en columnas: ninguno se oculta y el solape
 * se señala con un icono además del ancho reducido (§9.7).
 */

const HOUR_HEIGHT_PX = 56;
const SLOT_MINUTES = 30;

export function CalendarTimeGrid({
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
  onCreateAt: (date: CalendarDate, time: string) => void;
  onOpenDay: (date: CalendarDate) => void;
}) {
  const eventsByDay = useMemo(() => groupEventsByDay(events, timezone), [events, timezone]);

  const layouts = useMemo(() => {
    const map = new Map<CalendarDate, PositionedEvent[]>();
    for (const day of range.days) {
      map.set(day, layoutDayEvents(eventsByDay.get(day) ?? [], day, timezone));
    }
    return map;
  }, [range.days, eventsByDay, timezone]);

  const { startHour, endHour } = useMemo(
    () =>
      computeVisibleHourRange(
        [...layouts.values()].flat(),
        DAY_GRID_START_HOUR,
        DAY_GRID_END_HOUR,
      ),
    [layouts],
  );

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, index) => startHour + index),
    [startHour, endHour],
  );

  const gridHeight = hours.length * HOUR_HEIGHT_PX;
  const isSingleDay = range.days.length === 1;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
      {/* Cabecera de días: fija al hacer scroll vertical. */}
      <div
        className={cn(
          "sticky top-0 z-20 grid border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]",
        )}
        style={{ gridTemplateColumns: `4rem repeat(${range.days.length}, minmax(0, 1fr))` }}
      >
        <div className="border-r border-[var(--border-subtle)]" />
        {range.days.map((day) => {
          const date = parseCalendarDate(day);
          const isToday = day === today;

          return (
            <button
              key={day}
              type="button"
              onClick={() => onOpenDay(day)}
              aria-label={`Ver el día ${new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(date)}`}
              className={cn(
                "flex flex-col items-center gap-0.5 border-r border-[var(--border-subtle)] px-1 py-2 text-center transition-colors last:border-r-0 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                isSingleDay && "flex-row justify-center gap-2",
              )}
            >
              <span className="text-[11px] uppercase text-[var(--text-muted)]">
                {new Intl.DateTimeFormat("es", { weekday: "short" }).format(date)}
              </span>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-sm font-medium",
                  isToday ? "bg-brand-600 text-white" : "text-zinc-800 dark:text-zinc-100",
                )}
              >
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      <div className="scrollbar-thin max-h-[calc(100dvh-16rem)] overflow-y-auto">
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `4rem repeat(${range.days.length}, minmax(0, 1fr))`,
            height: gridHeight,
          }}
        >
          {/* Columna de horas */}
          <div className="relative border-r border-[var(--border-subtle)]">
            {hours.map((hour, index) => (
              <div
                key={hour}
                className="absolute right-1 -translate-y-1/2 text-[11px] tabular-nums text-[var(--text-muted)]"
                style={{ top: index * HOUR_HEIGHT_PX }}
              >
                {index === 0 ? null : formatHourLabel(hour)}
              </div>
            ))}
          </div>

          {range.days.map((day) => (
            <DayColumn
              key={day}
              day={day}
              items={layouts.get(day) ?? []}
              hours={hours}
              startHour={startHour}
              timezone={timezone}
              showAdvisor={showAdvisor}
              canCreate={canCreate}
              onSelectEvent={onSelectEvent}
              onCreateAt={onCreateAt}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day,
  items,
  hours,
  startHour,
  timezone,
  showAdvisor,
  canCreate,
  onSelectEvent,
  onCreateAt,
}: {
  day: CalendarDate;
  items: PositionedEvent[];
  hours: number[];
  startHour: number;
  timezone: string;
  showAdvisor: boolean;
  canCreate: boolean;
  onSelectEvent: (event: AgendaEvent) => void;
  onCreateAt: (date: CalendarDate, time: string) => void;
}) {
  const slotsPerHour = 60 / SLOT_MINUTES;

  return (
    <div className="relative border-r border-[var(--border-subtle)] last:border-r-0">
      {/* Franjas seleccionables para crear un evento en ese horario. */}
      {hours.map((hour, hourIndex) =>
        Array.from({ length: slotsPerHour }, (_, slotIndex) => {
          const minutes = slotIndex * SLOT_MINUTES;
          const time = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

          return (
            <div
              key={time}
              className={cn(
                "absolute inset-x-0 border-t",
                slotIndex === 0
                  ? "border-[var(--border-subtle)]"
                  : "border-dashed border-[var(--border-subtle)]/60",
              )}
              style={{
                top: hourIndex * HOUR_HEIGHT_PX + (minutes / 60) * HOUR_HEIGHT_PX,
                height: (SLOT_MINUTES / 60) * HOUR_HEIGHT_PX,
              }}
            >
              {canCreate ? (
                <button
                  type="button"
                  onClick={() => onCreateAt(day, time)}
                  aria-label={`Crear evento el ${day} a las ${time}`}
                  className="size-full transition-colors hover:bg-brand-50 dark:hover:bg-brand-950/40"
                />
              ) : null}
            </div>
          );
        }),
      )}

      {items.map((item) => {
        const top = ((item.startMinutes - startHour * 60) / 60) * HOUR_HEIGHT_PX;
        const height = ((item.endMinutes - item.startMinutes) / 60) * HOUR_HEIGHT_PX;
        const widthPercent = 100 / item.columns;

        return (
          <EventChip
            key={item.event.id}
            event={item.event}
            timezone={timezone}
            showAdvisor={showAdvisor}
            hasConflict={hasConflict(item)}
            onSelect={onSelectEvent}
            className="absolute overflow-hidden"
            style={{
              top: Math.max(top, 0),
              height: Math.max(height - 2, 18),
              left: `calc(${item.column * widthPercent}% + 2px)`,
              width: `calc(${widthPercent}% - 4px)`,
            }}
          />
        );
      })}
    </div>
  );
}
