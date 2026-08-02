import type { AgendaEvent } from "@/features/agenda/types";
import {
  calendarDateOf,
  minutesOfDay,
  parseApiDate,
  shiftCalendarDate,
  type CalendarDate,
} from "@/lib/dates";

/**
 * Colocación de eventos en la rejilla horaria.
 *
 * Todos los cálculos usan la hora de la inmobiliaria (su zona horaria), nunca la
 * del dispositivo: un evento de las 8:00 a. m. en Bogotá se dibuja a las 8:00
 * a. m. aunque el navegador esté en Madrid.
 */

const MINUTES_PER_DAY = 24 * 60;

/** Agrupa eventos por día, repitiendo los que abarcan varias jornadas. */
export function groupEventsByDay(
  events: AgendaEvent[],
  timezone: string,
): Map<CalendarDate, AgendaEvent[]> {
  const byDay = new Map<CalendarDate, AgendaEvent[]>();

  for (const event of events) {
    const startDay = calendarDateOf(event.startAt, timezone);
    const endDate = parseApiDate(event.endAt);
    const endDay = endDate ? calendarDateOf(endDate, timezone) : startDay;

    let cursor = startDay;
    // Límite defensivo: evita un bucle infinito si el backend envía fechas
    // incoherentes (fin anterior al inicio).
    for (let guard = 0; guard < 366; guard += 1) {
      const bucket = byDay.get(cursor);
      if (bucket) bucket.push(event);
      else byDay.set(cursor, [event]);

      if (cursor >= endDay) break;
      cursor = shiftCalendarDate(cursor, 1);
    }
  }

  for (const bucket of byDay.values()) {
    bucket.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  return byDay;
}

export interface PositionedEvent {
  event: AgendaEvent;
  /** Minutos desde la medianoche del día representado. */
  startMinutes: number;
  endMinutes: number;
  /** Columna asignada dentro del grupo de solapados. */
  column: number;
  /** Total de columnas del grupo: define el ancho. */
  columns: number;
  /** El evento empezó antes de este día. */
  continuesFromPreviousDay: boolean;
  /** El evento termina después de este día. */
  continuesNextDay: boolean;
}

const MIN_VISIBLE_MINUTES = 20;

/**
 * Calcula la posición de cada evento de un día y reparte en columnas los que se
 * solapan, de modo que **ninguno queda oculto** (§9.7).
 */
export function layoutDayEvents(
  events: AgendaEvent[],
  day: CalendarDate,
  timezone: string,
): PositionedEvent[] {
  const positioned = events
    .map((event) => toPositioned(event, day, timezone))
    .filter((item): item is PositionedEvent => item !== null)
    .sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);

  assignColumns(positioned);
  return positioned;
}

function toPositioned(
  event: AgendaEvent,
  day: CalendarDate,
  timezone: string,
): PositionedEvent | null {
  const startDay = calendarDateOf(event.startAt, timezone);
  const endDate = parseApiDate(event.endAt);
  const endDay = endDate ? calendarDateOf(endDate, timezone) : startDay;

  if (day < startDay || day > endDay) return null;

  const continuesFromPreviousDay = day > startDay;
  const continuesNextDay = day < endDay;

  const rawStart = continuesFromPreviousDay ? 0 : minutesOfDay(event.startAt, timezone);
  const rawEnd = continuesNextDay
    ? MINUTES_PER_DAY
    : endDate
      ? minutesOfDay(endDate, timezone)
      : rawStart + MIN_VISIBLE_MINUTES;

  const startMinutes = clamp(rawStart, 0, MINUTES_PER_DAY);
  // Un evento sin duración o con fin anterior al inicio sigue siendo legible.
  const endMinutes = clamp(
    Math.max(rawEnd, startMinutes + MIN_VISIBLE_MINUTES),
    0,
    MINUTES_PER_DAY,
  );

  return {
    event,
    startMinutes,
    endMinutes,
    column: 0,
    columns: 1,
    continuesFromPreviousDay,
    continuesNextDay,
  };
}

/**
 * Reparto en columnas: se agrupan los eventos que se solapan en cadena y dentro
 * de cada grupo se asigna la primera columna libre.
 */
function assignColumns(items: PositionedEvent[]): void {
  let cluster: PositionedEvent[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const columns = Math.max(...cluster.map((item) => item.column)) + 1;
    for (const item of cluster) item.columns = columns;
    cluster = [];
  };

  for (const item of items) {
    if (item.startMinutes >= clusterEnd) {
      flush();
      clusterEnd = item.endMinutes;
    } else {
      clusterEnd = Math.max(clusterEnd, item.endMinutes);
    }

    const taken = new Set(
      cluster.filter((other) => other.endMinutes > item.startMinutes).map((o) => o.column),
    );

    let column = 0;
    while (taken.has(column)) column += 1;
    item.column = column;

    cluster.push(item);
  }

  flush();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** ¿Este evento se solapa con algún otro del mismo día? Se marca visualmente. */
export function hasConflict(item: PositionedEvent): boolean {
  return item.columns > 1;
}

/** Rango horario que conviene mostrar: cubre siempre los eventos existentes. */
export function computeVisibleHourRange(
  items: PositionedEvent[],
  defaultStartHour: number,
  defaultEndHour: number,
): { startHour: number; endHour: number } {
  if (items.length === 0) {
    return { startHour: defaultStartHour, endHour: defaultEndHour };
  }

  const earliest = Math.min(...items.map((item) => item.startMinutes));
  const latest = Math.max(...items.map((item) => item.endMinutes));

  return {
    startHour: Math.min(defaultStartHour, Math.floor(earliest / 60)),
    endHour: Math.max(defaultEndHour, Math.ceil(latest / 60)),
  };
}
