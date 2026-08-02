import type {
  AgendaEvent,
  CalendarMonthKey,
  CancellationSource,
  EventHistoryEntry,
  EventStatus,
  EventType,
  NoShowType,
} from "@/features/agenda/types";
import { apiClient } from "@/lib/api/client";

import { normalizeEvent, normalizeEventList, normalizeHistory } from "./normalizers";

/**
 * Capa de acceso a eventos. Ningún componente llama a `fetch` directamente.
 *
 * Rutas usadas (todas documentadas en frontend_endpoints.md):
 *   GET    /calendar/day|week|month/
 *   GET    /events/            (listado filtrado)
 *   POST   /events/
 *   GET    /events/{id}/
 *   PATCH  /events/{id}/
 *   POST   /events/{id}/confirm|start|complete|cancel|no-show|reschedule|reassign/
 *   GET    /events/{id}/history/
 */

function ensureEvent(payload: unknown, context: string): AgendaEvent {
  const event = normalizeEvent(payload);
  if (!event) {
    throw new Error(
      `La respuesta de ${context} no tiene el formato esperado de evento. Revisa el contrato del backend.`,
    );
  }
  return event;
}

/* -------------------------------- Consultas -------------------------------- */

export async function fetchCalendarDay(
  date: string,
  signal?: AbortSignal,
): Promise<AgendaEvent[]> {
  const data = await apiClient.get<unknown>("calendar/day", {
    searchParams: { date },
    signal,
  });
  return normalizeEventList(data);
}

export async function fetchCalendarWeek(
  startDate: string,
  signal?: AbortSignal,
): Promise<AgendaEvent[]> {
  const data = await apiClient.get<unknown>("calendar/week", {
    searchParams: { start_date: startDate },
    signal,
  });
  return normalizeEventList(data);
}

export async function fetchCalendarMonth(
  { year, month }: CalendarMonthKey,
  signal?: AbortSignal,
): Promise<AgendaEvent[]> {
  const data = await apiClient.get<unknown>("calendar/month", {
    searchParams: { year, month },
    signal,
  });
  return normalizeEventList(data);
}

export interface EventListFilters {
  advisor?: string | null;
  status?: EventStatus | null;
  /** Sólo `start_at__gte` está documentado como filtro de rango. */
  startAtGte?: string | null;
  page?: number;
}

export async function fetchEvents(
  filters: EventListFilters,
  signal?: AbortSignal,
): Promise<AgendaEvent[]> {
  const data = await apiClient.get<unknown>("events", {
    searchParams: {
      advisor: filters.advisor ?? undefined,
      status: filters.status ?? undefined,
      start_at__gte: filters.startAtGte ?? undefined,
      page: filters.page,
    },
    signal,
  });
  return normalizeEventList(data);
}

export async function fetchEvent(
  eventId: string,
  signal?: AbortSignal,
): Promise<AgendaEvent> {
  const data = await apiClient.get<unknown>(`events/${eventId}`, { signal });
  return ensureEvent(data, `GET /events/${eventId}/`);
}

export async function fetchEventHistory(
  eventId: string,
  signal?: AbortSignal,
): Promise<EventHistoryEntry[]> {
  const data = await apiClient.get<unknown>(`events/${eventId}/history`, { signal });
  return normalizeHistory(data);
}

/* -------------------------------- Mutaciones ------------------------------- */

/**
 * Payload de creación. Las claves son exactamente las documentadas por el
 * backend (`advisor`, `client`, no `advisor_id`/`client_id`).
 * `company_id`, `created_by_id` y `updated_by_id` NUNCA se envían: la empresa la
 * resuelve el backend desde la identidad autenticada.
 */
export interface EventWritePayload {
  advisor?: string;
  client?: string | null;
  event_type: EventType;
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  timezone: string;
  location?: string;
  meeting_url?: string;
  property_external_id?: string;
  property_code?: string;
  property_title?: string;
  property_address?: string;
  property_url?: string;
  requires_confirmation?: boolean;
}

export async function createEvent(payload: EventWritePayload): Promise<AgendaEvent> {
  const data = await apiClient.post<unknown>("events", { body: payload });
  return ensureEvent(data, "POST /events/");
}

/** Edición parcial: sólo viajan los campos realmente modificados. */
export async function updateEvent(
  eventId: string,
  payload: Partial<EventWritePayload>,
): Promise<AgendaEvent> {
  const data = await apiClient.patch<unknown>(`events/${eventId}`, { body: payload });
  return ensureEvent(data, `PATCH /events/${eventId}/`);
}

/* ------------------------------ Transiciones ------------------------------- */

export async function confirmEvent(eventId: string): Promise<AgendaEvent> {
  const data = await apiClient.post<unknown>(`events/${eventId}/confirm`, { body: {} });
  return ensureEvent(data, `POST /events/${eventId}/confirm/`);
}

export async function startEvent(eventId: string): Promise<AgendaEvent> {
  const data = await apiClient.post<unknown>(`events/${eventId}/start`, { body: {} });
  return ensureEvent(data, `POST /events/${eventId}/start/`);
}

export async function completeEvent(
  eventId: string,
  completionNotes?: string,
): Promise<AgendaEvent> {
  const body = completionNotes?.trim() ? { completion_notes: completionNotes.trim() } : {};
  const data = await apiClient.post<unknown>(`events/${eventId}/complete`, { body });
  return ensureEvent(data, `POST /events/${eventId}/complete/`);
}

/** Payload documentado: `{reason, cancellation_source}`. */
export async function cancelEvent(
  eventId: string,
  params: { reason: string; cancellationSource: CancellationSource },
): Promise<AgendaEvent> {
  const data = await apiClient.post<unknown>(`events/${eventId}/cancel`, {
    body: { reason: params.reason, cancellation_source: params.cancellationSource },
  });
  return ensureEvent(data, `POST /events/${eventId}/cancel/`);
}

export async function markNoShow(
  eventId: string,
  params: { noShowType: NoShowType; notes?: string },
): Promise<AgendaEvent> {
  const body: Record<string, string> = { no_show_type: params.noShowType };
  if (params.notes?.trim()) body.notes = params.notes.trim();

  const data = await apiClient.post<unknown>(`events/${eventId}/no-show`, { body });
  return ensureEvent(data, `POST /events/${eventId}/no-show/`);
}

/**
 * Reprogramación. El backend crea un evento NUEVO y deja el original en
 * `RESCHEDULED`; por eso no se implementa como una edición del original.
 */
export async function rescheduleEvent(
  eventId: string,
  params: { startAt: string; endAt: string; advisorId?: string | null },
): Promise<AgendaEvent> {
  const body: Record<string, string> = {
    start_at: params.startAt,
    end_at: params.endAt,
  };
  if (params.advisorId) body.advisor = params.advisorId;

  const data = await apiClient.post<unknown>(`events/${eventId}/reschedule`, { body });
  return ensureEvent(data, `POST /events/${eventId}/reschedule/`);
}

export async function reassignEvent(
  eventId: string,
  advisorId: string,
): Promise<AgendaEvent> {
  const data = await apiClient.post<unknown>(`events/${eventId}/reassign`, {
    body: { advisor: advisorId },
  });
  return ensureEvent(data, `POST /events/${eventId}/reassign/`);
}
