import type {
  CalendarView,
  CancellationSource,
  EventStatus,
  EventType,
  NoShowType,
} from "./types";

/**
 * Único lugar donde se traducen y estilan tipos y estados.
 * El valor enviado al backend es SIEMPRE el enum original.
 */

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  PROPERTY_VISIT: "Visita a inmueble",
  CLIENT_MEETING: "Reunión con cliente",
  PHONE_CALL: "Llamada",
  INTERNAL_MEETING: "Reunión interna",
  PERSONAL_BLOCK: "Bloqueo personal",
  LUNCH: "Almuerzo",
  VACATION: "Vacaciones",
  OTHER: "Otro",
};

/* Los iconos de tipo y estado viven en components/agenda/event-icons.tsx:
   se resuelven con un `switch` sobre referencias estáticas de lucide-react. */

/** Clases Tailwind por tipo: fondo suave para la píldora y color de la barra del evento. */
export const EVENT_TYPE_STYLES: Record<
  EventType,
  { badge: string; accent: string; chip: string }
> = {
  PROPERTY_VISIT: {
    badge: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-400/30",
    accent: "bg-sky-500",
    chip: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-100",
  },
  CLIENT_MEETING: {
    badge: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-400/30",
    accent: "bg-violet-500",
    chip: "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-100",
  },
  PHONE_CALL: {
    badge: "bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-950 dark:text-teal-300 dark:ring-teal-400/30",
    accent: "bg-teal-500",
    chip: "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-900 dark:bg-teal-950/60 dark:text-teal-100",
  },
  INTERNAL_MEETING: {
    badge: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-400/30",
    accent: "bg-indigo-500",
    chip: "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100",
  },
  PERSONAL_BLOCK: {
    badge: "bg-zinc-100 text-zinc-700 ring-zinc-600/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-400/30",
    accent: "bg-zinc-400",
    chip: "border-zinc-200 bg-zinc-100 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100",
  },
  LUNCH: {
    badge: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-400/30",
    accent: "bg-amber-500",
    chip: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100",
  },
  VACATION: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/30",
    accent: "bg-emerald-500",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100",
  },
  OTHER: {
    badge: "bg-slate-100 text-slate-700 ring-slate-600/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/30",
    accent: "bg-slate-400",
    chip: "border-slate-200 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100",
  },
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  NO_SHOW: "Inasistencia",
  RESCHEDULED: "Reprogramado",
};

/**
 * El estado nunca se comunica solo con color: cada uno tiene etiqueta e icono
 * (requisito de accesibilidad §12 y §29).
 */
export const EVENT_STATUS_STYLES: Record<EventStatus, { badge: string; dot: string }> = {
  PENDING: {
    badge: "bg-amber-50 text-amber-800 ring-amber-600/30 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-400/30",
    dot: "bg-amber-500",
  },
  CONFIRMED: {
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-600/30 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-400/30",
    dot: "bg-emerald-500",
  },
  IN_PROGRESS: {
    badge: "bg-blue-50 text-blue-800 ring-blue-600/30 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-400/30",
    dot: "bg-blue-500",
  },
  COMPLETED: {
    badge: "bg-zinc-100 text-zinc-800 ring-zinc-600/30 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-400/30",
    dot: "bg-zinc-500",
  },
  CANCELLED: {
    badge: "bg-rose-50 text-rose-800 ring-rose-600/30 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-400/30",
    dot: "bg-rose-500",
  },
  NO_SHOW: {
    badge: "bg-orange-50 text-orange-800 ring-orange-600/30 dark:bg-orange-950 dark:text-orange-200 dark:ring-orange-400/30",
    dot: "bg-orange-500",
  },
  RESCHEDULED: {
    badge: "bg-purple-50 text-purple-800 ring-purple-600/30 dark:bg-purple-950 dark:text-purple-200 dark:ring-purple-400/30",
    dot: "bg-purple-500",
  },
};

export const NO_SHOW_TYPE_LABELS: Record<NoShowType, string> = {
  CLIENT_NO_SHOW: "El cliente no asistió",
  ADVISOR_NO_SHOW: "El asesor no asistió",
  UNKNOWN: "Sin determinar",
};

export const CANCELLATION_SOURCE_LABELS: Record<CancellationSource, string> = {
  CLIENT: "Cliente",
  ADVISOR: "Asesor",
  COMPANY: "Inmobiliaria",
  SYSTEM: "Sistema",
};

export const CALENDAR_VIEW_LABELS: Record<CalendarView, string> = {
  month: "Mes",
  week: "Semana",
  day: "Día",
};

/** Tipos que involucran a un cliente. */
export const CLIENT_RELEVANT_TYPES = new Set<EventType>([
  "PROPERTY_VISIT",
  "CLIENT_MEETING",
  "PHONE_CALL",
]);

/** Tipos personales: no muestran cliente ni inmueble. */
export const PERSONAL_TYPES = new Set<EventType>(["PERSONAL_BLOCK", "LUNCH", "VACATION"]);

/** Duración inicial del formulario cuando el backend no entrega configuración. */
export const FALLBACK_EVENT_DURATION_MINUTES = 60;

/** Franja horaria visible por defecto en las vistas de día y semana. */
export const DAY_GRID_START_HOUR = 6;
export const DAY_GRID_END_HOUR = 21;

export function labelForEventType(value: string | null | undefined): string {
  if (!value) return "Sin tipo";
  return EVENT_TYPE_LABELS[value as EventType] ?? value;
}

export function labelForEventStatus(value: string | null | undefined): string {
  if (!value) return "Sin estado";
  return EVENT_STATUS_LABELS[value as EventStatus] ?? value;
}

export function labelForNoShowType(value: string | null | undefined): string {
  if (!value) return "Sin determinar";
  return NO_SHOW_TYPE_LABELS[value as NoShowType] ?? value;
}

export function labelForCancellationSource(value: string | null | undefined): string {
  if (!value) return "—";
  return CANCELLATION_SOURCE_LABELS[value as CancellationSource] ?? value;
}
