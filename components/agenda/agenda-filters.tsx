"use client";

import { Search, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  EVENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  labelForEventStatus,
  labelForEventType,
} from "@/features/agenda/constants";
import { advisorLabel, useAdvisors } from "@/features/agenda/hooks/use-advisors";
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  type AgendaFilters,
  type EventStatus,
  type EventType,
} from "@/features/agenda/types";
import { useSession } from "@/features/auth/hooks/use-session";
import { canSelectAdvisor } from "@/lib/permissions";

/**
 * Filtros de agenda.
 *
 * El selector de asesor sólo existe para quien puede consultar varias agendas.
 * Un ADVISOR no lo ve, porque sólo tiene la suya (§10).
 */
export function AgendaFiltersPanel({
  filters,
  hasActiveFilters,
  onChange,
  onClear,
  onClose,
}: {
  filters: AgendaFilters;
  hasActiveFilters: boolean;
  onChange: (patch: Partial<AgendaFilters>) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { user } = useSession();
  const { advisors, isEnabled: canFilterByAdvisor, isLoading: isLoadingAdvisors } = useAdvisors();

  /*
   * Búsqueda con debounce imperativo: el temporizador se maneja en el propio
   * manejador de cambio, sin efectos que disparen renders en cascada.
   */
  const [searchTerm, setSearchTerm] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(value: string) {
    setSearchTerm(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange({ search: value }), 300);
  }

  function resetSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchTerm("");
    onChange({ search: "" });
  }

  function handleClearAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchTerm("");
    onClear();
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Filtros</h3>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Ocultar filtros">
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {canSelectAdvisor(user) && canFilterByAdvisor ? (
          <Field label="Asesor" htmlFor="filtro-asesor">
            <Select
              id="filtro-asesor"
              value={filters.advisorId ?? ""}
              onChange={(event) => onChange({ advisorId: event.target.value || null })}
              disabled={isLoadingAdvisors}
            >
              <option value="">Todos los asesores</option>
              {advisors.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>
                  {advisorLabel(advisor)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="Estado" htmlFor="filtro-estado">
          <Select
            id="filtro-estado"
            value={filters.status ?? ""}
            onChange={(event) =>
              onChange({ status: (event.target.value as EventStatus) || null })
            }
          >
            <option value="">Todos los estados</option>
            {EVENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {EVENT_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tipo de evento" htmlFor="filtro-tipo">
          <Select
            id="filtro-tipo"
            value={filters.eventType ?? ""}
            onChange={(event) =>
              onChange({ eventType: (event.target.value as EventType) || null })
            }
          >
            <option value="">Todos los tipos</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EVENT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Buscar"
          htmlFor="filtro-busqueda"
          description="Título, cliente, asesor o inmueble"
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
              aria-hidden="true"
            />
            <Input
              id="filtro-busqueda"
              type="search"
              value={searchTerm}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Buscar en el periodo"
              className="pl-9"
            />
          </div>
        </Field>
      </div>

      {hasActiveFilters ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
          <span className="text-xs font-medium text-[var(--text-muted)]">Filtros activos:</span>

          {filters.advisorId ? (
            <FilterChip
              label={`Asesor: ${
                advisors.find((advisor) => advisor.id === filters.advisorId)?.name ??
                "seleccionado"
              }`}
              onRemove={() => onChange({ advisorId: null })}
            />
          ) : null}

          {filters.status ? (
            <FilterChip
              label={`Estado: ${labelForEventStatus(filters.status)}`}
              onRemove={() => onChange({ status: null })}
            />
          ) : null}

          {filters.eventType ? (
            <FilterChip
              label={`Tipo: ${labelForEventType(filters.eventType)}`}
              onRemove={() => onChange({ eventType: null })}
            />
          ) : null}

          {filters.search.trim() ? (
            <FilterChip
              label={`Búsqueda: “${filters.search.trim()}”`}
              onRemove={resetSearch}
            />
          ) : null}

          <Button variant="link" size="sm" onClick={handleClearAll} className="ml-auto">
            Limpiar filtros
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
        aria-label={`Quitar filtro ${label}`}
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </span>
  );
}
