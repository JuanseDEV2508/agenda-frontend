"use client";

import { Select } from "@/components/ui/field";
import { advisorLabel, useAdvisors } from "@/features/agenda/hooks/use-advisors";

/** Valor de `?advisor=` que el backend interpreta como "sin dueño". */
const UNASSIGNED = "none";

/**
 * Filtro por asesor para administración y supervisión. El alcance real lo
 * recorta el backend: elegir a un asesor ajeno no amplía lo que se ve.
 */
export function AdvisorFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (advisorId: string) => void;
}) {
  const { advisors, isLoading } = useAdvisors();

  return (
    <div className="border-b border-[var(--border-subtle)] p-3">
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={isLoading}
        aria-label="Filtrar por asesor"
        className="h-9 text-sm"
      >
        <option value="">Todos los asesores</option>
        <option value={UNASSIGNED}>Sin asignar</option>
        {advisors.map((advisor) => (
          <option key={advisor.id} value={advisor.id}>
            {advisorLabel(advisor)}
          </option>
        ))}
      </Select>
    </div>
  );
}
