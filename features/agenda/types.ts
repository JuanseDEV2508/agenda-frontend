export const EVENT_TYPES = [
  "PROPERTY_VISIT",
  "CLIENT_MEETING",
  "PHONE_CALL",
  "INTERNAL_MEETING",
  "PERSONAL_BLOCK",
  "LUNCH",
  "VACATION",
  "OTHER",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "RESCHEDULED",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const NO_SHOW_TYPES = ["CLIENT_NO_SHOW", "ADVISOR_NO_SHOW", "UNKNOWN"] as const;
export type NoShowType = (typeof NO_SHOW_TYPES)[number];

export const CANCELLATION_SOURCES = ["CLIENT", "ADVISOR", "COMPANY", "SYSTEM"] as const;
export type CancellationSource = (typeof CANCELLATION_SOURCES)[number];

export const CALENDAR_VIEWS = ["month", "week", "day"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/** Referencia compacta a un asesor tal y como puede venir anidada en un evento. */
export interface AdvisorRef {
  id: string;
  name: string;
}

export interface ClientRef {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

/** Asesor completo (`GET /advisors/`). */
export interface Advisor {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  code?: string | null;
  isActive: boolean;
  /** UUID del usuario asociado, cuando el backend lo devuelve. */
  userId?: string | null;
  role?: string | null;
}

/** Cliente completo (`GET /clients/`). */
export interface Client {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
}

/** Evento de agenda normalizado desde la API. */
export interface AgendaEvent {
  id: string;
  title: string;
  eventType: EventType | null;
  status: EventStatus | null;
  /** ISO-8601 con offset, tal y como lo entrega el backend. */
  startAt: string;
  endAt: string | null;
  timezone: string | null;

  advisor: AdvisorRef | null;
  client: ClientRef | null;

  description?: string | null;
  location?: string | null;
  meetingUrl?: string | null;

  propertyExternalId?: string | null;
  propertyCode?: string | null;
  propertyTitle?: string | null;
  propertyAddress?: string | null;
  propertyUrl?: string | null;

  source?: string | null;
  assignedAutomatically?: boolean | null;
  requiresConfirmation?: boolean | null;

  createdAt?: string | null;
  updatedAt?: string | null;

  completionNotes?: string | null;
  cancellationReason?: string | null;
  cancellationSource?: string | null;
  cancelledAt?: string | null;
  noShowType?: NoShowType | string | null;
  noShowNotes?: string | null;
  rescheduledFromId?: string | null;
  rescheduledToId?: string | null;
  rescheduledAt?: string | null;
}

export interface EventHistoryEntry {
  id: string;
  action: string;
  createdAt: string | null;
  actor: string | null;
  source: string | null;
  notes: string | null;
}

/** Bloque de disponibilidad configurado (`GET /advisor-availabilities/`). */
export interface AvailabilityBlock {
  id: string;
  advisorId: string | null;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
  isActive: boolean;
}

/** `GET /scheduling-configurations/default/` — todos los campos son opcionales. */
export interface SchedulingConfiguration {
  defaultDurationMinutes: number | null;
  bufferMinutes: number | null;
  maxEventsPerDay: number | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface CalendarMonthKey {
  year: number;
  month: number;
}

/** Filtros de agenda; se serializan también en la URL. */
export interface AgendaFilters {
  advisorId: string | null;
  status: EventStatus | null;
  eventType: EventType | null;
  search: string;
}

export const EMPTY_AGENDA_FILTERS: AgendaFilters = {
  advisorId: null,
  status: null,
  eventType: null,
  search: "",
};
