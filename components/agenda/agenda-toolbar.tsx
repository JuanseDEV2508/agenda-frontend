"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { CALENDAR_VIEW_LABELS } from "@/features/agenda/constants";
import { CALENDAR_VIEWS, type CalendarView } from "@/features/agenda/types";
import { capitalize, type CalendarDate } from "@/lib/dates";
import { cn } from "@/lib/utils/cn";

/**
 * Barra superior de la agenda: navegación por fechas, selector de vista,
 * actualización, filtros y acción principal.
 */
export function AgendaToolbar({
  view,
  rangeLabel,
  anchor,
  isToday,
  isFetching,
  canCreate,
  activeFilterCount,
  isListMode,
  onToggleListMode,
  onSetView,
  onPrevious,
  onNext,
  onToday,
  onPickDate,
  onRefresh,
  onToggleFilters,
  onCreate,
}: {
  view: CalendarView;
  rangeLabel: string;
  anchor: CalendarDate;
  isToday: boolean;
  isFetching: boolean;
  canCreate: boolean;
  activeFilterCount: number;
  isListMode: boolean;
  onToggleListMode: () => void;
  onSetView: (view: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onPickDate: (date: CalendarDate) => void;
  onRefresh: () => void;
  onToggleFilters: () => void;
  onCreate: () => void;
}) {
  const previousLabel = { day: "Día anterior", week: "Semana anterior", month: "Mes anterior" }[view];
  const nextLabel = { day: "Día siguiente", week: "Semana siguiente", month: "Mes siguiente" }[view];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Agenda
        </h2>

        {isFetching ? <Spinner /> : null}

        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          aria-label="Actualizar agenda"
          title="Actualizar"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onToggleFilters}
          aria-expanded={undefined}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filtros
          {activeFilterCount > 0 ? (
            <span className="ml-1 rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>

        {canCreate ? (
          <Button size="sm" onClick={onCreate} className="hidden sm:inline-flex">
            <Plus className="size-4" aria-hidden="true" />
            Crear evento
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevious}
            aria-label={previousLabel}
            title={previousLabel}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onNext}
            aria-label={nextLabel}
            title={nextLabel}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant={isToday ? "secondary" : "outline"}
            size="sm"
            onClick={onToday}
            aria-label="Ir a hoy"
          >
            Hoy
          </Button>
        </div>

        <p
          className="mr-auto min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-100"
          aria-live="polite"
        >
          {capitalize(rangeLabel)}
        </p>

        <label className="sr-only" htmlFor="agenda-fecha">
          Seleccionar fecha
        </label>
        <input
          id="agenda-fecha"
          type="date"
          value={anchor}
          onChange={(event) => {
            if (event.target.value) onPickDate(event.target.value);
          }}
          className="h-9 rounded-lg border border-zinc-300 bg-[var(--surface)] px-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-50"
        />

        <div
          className="flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700"
          role="group"
          aria-label="Cambiar vista del calendario"
        >
          {CALENDAR_VIEWS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                if (isListMode) onToggleListMode();
                onSetView(option);
              }}
              aria-pressed={!isListMode && view === option}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                !isListMode && view === option
                  ? "bg-brand-600 text-white"
                  : "bg-[var(--surface)] text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
              )}
            >
              {CALENDAR_VIEW_LABELS[option]}
            </button>
          ))}

          <button
            type="button"
            onClick={onToggleListMode}
            aria-pressed={isListMode}
            aria-label="Ver como lista"
            title="Ver como lista"
            className={cn(
              "flex items-center gap-1 border-l border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors dark:border-zinc-700",
              isListMode
                ? "bg-brand-600 text-white"
                : "bg-[var(--surface)] text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            {isListMode ? (
              <CalendarDays className="size-4" aria-hidden="true" />
            ) : (
              <List className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
