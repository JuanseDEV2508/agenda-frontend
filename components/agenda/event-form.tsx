"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Info } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/feedback";
import { queryKeys } from "@/config/query-keys";
import { fetchDefaultSchedulingConfiguration } from "@/features/agenda/api/availability.api";
import { fetchClient } from "@/features/agenda/api/clients.api";
import type { EventWritePayload } from "@/features/agenda/api/events.api";
import {
  EVENT_TYPE_LABELS,
  FALLBACK_EVENT_DURATION_MINUTES,
} from "@/features/agenda/constants";
import { advisorLabel, useAdvisors } from "@/features/agenda/hooks/use-advisors";
import {
  buildCreateDefaults,
  buildEditDefaults,
  computeDurationLabelMinutes,
  diffEventPayload,
  eventFormSchema,
  isClientRelevant,
  showsClientFields,
  showsPropertyFields,
  toEventPayload,
  type EventFormInput,
  type EventFormValues,
} from "@/features/agenda/schemas/event.schema";
import {
  EVENT_TYPES,
  type AgendaEvent,
  type Client,
  type EventType,
} from "@/features/agenda/types";
import { useSession } from "@/features/auth/hooks/use-session";
import { ApiError, isApiError } from "@/lib/api/errors";
import { addMinutesToTime, formatDuration, formatTimezoneLabel, shiftCalendarDate } from "@/lib/dates";
import { canSelectAdvisor } from "@/lib/permissions";

import { ClientPicker } from "./client-picker";

/**
 * Formulario de evento, compartido por creación y edición (§16).
 *
 * Reglas destacadas:
 *  - Un ADVISOR no ve selector de asesor: queda fijado a su propio perfil.
 *  - Los campos de cliente e inmueble aparecen según el tipo de evento y no se
 *    envían cuando el tipo no los usa.
 *  - Los conflictos de horario los decide el backend; el formulario permanece
 *    abierto con los datos escritos para poder corregir (§14).
 */

/** Traducción de nombres de campo del backend a campos del formulario. */
const SERVER_FIELD_MAP: Record<string, keyof EventFormInput> = {
  advisor: "advisorId",
  advisor_id: "advisorId",
  client: "clientId",
  client_id: "clientId",
  event_type: "eventType",
  title: "title",
  description: "description",
  start_at: "startTime",
  end_at: "endTime",
  location: "location",
  meeting_url: "meetingUrl",
  property_external_id: "propertyExternalId",
  property_code: "propertyCode",
  property_title: "propertyTitle",
  property_address: "propertyAddress",
  property_url: "propertyUrl",
  requires_confirmation: "requiresConfirmation",
};

export interface EventFormProps {
  mode: "create" | "edit";
  event?: AgendaEvent | null;
  initialDate?: string;
  initialTime?: string;
  isSubmitting: boolean;
  submitError: unknown;
  onDirtyChange?: (isDirty: boolean) => void;
  onCancel: () => void;
  onSubmit: (payload: EventWritePayload | Partial<EventWritePayload>) => void;
}

export function EventForm({
  mode,
  event,
  initialDate,
  initialTime,
  isSubmitting,
  submitError,
  onDirtyChange,
  onCancel,
  onSubmit,
}: EventFormProps) {
  const { user, timezone } = useSession();
  const { advisors, isEnabled: canPickAdvisor } = useAdvisors();

  // Duración por defecto: la del backend si está disponible (sólo ADMIN puede
  // consultarla), si no un valor de interfaz. No es un dato inventado del backend.
  const { data: schedulingConfig } = useQuery({
    queryKey: queryKeys.schedulingConfig,
    queryFn: ({ signal }) => fetchDefaultSchedulingConfiguration(signal),
    staleTime: 10 * 60_000,
    retry: false,
  });

  const defaultDuration =
    schedulingConfig?.defaultDurationMinutes ?? FALLBACK_EVENT_DURATION_MINUTES;

  const defaultValues = useMemo<EventFormInput>(() => {
    if (mode === "edit" && event) return buildEditDefaults(event, timezone);
    return buildCreateDefaults({
      timezone,
      // Un asesor sólo puede crear para sí mismo: se preselecciona su perfil.
      advisorId: canSelectAdvisor(user) ? null : user.advisorId,
      date: initialDate,
      time: initialTime,
      durationMinutes: defaultDuration,
    });
    // `defaultDuration` puede llegar después; el efecto de abajo ajusta el fin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, event, timezone, user, initialDate, initialTime]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<EventFormInput, unknown, EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // `useWatch` en lugar de `watch()`: se suscribe por campo y es compatible con
  // el React Compiler.
  const eventType = useWatch({ control, name: "eventType" }) as EventType;
  const startDate = useWatch({ control, name: "startDate" });
  const startTime = useWatch({ control, name: "startTime" });
  const endDate = useWatch({ control, name: "endDate" });
  const endTime = useWatch({ control, name: "endTime" });
  const clientId = useWatch({ control, name: "clientId" });
  const advisorId = useWatch({ control, name: "advisorId" });

  /* Duración: se mantiene la elegida por el usuario al mover el inicio. */
  const durationRef = useRef(defaultDuration);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const minutes = computeDurationLabelMinutes({
      startDate,
      startTime,
      endDate,
      endTime,
      timezone,
    });
    if (minutes !== null && minutes > 0) durationRef.current = minutes;
  }, [endDate, endTime, startDate, startTime, timezone]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Al cambiar el inicio se recalcula el fin conservando la duración actual.
    const { time, dayOffset } = addMinutesToTime(startTime, durationRef.current);
    setValue("endTime", time, { shouldValidate: true });
    setValue("endDate", dayOffset > 0 ? shiftCalendarDate(startDate, dayOffset) : startDate, {
      shouldValidate: true,
    });
    // Sólo reacciona al inicio, nunca al fin (evita un bucle).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, startTime]);

  /*
   * Cliente seleccionado. Se deriva en lugar de sincronizarse con un efecto:
   *  1. el que el usuario acaba de elegir en el buscador,
   *  2. el que ya traía el evento en edición,
   *  3. el que se consulta al backend cuando sólo se conoce el id.
   */
  const [pickedClient, setPickedClient] = useState<Client | null>(null);

  const eventClient = useMemo<Client | null>(
    () =>
      event?.client?.id
        ? {
            id: event.client.id,
            name: event.client.name || "Cliente seleccionado",
            phone: event.client.phone ?? null,
            email: event.client.email ?? null,
            isActive: true,
          }
        : null,
    [event],
  );

  const isClientKnown =
    pickedClient?.id === clientId || (eventClient?.id === clientId && clientId !== "");

  const { data: fetchedClient } = useQuery({
    queryKey: queryKeys.clients.detail(clientId),
    queryFn: ({ signal }) => fetchClient(clientId, signal),
    enabled: Boolean(clientId) && !isClientKnown,
    retry: false,
  });

  const selectedClient: Client | null = !clientId
    ? null
    : pickedClient?.id === clientId
      ? pickedClient
      : eventClient?.id === clientId
        ? eventClient
        : (fetchedClient ?? null);

  /* Errores devueltos por el backend, mapeados a los campos del formulario. */
  const conflictError = isApiError(submitError) && submitError.isScheduleConflict;

  useEffect(() => {
    if (!isApiError(submitError)) return;

    for (const [serverField, messages] of Object.entries(submitError.fieldErrors)) {
      const formField = SERVER_FIELD_MAP[serverField];
      if (formField) {
        setError(formField, { type: "server", message: messages[0] });
      }
    }
  }, [submitError, setError]);

  const durationMinutes = computeDurationLabelMinutes({
    startDate,
    startTime,
    endDate,
    endTime,
    timezone,
  });

  const showClient = showsClientFields(eventType);
  const showProperty = showsPropertyFields(eventType);

  function submit(values: EventFormValues) {
    const payload = toEventPayload(values, timezone);

    if (mode === "edit" && event) {
      const original = toEventPayload(
        eventFormSchema.parse(buildEditDefaults(event, timezone)),
        timezone,
      );
      onSubmit(diffEventPayload(original, payload));
      return;
    }

    onSubmit(payload);
  }

  const generalError =
    isApiError(submitError) && !submitError.hasFieldErrors ? submitError.message : null;

  return (
    <form
      id="event-form"
      onSubmit={handleSubmit(submit)}
      noValidate
      className="space-y-5"
      aria-busy={isSubmitting}
    >
      {conflictError ? (
        <InlineAlert variant="warning" title="Horario no disponible">
          {(submitError as ApiError).message}
        </InlineAlert>
      ) : generalError ? (
        <InlineAlert variant="error" title="No fue posible guardar el evento">
          {generalError}
        </InlineAlert>
      ) : null}

      {/* -------------------------------- Básicos ------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Tipo de evento"
          htmlFor="event-type"
          required
          error={errors.eventType?.message}
          className="sm:col-span-2"
        >
          <Select id="event-type" {...register("eventType")} disabled={isSubmitting}>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EVENT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Título"
          htmlFor="event-title"
          required
          error={errors.title?.message}
          className="sm:col-span-2"
        >
          <Input
            id="event-title"
            placeholder="Ej.: Visita apartamento Chapinero"
            aria-invalid={Boolean(errors.title)}
            disabled={isSubmitting}
            {...register("title")}
          />
        </Field>

        {canPickAdvisor && canSelectAdvisor(user) ? (
          <Field
            label="Asesor responsable"
            htmlFor="event-advisor"
            required
            error={errors.advisorId?.message}
            description="Sólo se listan los asesores dentro de tu alcance."
          >
            <Select
              id="event-advisor"
              aria-invalid={Boolean(errors.advisorId)}
              disabled={isSubmitting}
              {...register("advisorId")}
            >
              <option value="">Selecciona un asesor</option>
              {advisors.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>
                  {advisorLabel(advisor)}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          // Un asesor no puede cambiar el `advisor`: el valor viaja oculto y el
          // backend vuelve a validarlo.
          <input type="hidden" {...register("advisorId")} />
        )}

        {showClient ? (
          <Field
            label="Cliente"
            required={false}
            error={errors.clientId?.message}
            description={
              isClientRelevant(eventType)
                ? "Busca un cliente existente o créalo al momento."
                : undefined
            }
          >
            <Controller
              control={control}
              name="clientId"
              render={({ field }) => (
                <ClientPicker
                  value={field.value ?? ""}
                  selectedClient={selectedClient}
                  disabled={isSubmitting}
                  error={errors.clientId?.message}
                  onSelect={(client) => {
                    setPickedClient(client);
                    field.onChange(client?.id ?? "");
                  }}
                />
              )}
            />
          </Field>
        ) : null}
      </div>

      {/* ------------------------------ Fecha y hora ----------------------------- */}
      <fieldset
        className={
          conflictError
            ? "rounded-lg border border-amber-400 bg-amber-50/50 p-3 dark:border-amber-600 dark:bg-amber-950/30"
            : "rounded-lg border border-[var(--border-subtle)] p-3"
        }
      >
        <legend className="px-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Fecha y hora
        </legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Inicio" htmlFor="event-start-date" required error={errors.startDate?.message}>
            <div className="flex gap-2">
              <Input
                id="event-start-date"
                type="date"
                className="flex-1"
                disabled={isSubmitting}
                {...register("startDate")}
              />
              <Input
                type="time"
                aria-label="Hora de inicio"
                className="w-32"
                step={300}
                disabled={isSubmitting}
                {...register("startTime")}
              />
            </div>
          </Field>

          <Field
            label="Finalización"
            htmlFor="event-end-date"
            required
            error={errors.endDate?.message ?? errors.endTime?.message}
          >
            <div className="flex gap-2">
              <Input
                id="event-end-date"
                type="date"
                className="flex-1"
                disabled={isSubmitting}
                {...register("endDate")}
              />
              <Input
                type="time"
                aria-label="Hora de finalización"
                className="w-32"
                step={300}
                disabled={isSubmitting}
                {...register("endTime")}
              />
            </div>
          </Field>
        </div>

        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            Duración: {formatDuration(durationMinutes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Info className="size-3.5" aria-hidden="true" />
            Zona horaria: {formatTimezoneLabel(timezone)}
          </span>
        </p>
      </fieldset>

      {/* ------------------------------- Inmueble -------------------------------- */}
      {showProperty ? (
        <fieldset className="rounded-lg border border-[var(--border-subtle)] p-3">
          <legend className="px-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Referencia del inmueble
          </legend>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            Este módulo no administra inmuebles: sólo se guardan las referencias externas que
            acepta el backend.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código" htmlFor="property-code" error={errors.propertyCode?.message}>
              <Input
                id="property-code"
                placeholder="APT-902"
                disabled={isSubmitting}
                {...register("propertyCode")}
              />
            </Field>

            <Field
              label="Identificador externo"
              htmlFor="property-external-id"
              error={errors.propertyExternalId?.message}
            >
              <Input
                id="property-external-id"
                placeholder="PROP-123"
                disabled={isSubmitting}
                {...register("propertyExternalId")}
              />
            </Field>

            <Field
              label="Nombre del inmueble"
              htmlFor="property-title"
              error={errors.propertyTitle?.message}
              className="sm:col-span-2"
            >
              <Input
                id="property-title"
                placeholder="Apartamento Chapinero"
                disabled={isSubmitting}
                {...register("propertyTitle")}
              />
            </Field>

            <Field
              label="Dirección"
              htmlFor="property-address"
              error={errors.propertyAddress?.message}
              className="sm:col-span-2"
            >
              <Input
                id="property-address"
                placeholder="Calle 60 #10-20, Bogotá"
                disabled={isSubmitting}
                {...register("propertyAddress")}
              />
            </Field>

            <Field
              label="URL del inmueble"
              htmlFor="property-url"
              error={errors.propertyUrl?.message}
              className="sm:col-span-2"
            >
              <Input
                id="property-url"
                type="url"
                inputMode="url"
                placeholder="https://…"
                disabled={isSubmitting}
                {...register("propertyUrl")}
              />
            </Field>
          </div>
        </fieldset>
      ) : null}

      {/* -------------------------------- Detalles ------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ubicación" htmlFor="event-location" error={errors.location?.message}>
          <Input
            id="event-location"
            placeholder="Oficina, dirección o punto de encuentro"
            disabled={isSubmitting}
            {...register("location")}
          />
        </Field>

        <Field
          label="Enlace de reunión"
          htmlFor="event-meeting-url"
          error={errors.meetingUrl?.message}
        >
          <Input
            id="event-meeting-url"
            type="url"
            inputMode="url"
            placeholder="https://…"
            disabled={isSubmitting}
            {...register("meetingUrl")}
          />
        </Field>

        <Field
          label="Descripción"
          htmlFor="event-description"
          error={errors.description?.message}
          className="sm:col-span-2"
        >
          <Textarea
            id="event-description"
            rows={3}
            placeholder="Notas para el asesor"
            disabled={isSubmitting}
            {...register("description")}
          />
        </Field>
      </div>

      <Controller
        control={control}
        name="requiresConfirmation"
        render={({ field }) => (
          <Checkbox
            id="requires-confirmation"
            label="Requiere confirmación del cliente"
            checked={Boolean(field.value)}
            onChange={(changeEvent) => field.onChange(changeEvent.target.checked)}
            disabled={isSubmitting}
          />
        )}
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {mode === "create" ? "Crear evento" : "Guardar cambios"}
        </Button>
      </div>

      {/* Campo oculto de apoyo: mantiene el asesor cuando no hay selector visible. */}
      {advisorId === "" && !canPickAdvisor ? (
        <p className="text-xs text-rose-700 dark:text-rose-400" role="alert">
          No fue posible determinar tu perfil de asesor. Contacta al administrador para poder
          crear eventos.
        </p>
      ) : null}
    </form>
  );
}
