import type { AgendaEvent } from "@/features/agenda/types";
import { calendarDateOf, parseApiDate, type CalendarDate } from "@/lib/dates";
import { isTerminalStatus } from "@/lib/permissions";

/**
 * Reparto de los eventos del inicio en los cuatro bloques de la pantalla.
 *
 * Función pura: recibe lo que devuelven las dos llamadas a `calendar/week` y
 * no sabe nada de red ni de React. Toda la lógica que merece prueba vive aquí.
 */
export interface HomeBuckets {
  /** Hoy, en la zona de la empresa. */
  today: AgendaEvent[];
  /** Los seis días siguientes. */
  upcoming: AgendaEvent[];
  /** Ya pasaron y siguen abiertos: lo que de verdad requiere acción. */
  overdue: AgendaEvent[];
  /** Aún por venir y sin confirmar. */
  toConfirm: AgendaEvent[];
}

export function selectHomeEvents(
  weeks: AgendaEvent[][],
  { today, now, timezone }: { today: CalendarDate; now: Date; timezone: string },
): HomeBuckets {
  // Un evento que cruza la medianoche sale en las dos semanas: el rango del
  // backend es por solapamiento, no por día de inicio.
  const unique = new Map<string, AgendaEvent>();
  for (const week of weeks) {
    for (const event of week) unique.set(event.id, event);
  }

  const buckets: HomeBuckets = { today: [], upcoming: [], overdue: [], toConfirm: [] };

  for (const event of unique.values()) {
    const startsAt = parseApiDate(event.startAt);
    if (!startsAt) continue;

    // Comparar los ISO como texto falla en cuanto dos eventos traen offsets
    // distintos; el orden temporal se decide sobre fechas reales.
    const isPast = startsAt.getTime() < now.getTime();
    const day = calendarDateOf(event.startAt, timezone);

    if (day === today) buckets.today.push(event);
    else if (day > today) buckets.upcoming.push(event);

    if (isPast && !isTerminalStatus(event.status)) buckets.overdue.push(event);
    else if (!isPast && event.status === "PENDING") buckets.toConfirm.push(event);
  }

  // Por instante real, no por texto: dos offsets distintos ordenan mal.
  const at = (event: AgendaEvent) => parseApiDate(event.startAt)?.getTime() ?? 0;
  const byStart = (a: AgendaEvent, b: AgendaEvent) => at(a) - at(b);
  for (const list of Object.values(buckets)) list.sort(byStart);

  return buckets;
}
