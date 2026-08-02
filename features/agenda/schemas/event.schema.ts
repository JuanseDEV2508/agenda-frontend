import { z } from "zod";

import { CLIENT_RELEVANT_TYPES, PERSONAL_TYPES } from "@/features/agenda/constants";
import { EVENT_TYPES, type AgendaEvent, type EventType } from "@/features/agenda/types";
import type { EventWritePayload } from "@/features/agenda/api/events.api";
import {
  addMinutesToTime,
  durationInMinutes,
  isValidCalendarDate,
  shiftCalendarDate,
  splitApiDateTime,
  toApiDateTime,
} from "@/lib/dates";

/**
 * Formulario de evento.
 *
 * La fecha y la hora se manejan por separado (mejor UX y mejor accesibilidad
 * que un `datetime-local`) y se combinan al enviar usando la zona horaria de la
 * inmobiliaria.
 */

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const optionalUrl = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (value === "") return true;
      try {
        const url = new URL(value);
        // Sólo http/https: evita `javascript:` y otros esquemas peligrosos.
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Ingresa una URL válida que empiece por http:// o https://" },
  );

export const eventFormSchema = z
  .object({
    advisorId: z.string().trim(),
    clientId: z.string().trim(),
    eventType: z.enum(EVENT_TYPES),
    title: z.string().trim().min(1, "El título es obligatorio.").max(255),
    description: z.string().trim().max(2000).default(""),
    startDate: z.string().refine(isValidCalendarDate, "Selecciona una fecha de inicio."),
    startTime: z.string().regex(TIME_REGEX, "Selecciona una hora de inicio."),
    endDate: z.string().refine(isValidCalendarDate, "Selecciona una fecha de finalización."),
    endTime: z.string().regex(TIME_REGEX, "Selecciona una hora de finalización."),
    location: z.string().trim().max(255).default(""),
    meetingUrl: optionalUrl.default(""),
    propertyExternalId: z.string().trim().max(120).default(""),
    propertyCode: z.string().trim().max(120).default(""),
    propertyTitle: z.string().trim().max(255).default(""),
    propertyAddress: z.string().trim().max(255).default(""),
    propertyUrl: optionalUrl.default(""),
    requiresConfirmation: z.boolean().default(false),
  })
  .superRefine((values, ctx) => {
    if (values.advisorId.trim() === "") {
      ctx.addIssue({
        code: "custom",
        path: ["advisorId"],
        message: "Selecciona el asesor responsable.",
      });
    }

    // `end_at` debe ser posterior a `start_at`.
    const start = `${values.startDate}T${values.startTime}`;
    const end = `${values.endDate}T${values.endTime}`;

    if (end <= start) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "La finalización debe ser posterior al inicio.",
      });
    }
  });

export type EventFormInput = z.input<typeof eventFormSchema>;
export type EventFormValues = z.output<typeof eventFormSchema>;

/** ¿El tipo de evento muestra los campos de cliente? */
export function showsClientFields(eventType: EventType): boolean {
  return !PERSONAL_TYPES.has(eventType) && eventType !== "INTERNAL_MEETING";
}

/** ¿El tipo de evento muestra la referencia externa del inmueble? */
export function showsPropertyFields(eventType: EventType): boolean {
  return eventType === "PROPERTY_VISIT";
}

/** El cliente es relevante, pero sólo el backend decide si es obligatorio. */
export function isClientRelevant(eventType: EventType): boolean {
  return CLIENT_RELEVANT_TYPES.has(eventType);
}

export interface EventFormDefaultsParams {
  timezone: string;
  advisorId?: string | null;
  date?: string;
  time?: string;
  durationMinutes: number;
}

/** Valores iniciales para crear un evento. */
export function buildCreateDefaults({
  advisorId,
  date,
  time,
  durationMinutes,
}: EventFormDefaultsParams): EventFormInput {
  const startDate = date && isValidCalendarDate(date) ? date : todayISO();
  const startTime = time && TIME_REGEX.test(time) ? time : nextRoundHour();
  const { time: endTime, dayOffset } = addMinutesToTime(startTime, durationMinutes);

  return {
    advisorId: advisorId ?? "",
    clientId: "",
    eventType: "PROPERTY_VISIT",
    title: "",
    description: "",
    startDate,
    startTime,
    endDate: dayOffset > 0 ? shiftCalendarDate(startDate, dayOffset) : startDate,
    endTime,
    location: "",
    meetingUrl: "",
    propertyExternalId: "",
    propertyCode: "",
    propertyTitle: "",
    propertyAddress: "",
    propertyUrl: "",
    requiresConfirmation: false,
  };
}

/** Valores iniciales para editar un evento existente. */
export function buildEditDefaults(
  event: AgendaEvent,
  timezone: string,
): EventFormInput {
  const start = splitApiDateTime(event.startAt, timezone);
  const end = splitApiDateTime(event.endAt, timezone) ?? start;

  return {
    advisorId: event.advisor?.id ?? "",
    clientId: event.client?.id ?? "",
    eventType: event.eventType ?? "OTHER",
    title: event.title ?? "",
    description: event.description ?? "",
    startDate: start?.date ?? todayISO(),
    startTime: start?.time ?? "09:00",
    endDate: end?.date ?? start?.date ?? todayISO(),
    endTime: end?.time ?? "10:00",
    location: event.location ?? "",
    meetingUrl: event.meetingUrl ?? "",
    propertyExternalId: event.propertyExternalId ?? "",
    propertyCode: event.propertyCode ?? "",
    propertyTitle: event.propertyTitle ?? "",
    propertyAddress: event.propertyAddress ?? "",
    propertyUrl: event.propertyUrl ?? "",
    requiresConfirmation: event.requiresConfirmation ?? false,
  };
}

/**
 * Convierte los valores del formulario en el payload del backend.
 *
 * - Sólo se envían los campos que el endpoint acepta.
 * - NUNCA se envía `company_id`, `created_by_id` ni `updated_by_id`.
 * - Los campos de cliente e inmueble se omiten cuando el tipo no los usa, para
 *   no arrastrar datos de un tipo anterior.
 */
export function toEventPayload(
  values: EventFormValues,
  timezone: string,
): EventWritePayload {
  const startAt = toApiDateTime(values.startDate, values.startTime, timezone);
  const endAt = toApiDateTime(values.endDate, values.endTime, timezone);

  if (!startAt || !endAt) {
    throw new Error("Las fechas del evento no son válidas.");
  }

  const payload: EventWritePayload = {
    advisor: values.advisorId,
    event_type: values.eventType,
    title: values.title,
    start_at: startAt,
    end_at: endAt,
    timezone,
  };

  if (values.description) payload.description = values.description;
  if (values.location) payload.location = values.location;
  if (values.meetingUrl) payload.meeting_url = values.meetingUrl;
  if (values.requiresConfirmation) payload.requires_confirmation = true;

  if (showsClientFields(values.eventType) && values.clientId) {
    payload.client = values.clientId;
  }

  if (showsPropertyFields(values.eventType)) {
    if (values.propertyExternalId) payload.property_external_id = values.propertyExternalId;
    if (values.propertyCode) payload.property_code = values.propertyCode;
    if (values.propertyTitle) payload.property_title = values.propertyTitle;
    if (values.propertyAddress) payload.property_address = values.propertyAddress;
    if (values.propertyUrl) payload.property_url = values.propertyUrl;
  }

  return payload;
}

/**
 * Diferencia entre el payload original y el nuevo: en una edición sólo viajan
 * los campos realmente modificados, para no sobrescribir lo que no se tocó.
 */
export function diffEventPayload(
  original: EventWritePayload,
  next: EventWritePayload,
): Partial<EventWritePayload> {
  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(original), ...Object.keys(next)]);

  for (const key of keys) {
    const originalValue = original[key as keyof EventWritePayload];
    const nextValue = next[key as keyof EventWritePayload];

    if (originalValue === nextValue) continue;

    // Un campo que desaparece se envía vacío para que el backend lo limpie.
    patch[key] = nextValue ?? "";
  }

  return patch as Partial<EventWritePayload>;
}

export function computeDurationLabelMinutes(values: {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;
}): number | null {
  const start = toApiDateTime(values.startDate, values.startTime, values.timezone);
  const end = toApiDateTime(values.endDate, values.endTime, values.timezone);
  if (!start || !end) return null;
  return durationInMinutes(start, end);
}

function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function nextRoundHour(): string {
  const now = new Date();
  const hour = Math.min(now.getHours() + 1, 23);
  return `${String(hour).padStart(2, "0")}:00`;
}
