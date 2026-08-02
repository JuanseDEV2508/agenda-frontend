"use client";

import { CalendarX2, Plus, SearchX } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useAgendaState } from "@/features/agenda/hooks/use-agenda-state";
import { useCalendarEvents } from "@/features/agenda/hooks/use-calendar-events";
import { useMediaQuery } from "@/features/agenda/hooks/use-media-query";
import type { AgendaEvent, CalendarView } from "@/features/agenda/types";
import { useSession } from "@/features/auth/hooks/use-session";
import type { CalendarDate } from "@/lib/dates";
import { canCreateEvent, canViewAllAdvisors } from "@/lib/permissions";

import { AgendaFiltersPanel } from "./agenda-filters";
import { AgendaList } from "./agenda-list";
import { AgendaToolbar } from "./agenda-toolbar";
import { CalendarMonth } from "./calendar-month";
import { CalendarTimeGrid } from "./calendar-time-grid";
import { EventDetailPanel } from "./event-detail-panel";
import { EventFormDialog } from "./event-form-dialog";

/**
 * Pantalla principal de agenda: une estado de URL, consulta por rango, filtros,
 * calendario, detalle y formularios.
 */
export function AgendaView() {
  const { user, timezone } = useSession();
  const agenda = useAgendaState(timezone);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [formState, setFormState] = useState<{
    open: boolean;
    mode: "create" | "edit";
    event?: AgendaEvent | null;
    date?: string;
    time?: string;
  }>({ open: false, mode: "create" });

  /*
   * En pantallas pequeñas la lista es la experiencia prioritaria (§28), pero el
   * usuario puede forzar la vista de calendario. `null` = sin preferencia
   * explícita, se decide por el ancho de pantalla.
   */
  const isSmallScreen = useMediaQuery("(max-width: 640px)");
  const [listModeOverride, setListModeOverride] = useState<boolean | null>(null);
  const isListMode = listModeOverride ?? isSmallScreen;
  const setListMode = setListModeOverride;

  const { events, unfilteredCount, isLoading, isFetching, isError, error, refetch } =
    useCalendarEvents({
      range: agenda.range,
      filters: agenda.filters,
      timezone,
    });

  const canCreate = canCreateEvent(user);
  const showAdvisor = canViewAllAdvisors(user);

  const activeFilterCount = [
    agenda.filters.advisorId,
    agenda.filters.status,
    agenda.filters.eventType,
    agenda.filters.search.trim() || null,
  ].filter(Boolean).length;

  function openCreate(date?: CalendarDate, time?: string) {
    if (!canCreate) return;
    setFormState({ open: true, mode: "create", date, time });
  }

  function openEdit(event: AgendaEvent) {
    setSelectedEvent(null);
    setFormState({ open: true, mode: "edit", event });
  }

  const calendarProps = {
    range: agenda.range,
    events,
    timezone,
    today: agenda.today,
    showAdvisor,
    canCreate,
    onSelectEvent: setSelectedEvent,
    onOpenDay: agenda.openDay,
  };

  return (
    <div className="space-y-4">
      <AgendaToolbar
        view={agenda.view}
        rangeLabel={agenda.range.label}
        anchor={agenda.anchor}
        isToday={agenda.isToday}
        isFetching={isFetching && !isLoading}
        canCreate={canCreate}
        activeFilterCount={activeFilterCount}
        isListMode={isListMode}
        onToggleListMode={() => setListMode(!isListMode)}
        onSetView={(view: CalendarView) => agenda.setView(view)}
        onPrevious={agenda.goPrevious}
        onNext={agenda.goNext}
        onToday={agenda.goToToday}
        onPickDate={agenda.setAnchor}
        onRefresh={refetch}
        onToggleFilters={() => setShowFilters((value) => !value)}
        onCreate={() => openCreate(agenda.view === "month" ? undefined : agenda.anchor)}
      />

      {showFilters ? (
        <AgendaFiltersPanel
          filters={agenda.filters}
          hasActiveFilters={agenda.hasActiveFilters}
          onChange={agenda.setFilters}
          onClear={agenda.clearFilters}
          onClose={() => setShowFilters(false)}
        />
      ) : null}

      {isLoading ? (
        <CalendarSkeleton />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : events.length === 0 ? (
        agenda.hasActiveFilters && unfilteredCount > 0 ? (
          <EmptyState
            icon={SearchX}
            title="No encontramos eventos con los filtros seleccionados."
            description={`Hay ${unfilteredCount} ${
              unfilteredCount === 1 ? "evento" : "eventos"
            } en este periodo que no coinciden con los filtros.`}
            action={
              <Button variant="outline" size="sm" onClick={agenda.clearFilters}>
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={CalendarX2}
            title="No hay eventos programados para este periodo."
            description="Cuando se agenden visitas, reuniones o llamadas aparecerán aquí."
            action={
              canCreate ? (
                <Button
                  size="sm"
                  onClick={() => openCreate(agenda.view === "month" ? undefined : agenda.anchor)}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Crear evento
                </Button>
              ) : undefined
            }
          />
        )
      ) : isListMode ? (
        <AgendaList
          range={agenda.range}
          events={events}
          timezone={timezone}
          today={agenda.today}
          showAdvisor={showAdvisor}
          onSelectEvent={setSelectedEvent}
        />
      ) : agenda.view === "month" ? (
        <CalendarMonth {...calendarProps} onCreateAt={(date) => openCreate(date)} />
      ) : (
        <CalendarTimeGrid
          {...calendarProps}
          onCreateAt={(date, time) => openCreate(date, time)}
        />
      )}

      {/* Acción principal siempre alcanzable en móvil (§28). */}
      {canCreate ? (
        <Button
          size="icon"
          className="fixed bottom-5 right-5 z-30 size-12 rounded-full shadow-lg sm:hidden"
          aria-label="Crear evento"
          onClick={() => openCreate(agenda.view === "month" ? undefined : agenda.anchor)}
        >
          <Plus className="size-5" aria-hidden="true" />
        </Button>
      ) : null}

      <EventDetailPanel
        eventId={selectedEvent?.id ?? null}
        fallbackEvent={selectedEvent}
        open={selectedEvent !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null);
        }}
        onEdit={openEdit}
      />

      <EventFormDialog
        open={formState.open}
        mode={formState.mode}
        event={formState.event}
        initialDate={formState.date}
        initialTime={formState.time}
        onOpenChange={(open) => setFormState((state) => ({ ...state, open }))}
      />
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div
      className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4"
      aria-busy="true"
      aria-label="Cargando agenda"
    >
      <Skeleton className="h-8 w-full" />
      <div className="grid gap-2 sm:grid-cols-7">
        {Array.from({ length: 14 }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
