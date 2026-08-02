"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { queryKeys } from "@/config/query-keys";
import {
  fetchCalendarDay,
  fetchCalendarMonth,
  fetchCalendarWeek,
} from "@/features/agenda/api/events.api";
import type { AgendaEvent, AgendaFilters } from "@/features/agenda/types";
import {
  calendarDateOf,
  monthsCoveringRange,
  type VisibleRange,
} from "@/lib/dates";

/**
 * Eventos del rango visible.
 *
 * Se consultan los endpoints `/calendar/day|week|month/`, que son los
 * documentados para estas tres vistas. Nunca se descarga histórico: cada
 * petición cubre sólo lo que el usuario está mirando.
 *
 * En vista mensual la rejilla incluye días de meses vecinos; se consultan los
 * 2–3 meses implicados, cada uno con su propia clave de caché, de modo que
 * navegar entre meses reaprovecha lo ya cargado.
 *
 * ⚠️ Los endpoints de calendario no documentan parámetros de filtro, así que
 * asesor / estado / tipo / texto se aplican sobre el conjunto ya acotado al
 * rango visible (docs/frontend-api-analysis.md §4.5).
 */

interface UseCalendarEventsParams {
  range: VisibleRange;
  filters: AgendaFilters;
  timezone: string;
  enabled?: boolean;
}

export interface CalendarEventsResult {
  /** Eventos del rango tras aplicar filtros. */
  events: AgendaEvent[];
  /** Eventos del rango sin filtrar; distingue "no hay nada" de "los filtros no encuentran nada". */
  unfilteredCount: number;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export function useCalendarEvents({
  range,
  filters,
  timezone,
  enabled = true,
}: UseCalendarEventsParams): CalendarEventsResult {
  const queries = useMemo(() => {
    if (range.view === "day") {
      return [
        {
          queryKey: queryKeys.calendar.day(range.start),
          queryFn: ({ signal }: { signal: AbortSignal }) =>
            fetchCalendarDay(range.start, signal),
          enabled,
        },
      ];
    }

    if (range.view === "week") {
      return [
        {
          queryKey: queryKeys.calendar.week(range.start),
          queryFn: ({ signal }: { signal: AbortSignal }) =>
            fetchCalendarWeek(range.start, signal),
          enabled,
        },
      ];
    }

    return monthsCoveringRange(range).map((month) => ({
      queryKey: queryKeys.calendar.month(month),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchCalendarMonth(month, signal),
      enabled,
    }));
  }, [range, enabled]);

  const results = useQueries({ queries });

  const visibleDays = useMemo(() => new Set(range.days), [range.days]);

  const rangeEvents = useMemo(() => {
    const byId = new Map<string, AgendaEvent>();

    for (const result of results) {
      for (const event of result.data ?? []) {
        // Los meses vecinos aportan días fuera de la rejilla: se descartan.
        if (!visibleDays.has(calendarDateOf(event.startAt, timezone))) continue;
        byId.set(event.id, event);
      }
    }

    return [...byId.values()].sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [results, visibleDays, timezone]);

  const events = useMemo(() => applyFilters(rangeEvents, filters), [rangeEvents, filters]);

  const firstError = results.find((result) => result.isError);

  return {
    events,
    unfilteredCount: rangeEvents.length,
    isLoading: results.some((result) => result.isLoading),
    isFetching: results.some((result) => result.isFetching),
    isError: Boolean(firstError),
    error: firstError?.error,
    refetch: () => {
      for (const result of results) void result.refetch();
    },
  };
}

export function applyFilters(events: AgendaEvent[], filters: AgendaFilters): AgendaEvent[] {
  const term = filters.search.trim().toLowerCase();

  return events.filter((event) => {
    if (filters.advisorId && event.advisor?.id !== filters.advisorId) return false;
    if (filters.status && event.status !== filters.status) return false;
    if (filters.eventType && event.eventType !== filters.eventType) return false;

    if (term !== "") {
      const haystack = [
        event.title,
        event.client?.name,
        event.advisor?.name,
        event.location,
        event.propertyCode,
        event.propertyTitle,
        event.propertyAddress,
      ]
        .filter((value): value is string => typeof value === "string" && value !== "")
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(term)) return false;
    }

    return true;
  });
}
