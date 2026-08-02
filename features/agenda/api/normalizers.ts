import type {
  Advisor,
  AdvisorRef,
  AgendaEvent,
  AvailabilityBlock,
  Client,
  ClientRef,
  EventHistoryEntry,
  EventStatus,
  EventType,
  SchedulingConfiguration,
} from "@/features/agenda/types";
import { EVENT_STATUSES, EVENT_TYPES } from "@/features/agenda/types";

/**
 * Normalizadores tolerantes.
 *
 * El backend no publica el esquema de todas sus respuestas (ver
 * docs/frontend-api-analysis.md §4.5). En lugar de asumir una única forma, se
 * aceptan las variantes razonables y se descarta lo que no se entiende.
 * Nunca se inventan valores: lo ausente queda como `null`.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (typeof value === "number") return String(value);
  return null;
}

export function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

/** Primer valor no vacío entre varias claves candidatas. */
export function pick(source: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(source[key]);
    if (value !== null) return value;
  }
  return null;
}

function composeName(source: Record<string, unknown>): string | null {
  const direct = pick(source, "name", "full_name", "display_name");
  if (direct) return direct;

  const first = pick(source, "first_name");
  const last = pick(source, "last_name");
  const composed = [first, last].filter(Boolean).join(" ").trim();
  return composed !== "" ? composed : null;
}

function asEventType(value: unknown): EventType | null {
  const raw = asString(value);
  return raw && (EVENT_TYPES as readonly string[]).includes(raw) ? (raw as EventType) : null;
}

function asEventStatus(value: unknown): EventStatus | null {
  const raw = asString(value);
  return raw && (EVENT_STATUSES as readonly string[]).includes(raw)
    ? (raw as EventStatus)
    : null;
}

/**
 * Extrae la lista de elementos de una respuesta de listado.
 * Acepta: array plano, paginación DRF (`results`), `{events: []}` y objeto
 * agrupado por fecha (`{"2026-08-10": [...]}`).
 */
export function extractResults(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.events)) return payload.events;
  if (Array.isArray(payload.data)) return payload.data;

  // Agrupado por fecha: { "2026-08-10": [ ...eventos ] }
  const groups = Object.values(payload).filter(Array.isArray) as unknown[][];
  if (groups.length > 0 && groups.length === Object.keys(payload).length) {
    return groups.flat();
  }

  return [];
}

export function extractCount(payload: unknown, fallback: number): number {
  if (isRecord(payload)) {
    const count = asNumber(payload.count);
    if (count !== null) return count;
  }
  return fallback;
}

/* --------------------------------- Asesor --------------------------------- */

/**
 * Referencia a asesor: acepta un UUID suelto o un objeto anidado.
 *
 * El serializador `EventList` del backend devuelve `advisor` como UUID y el
 * nombre en un campo hermano (`advisor_name`), que llega aquí como
 * `fallbackName`.
 */
export function normalizeAdvisorRef(
  value: unknown,
  fallbackName?: string | null,
): AdvisorRef | null {
  if (typeof value === "string" && value.trim() !== "") {
    return { id: value, name: fallbackName ?? "" };
  }
  if (!isRecord(value)) return null;

  const id = pick(value, "id", "uuid", "advisor_id");
  if (!id) return null;

  const nestedUser = isRecord(value.user) ? value.user : null;
  const name = composeName(value) ?? (nestedUser ? composeName(nestedUser) : null);

  return { id, name: name ?? fallbackName ?? "" };
}

export function normalizeAdvisor(raw: unknown): Advisor | null {
  if (!isRecord(raw)) return null;
  const id = pick(raw, "id", "uuid");
  if (!id) return null;

  const nestedUser = isRecord(raw.user) ? raw.user : null;
  const name = composeName(raw) ?? (nestedUser ? composeName(nestedUser) : null);

  return {
    id,
    name: name ?? "Asesor sin nombre",
    email: pick(raw, "email") ?? (nestedUser ? pick(nestedUser, "email") : null),
    phone: pick(raw, "phone", "phone_number") ?? null,
    code: pick(raw, "code", "advisor_code", "employee_code"),
    isActive: asBoolean(raw.is_active) ?? true,
    userId: pick(raw, "user_id") ?? (nestedUser ? pick(nestedUser, "id") : null),
    role: pick(raw, "role") ?? (nestedUser ? pick(nestedUser, "role") : null),
  };
}

/* -------------------------------- Cliente --------------------------------- */

/** Igual que `normalizeAdvisorRef`: el listado envía el nombre en `client_name`. */
export function normalizeClientRef(
  value: unknown,
  fallbackName?: string | null,
): ClientRef | null {
  if (typeof value === "string" && value.trim() !== "") {
    return { id: value, name: fallbackName ?? "" };
  }
  if (!isRecord(value)) return null;

  const id = pick(value, "id", "uuid", "client_id");
  if (!id) return null;

  return {
    id,
    name: composeName(value) ?? fallbackName ?? "",
    phone: pick(value, "phone", "phone_number", "normalized_phone"),
    email: pick(value, "email"),
  };
}

export function normalizeClient(raw: unknown): Client | null {
  if (!isRecord(raw)) return null;
  const id = pick(raw, "id", "uuid");
  if (!id) return null;

  return {
    id,
    name: composeName(raw) ?? "Cliente sin nombre",
    firstName: pick(raw, "first_name"),
    lastName: pick(raw, "last_name"),
    phone: pick(raw, "phone", "phone_number", "normalized_phone"),
    email: pick(raw, "email"),
    isActive: asBoolean(raw.is_active) ?? true,
  };
}

/* --------------------------------- Evento --------------------------------- */

export function normalizeEvent(raw: unknown): AgendaEvent | null {
  if (!isRecord(raw)) return null;

  const id = pick(raw, "id", "uuid");
  const startAt = pick(raw, "start_at", "start", "start_datetime");
  if (!id || !startAt) return null;

  return {
    id,
    title: pick(raw, "title", "subject") ?? "Evento sin título",
    eventType: asEventType(raw.event_type ?? raw.type),
    status: asEventStatus(raw.status),
    startAt,
    endAt: pick(raw, "end_at", "end", "end_datetime"),
    timezone: pick(raw, "timezone", "time_zone"),

    advisor: normalizeAdvisorRef(
      raw.advisor ?? raw.advisor_detail ?? raw.advisor_id,
      pick(raw, "advisor_name"),
    ),
    client: normalizeClientRef(
      raw.client ?? raw.client_detail ?? raw.client_id,
      pick(raw, "client_name"),
    ),

    description: pick(raw, "description", "notes"),
    location: pick(raw, "location", "address"),
    meetingUrl: pick(raw, "meeting_url"),

    propertyExternalId: pick(raw, "property_external_id"),
    propertyCode: pick(raw, "property_code"),
    propertyTitle: pick(raw, "property_title"),
    propertyAddress: pick(raw, "property_address"),
    propertyUrl: pick(raw, "property_url"),

    source: pick(raw, "source", "origin"),
    assignedAutomatically: asBoolean(raw.assigned_automatically),
    requiresConfirmation: asBoolean(raw.requires_confirmation),

    createdAt: pick(raw, "created_at"),
    updatedAt: pick(raw, "updated_at"),

    completionNotes: pick(raw, "completion_notes"),
    cancellationReason: pick(raw, "cancellation_reason", "reason"),
    cancellationSource: pick(raw, "cancellation_source"),
    cancelledAt: pick(raw, "cancelled_at"),
    noShowType: pick(raw, "no_show_type"),
    noShowNotes: pick(raw, "no_show_notes"),
    rescheduledFromId: pick(raw, "rescheduled_from", "rescheduled_from_id", "original_event"),
    rescheduledToId: pick(raw, "rescheduled_to", "rescheduled_to_id", "new_event"),
    rescheduledAt: pick(raw, "rescheduled_at"),
  };
}

export function normalizeEventList(payload: unknown): AgendaEvent[] {
  return extractResults(payload)
    .map(normalizeEvent)
    .filter((event): event is AgendaEvent => event !== null);
}

/* -------------------------------- Historial -------------------------------- */

export function normalizeHistoryEntry(raw: unknown, index: number): EventHistoryEntry | null {
  if (!isRecord(raw)) return null;

  const action = pick(raw, "action", "event_type", "change_type", "type");
  if (!action) return null;

  const actorSource = isRecord(raw.actor)
    ? raw.actor
    : isRecord(raw.performed_by)
      ? raw.performed_by
      : isRecord(raw.user)
        ? raw.user
        : null;

  return {
    id: pick(raw, "id", "uuid") ?? `history-${index}`,
    action,
    createdAt: pick(raw, "created_at", "timestamp", "performed_at"),
    actor: actorSource ? composeName(actorSource) : pick(raw, "actor", "performed_by", "user"),
    source: pick(raw, "source"),
    notes: pick(raw, "notes", "description", "reason"),
  };
}

export function normalizeHistory(payload: unknown): EventHistoryEntry[] {
  return extractResults(payload)
    .map((item, index) => normalizeHistoryEntry(item, index))
    .filter((entry): entry is EventHistoryEntry => entry !== null);
}

/* ------------------------------ Disponibilidad ----------------------------- */

export function normalizeAvailabilityBlock(raw: unknown): AvailabilityBlock | null {
  if (!isRecord(raw)) return null;
  const id = pick(raw, "id", "uuid");
  if (!id) return null;

  const advisorRef = normalizeAdvisorRef(raw.advisor ?? raw.advisor_id);

  return {
    id,
    advisorId: advisorRef?.id ?? null,
    weekday: asNumber(raw.weekday ?? raw.day_of_week),
    startTime: pick(raw, "start_time", "start"),
    endTime: pick(raw, "end_time", "end"),
    isActive: asBoolean(raw.is_active) ?? true,
  };
}

export function normalizeSchedulingConfiguration(raw: unknown): SchedulingConfiguration {
  if (!isRecord(raw)) {
    return { defaultDurationMinutes: null, bufferMinutes: null, maxEventsPerDay: null };
  }

  return {
    defaultDurationMinutes: asNumber(
      raw.default_duration_minutes ?? raw.default_event_duration_minutes,
    ),
    bufferMinutes: asNumber(raw.buffer_minutes ?? raw.buffer_time_minutes),
    maxEventsPerDay: asNumber(raw.max_events_per_day ?? raw.max_daily_events),
  };
}
