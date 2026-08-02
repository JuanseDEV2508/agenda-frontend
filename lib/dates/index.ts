import { TZDate } from "@date-fns/tz";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

import type { CalendarMonthKey, CalendarView } from "@/features/agenda/types";

/**
 * Utilidades de fecha centralizadas.
 *
 * Reglas del proyecto:
 *  - El backend entrega y recibe ISO-8601 **con offset** (`2026-08-10T15:00:00-05:00`).
 *  - La interfaz muestra siempre la hora **de la inmobiliaria** (su `timezone`),
 *    no la del dispositivo: dos usuarios en husos distintos ven la misma agenda.
 *  - Una "fecha de calendario" (el día que el usuario está mirando) se representa
 *    como cadena `yyyy-MM-dd`, nunca como `Date`, para evitar corrimientos de día.
 *  - Nunca se concatenan cadenas para convertir husos horarios.
 */

export const DEFAULT_TIMEZONE = "America/Bogota";
export const CALENDAR_DATE_FORMAT = "yyyy-MM-dd";
export const WEEK_OPTIONS = { weekStartsOn: 1 } as const; // La semana empieza el lunes.

export type CalendarDate = string; // `yyyy-MM-dd`

/** Convierte un ISO del backend en instante absoluto. Devuelve `null` si es inválido. */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return isValid(date) ? date : null;
}

/** Representa un instante en la zona horaria de la empresa. */
export function toZoned(value: Date | string, timeZone: string): TZDate {
  const date = typeof value === "string" ? new Date(value) : value;
  return new TZDate(date, timeZone);
}

/* --------------------------------- Formato -------------------------------- */

function safeFormat(
  value: string | Date | null | undefined,
  timeZone: string,
  pattern: string,
  fallback = "—",
): string {
  const date = typeof value === "string" ? parseApiDate(value) : (value ?? null);
  if (!date) return fallback;
  return format(toZoned(date, timeZone), pattern, { locale: es });
}

/**
 * El locale `es` de date-fns formatea el periodo del día como "AM"/"PM".
 * La convención de la interfaz es "a. m." / "p. m." (§32), así que se compone
 * a mano en lugar de usar el token `a`.
 */
function withMeridiem(date: Date): string {
  const hours = date.getHours();
  const meridiem = hours < 12 ? "a. m." : "p. m.";
  return `${format(date, "h:mm")} ${meridiem}`;
}

/** "sábado, 1 de agosto de 2026" */
export function formatEventDate(value: string | Date | null | undefined, timeZone: string) {
  return safeFormat(value, timeZone, "EEEE, d 'de' MMMM 'de' yyyy");
}

/** "1 ago 2026" */
export function formatShortDate(value: string | Date | null | undefined, timeZone: string) {
  return safeFormat(value, timeZone, "d MMM yyyy");
}

/** "1 de agosto" */
export function formatDayAndMonth(value: string | Date | null | undefined, timeZone: string) {
  return safeFormat(value, timeZone, "d 'de' MMMM");
}

/** "8:30 a. m." */
export function formatEventTime(value: string | Date | null | undefined, timeZone: string) {
  const date = typeof value === "string" ? parseApiDate(value) : (value ?? null);
  if (!date) return "—";
  return withMeridiem(toZoned(date, timeZone));
}

/** "8:30 a. m. – 9:30 a. m." */
export function formatEventTimeRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
  timeZone: string,
) {
  const startLabel = formatEventTime(start, timeZone);
  if (!end) return startLabel;
  return `${startLabel} – ${formatEventTime(end, timeZone)}`;
}

/** "1 ago 2026, 8:30 a. m." */
export function formatDateTime(value: string | Date | null | undefined, timeZone: string) {
  const date = typeof value === "string" ? parseApiDate(value) : (value ?? null);
  if (!date) return "—";
  const zoned = toZoned(date, timeZone);
  return `${format(zoned, "d MMM yyyy", { locale: es })}, ${withMeridiem(zoned)}`;
}

/** "1 h 30 min" */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || Number.isNaN(minutes) || minutes < 0) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

export function durationInMinutes(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  const startDate = parseApiDate(start);
  const endDate = parseApiDate(end);
  if (!startDate || !endDate) return null;
  return differenceInMinutes(endDate, startDate);
}

/** Etiqueta legible de una zona horaria, p. ej. "America/Bogota (GMT-5)". */
export function formatTimezoneLabel(timeZone: string, reference: Date = new Date()): string {
  const offset = format(toZoned(reference, timeZone), "XXX");
  const suffix = offset === "Z" ? "GMT" : `GMT${offset.replace(":00", "")}`;
  return `${timeZone} (${suffix})`;
}

/* ------------------------- Fechas de calendario --------------------------- */

/** `Date` a medianoche local que representa una fecha de calendario `yyyy-MM-dd`. */
export function parseCalendarDate(value: CalendarDate): Date {
  const parsed = parse(value, CALENDAR_DATE_FORMAT, new Date());
  return isValid(parsed) ? parsed : new Date();
}

export function formatCalendarDate(value: Date): CalendarDate {
  return format(value, CALENDAR_DATE_FORMAT);
}

/** Fecha de hoy **en la zona de la empresa**. */
export function todayInZone(timeZone: string): CalendarDate {
  return format(toZoned(new Date(), timeZone), CALENDAR_DATE_FORMAT);
}

export function isValidCalendarDate(value: string | null | undefined): value is CalendarDate {
  if (!value) return false;
  const parsed = parse(value, CALENDAR_DATE_FORMAT, new Date());
  return isValid(parsed) && format(parsed, CALENDAR_DATE_FORMAT) === value;
}

/** Fecha de calendario (en zona de empresa) a la que pertenece un instante. */
export function calendarDateOf(value: string | Date, timeZone: string): CalendarDate {
  return format(toZoned(value, timeZone), CALENDAR_DATE_FORMAT);
}

/** Minutos transcurridos desde la medianoche **en la zona de la empresa**. */
export function minutesOfDay(value: string | Date, timeZone: string): number {
  const zoned = toZoned(value, timeZone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

/* ------------------------------ Rango visible ------------------------------ */

export interface VisibleRange {
  view: CalendarView;
  /** Primer día mostrado (inclusive). */
  start: CalendarDate;
  /** Último día mostrado (inclusive). */
  end: CalendarDate;
  /** Días que componen la rejilla, en orden. */
  days: CalendarDate[];
  /** Título del rango, p. ej. "agosto de 2026" o "3 – 9 ago 2026". */
  label: string;
}

/**
 * Rango de días visible para una vista y una fecha ancla.
 * La vista mensual incluye los días de meses vecinos que completan la rejilla.
 */
export function getVisibleRange(view: CalendarView, anchor: CalendarDate): VisibleRange {
  const date = parseCalendarDate(anchor);

  if (view === "day") {
    return {
      view,
      start: anchor,
      end: anchor,
      days: [anchor],
      label: capitalize(format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })),
    };
  }

  if (view === "week") {
    const start = startOfWeek(date, WEEK_OPTIONS);
    const end = endOfWeek(date, WEEK_OPTIONS);
    return {
      view,
      start: formatCalendarDate(start),
      end: formatCalendarDate(end),
      days: buildDays(start, 7),
      label: formatRangeLabel(start, end),
    };
  }

  const gridStart = startOfWeek(startOfMonth(date), WEEK_OPTIONS);
  const gridEnd = endOfWeek(endOfMonth(date), WEEK_OPTIONS);
  // Diferencia en días de calendario: restar milisegundos daría un día de más
  // porque `endOfWeek` apunta al final del día (23:59:59.999).
  const totalDays = differenceInCalendarDays(gridEnd, gridStart) + 1;

  return {
    view,
    start: formatCalendarDate(gridStart),
    end: formatCalendarDate(gridEnd),
    days: buildDays(gridStart, totalDays),
    label: capitalize(format(date, "MMMM 'de' yyyy", { locale: es })),
  };
}

function buildDays(start: Date, count: number): CalendarDate[] {
  return Array.from({ length: count }, (_, index) => formatCalendarDate(addDays(start, index)));
}

function formatRangeLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${format(start, "d", { locale: es })} – ${format(end, "d MMM yyyy", { locale: es })}`;
  }
  return `${format(start, "d MMM", { locale: es })} – ${format(end, "d MMM yyyy", { locale: es })}`;
}

/** Meses (año + mes 1-12) que cubre un rango visible. */
export function monthsCoveringRange(range: VisibleRange): CalendarMonthKey[] {
  const seen = new Set<string>();
  const months: CalendarMonthKey[] = [];
  let cursor = startOfMonth(parseCalendarDate(range.start));
  const last = startOfMonth(parseCalendarDate(range.end));

  while (cursor.getTime() <= last.getTime()) {
    const key = { year: cursor.getFullYear(), month: cursor.getMonth() + 1 };
    const id = `${key.year}-${key.month}`;
    if (!seen.has(id)) {
      seen.add(id);
      months.push(key);
    }
    cursor = addMonths(cursor, 1);
  }

  return months;
}

/** Desplaza la fecha ancla una unidad de la vista actual. */
export function shiftAnchor(
  view: CalendarView,
  anchor: CalendarDate,
  direction: 1 | -1,
): CalendarDate {
  const date = parseCalendarDate(anchor);
  if (view === "day") return formatCalendarDate(addDays(date, direction));
  if (view === "week") return formatCalendarDate(addDays(date, 7 * direction));
  return formatCalendarDate(addMonths(date, direction));
}

/* ------------------------- Conversión hacia la API ------------------------- */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Convierte fecha + hora **locales de la empresa** en el ISO-8601 con offset que
 * espera el backend. Ej.: ("2026-08-10", "15:00", "America/Bogota")
 *      → "2026-08-10T15:00:00-05:00"
 */
export function toApiDateTime(
  date: CalendarDate,
  time: string,
  timeZone: string,
): string | null {
  if (!isValidCalendarDate(date) || !TIME_PATTERN.test(time)) return null;

  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const zoned = new TZDate(year, month - 1, day, hours, minutes, 0, 0, timeZone);

  if (!isValid(zoned)) return null;
  return format(zoned, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/** Inverso de `toApiDateTime`: parte un ISO en los campos del formulario. */
export function splitApiDateTime(
  value: string | null | undefined,
  timeZone: string,
): { date: CalendarDate; time: string } | null {
  const date = parseApiDate(value);
  if (!date) return null;
  const zoned = toZoned(date, timeZone);
  return {
    date: format(zoned, CALENDAR_DATE_FORMAT),
    time: format(zoned, "HH:mm"),
  };
}

/** Suma minutos a una hora `HH:mm`; devuelve la hora y cuántos días avanzó. */
export function addMinutesToTime(
  time: string,
  minutesToAdd: number,
): { time: string; dayOffset: number } {
  if (!TIME_PATTERN.test(time)) return { time, dayOffset: 0 };
  const [hours, minutes] = time.split(":").map(Number);
  const total = hours * 60 + minutes + minutesToAdd;
  const dayOffset = Math.floor(total / (24 * 60));
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mm = String(normalized % 60).padStart(2, "0");
  return { time: `${hh}:${mm}`, dayOffset };
}

export function shiftCalendarDate(date: CalendarDate, days: number): CalendarDate {
  return formatCalendarDate(addDays(parseCalendarDate(date), days));
}

/** "08:30" → "8:30 a. m." (para etiquetas de la rejilla horaria). */
export function formatTimeLabel(time: string): string {
  if (!TIME_PATTERN.test(time)) return time;
  const [hours, minutes] = time.split(":").map(Number);
  return withMeridiem(new Date(2000, 0, 1, hours, minutes));
}

/** "8 a. m." */
export function formatHourLabel(hour: number): string {
  const normalized = ((hour % 12) + 12) % 12 || 12;
  return `${normalized} ${hour < 12 ? "a. m." : "p. m."}`;
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Nombres cortos de los días de la semana, empezando en lunes. */
export const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, index) =>
  capitalize(format(addDays(startOfWeek(new Date(2024, 0, 1), WEEK_OPTIONS), index), "EEE", { locale: es })),
);
