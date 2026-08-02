"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";

import {
  CALENDAR_VIEWS,
  EMPTY_AGENDA_FILTERS,
  EVENT_STATUSES,
  EVENT_TYPES,
  type AgendaFilters,
  type CalendarView,
  type EventStatus,
  type EventType,
} from "@/features/agenda/types";
import {
  getVisibleRange,
  isValidCalendarDate,
  shiftAnchor,
  todayInZone,
  type CalendarDate,
  type VisibleRange,
} from "@/lib/dates";

/**
 * Estado de la agenda (vista, fecha y filtros) sincronizado con la URL.
 *
 * Ventajas: la vista es compartible y sobrevive a una recarga o a un botón
 * "atrás". La vista preferida se recuerda en `localStorage` (sólo una
 * preferencia de interfaz, ningún dato sensible).
 */

const PARAMS = {
  view: "vista",
  date: "fecha",
  advisor: "asesor",
  status: "estado",
  type: "tipo",
  search: "q",
} as const;

const VIEW_STORAGE_KEY = "agenda:vista-preferida";

function parseView(value: string | null): CalendarView | null {
  return value && (CALENDAR_VIEWS as readonly string[]).includes(value)
    ? (value as CalendarView)
    : null;
}

function readStoredView(): CalendarView | null {
  if (typeof window === "undefined") return null;
  try {
    return parseView(window.localStorage.getItem(VIEW_STORAGE_KEY));
  } catch {
    return null;
  }
}

export interface AgendaState {
  view: CalendarView;
  anchor: CalendarDate;
  range: VisibleRange;
  filters: AgendaFilters;
  hasActiveFilters: boolean;
  today: CalendarDate;
  isToday: boolean;
  setView: (view: CalendarView) => void;
  setAnchor: (date: CalendarDate) => void;
  goToToday: () => void;
  goPrevious: () => void;
  goNext: () => void;
  /** Abre la vista diaria de una fecha concreta. */
  openDay: (date: CalendarDate) => void;
  setFilters: (patch: Partial<AgendaFilters>) => void;
  clearFilters: () => void;
}

export function useAgendaState(timezone: string, defaultView: CalendarView = "week"): AgendaState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const today = todayInZone(timezone);

  const view = parseView(searchParams.get(PARAMS.view)) ?? defaultView;

  const dateParam = searchParams.get(PARAMS.date);
  const anchor = isValidCalendarDate(dateParam) ? dateParam : today;

  const filters = useMemo<AgendaFilters>(() => {
    const status = searchParams.get(PARAMS.status);
    const eventType = searchParams.get(PARAMS.type);

    return {
      advisorId: searchParams.get(PARAMS.advisor) || null,
      status:
        status && (EVENT_STATUSES as readonly string[]).includes(status)
          ? (status as EventStatus)
          : null,
      eventType:
        eventType && (EVENT_TYPES as readonly string[]).includes(eventType)
          ? (eventType as EventType)
          : null,
      search: searchParams.get(PARAMS.search) ?? "",
    };
  }, [searchParams]);

  const range = useMemo(() => getVisibleRange(view, anchor), [view, anchor]);

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }

      const query = next.toString();
      // `replace` + `scroll: false`: navegar por la agenda no debe llenar el
      // historial ni mover la página.
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // Recupera la vista preferida cuando la URL no la especifica.
  useEffect(() => {
    if (searchParams.get(PARAMS.view)) return;
    const stored = readStoredView();
    if (stored && stored !== defaultView) {
      updateParams({ [PARAMS.view]: stored });
    }
    // Sólo al montar: después manda siempre la URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setView = useCallback(
    (nextView: CalendarView) => {
      try {
        window.localStorage.setItem(VIEW_STORAGE_KEY, nextView);
      } catch {
        // Modo privado o almacenamiento bloqueado: no es crítico.
      }
      // Se conserva la fecha ancla al cambiar de vista.
      updateParams({ [PARAMS.view]: nextView, [PARAMS.date]: anchor });
    },
    [anchor, updateParams],
  );

  const setAnchor = useCallback(
    (date: CalendarDate) => updateParams({ [PARAMS.date]: date }),
    [updateParams],
  );

  const openDay = useCallback(
    (date: CalendarDate) => updateParams({ [PARAMS.view]: "day", [PARAMS.date]: date }),
    [updateParams],
  );

  const setFilters = useCallback(
    (patch: Partial<AgendaFilters>) => {
      updateParams({
        ...("advisorId" in patch ? { [PARAMS.advisor]: patch.advisorId ?? null } : {}),
        ...("status" in patch ? { [PARAMS.status]: patch.status ?? null } : {}),
        ...("eventType" in patch ? { [PARAMS.type]: patch.eventType ?? null } : {}),
        ...("search" in patch ? { [PARAMS.search]: patch.search ?? null } : {}),
      });
    },
    [updateParams],
  );

  const clearFilters = useCallback(() => {
    updateParams({
      [PARAMS.advisor]: null,
      [PARAMS.status]: null,
      [PARAMS.type]: null,
      [PARAMS.search]: null,
    });
  }, [updateParams]);

  const hasActiveFilters =
    filters.advisorId !== null ||
    filters.status !== null ||
    filters.eventType !== null ||
    filters.search.trim() !== "";

  return {
    view,
    anchor,
    range,
    filters,
    hasActiveFilters,
    today,
    isToday: range.days.includes(today),
    setView,
    setAnchor,
    goToToday: () => setAnchor(today),
    goPrevious: () => setAnchor(shiftAnchor(view, anchor, -1)),
    goNext: () => setAnchor(shiftAnchor(view, anchor, 1)),
    openDay,
    setFilters,
    clearFilters,
  };
}

export { EMPTY_AGENDA_FILTERS };
