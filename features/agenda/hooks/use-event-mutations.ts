"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import { queryKeys } from "@/config/query-keys";
import {
  cancelEvent,
  completeEvent,
  confirmEvent,
  createEvent,
  markNoShow,
  reassignEvent,
  rescheduleEvent,
  startEvent,
  updateEvent,
  type EventWritePayload,
} from "@/features/agenda/api/events.api";
import type { AgendaEvent, CancellationSource, NoShowType } from "@/features/agenda/types";
import { getErrorMessage } from "@/lib/api/errors";

/**
 * Mutaciones de eventos.
 *
 * No se usan actualizaciones optimistas en las transiciones de estado: el
 * backend es la autoridad (puede rechazar por permisos, estado o conflicto) y
 * mostrar un cambio que luego se revierte confunde al usuario (§24).
 */

function useInvalidateAgenda() {
  const queryClient = useQueryClient();

  return useCallback(
    (eventId?: string) => {
      // Todo el calendario: el evento pudo cambiar de día o de asesor.
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
      if (eventId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(eventId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.events.history(eventId) });
      }
    },
    [queryClient],
  );
}

/** Coloca el evento devuelto en la caché para que el detalle se vea al instante. */
function useSyncEventCache() {
  const queryClient = useQueryClient();

  return useCallback(
    (event: AgendaEvent) => {
      queryClient.setQueryData(queryKeys.events.detail(event.id), event);
    },
    [queryClient],
  );
}

export function useCreateEvent() {
  const invalidate = useInvalidateAgenda();
  const syncCache = useSyncEventCache();

  return useMutation({
    mutationFn: (payload: EventWritePayload) => createEvent(payload),
    onSuccess: (event) => {
      syncCache(event);
      invalidate(event.id);
      toast.success("Evento creado correctamente.");
    },
    // El error NO se notifica aquí: el formulario lo muestra junto a los campos
    // y mantiene abierto el diálogo (conflictos de horario, validaciones).
  });
}

export function useUpdateEvent() {
  const invalidate = useInvalidateAgenda();
  const syncCache = useSyncEventCache();

  return useMutation({
    mutationFn: ({
      eventId,
      payload,
    }: {
      eventId: string;
      payload: Partial<EventWritePayload>;
    }) => updateEvent(eventId, payload),
    onSuccess: (event) => {
      syncCache(event);
      invalidate(event.id);
      toast.success("Evento actualizado.");
    },
  });
}

function useEventActionMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<AgendaEvent>,
  successMessage: string,
) {
  const invalidate = useInvalidateAgenda();
  const syncCache = useSyncEventCache();

  return useMutation({
    mutationFn,
    onSuccess: (event) => {
      syncCache(event);
      invalidate(event.id);
      toast.success(successMessage);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useConfirmEvent() {
  return useEventActionMutation(
    (eventId: string) => confirmEvent(eventId),
    "Evento confirmado.",
  );
}

export function useStartEvent() {
  return useEventActionMutation((eventId: string) => startEvent(eventId), "Evento iniciado.");
}

export function useCompleteEvent() {
  return useEventActionMutation(
    ({ eventId, notes }: { eventId: string; notes?: string }) =>
      completeEvent(eventId, notes),
    "Evento completado.",
  );
}

export function useCancelEvent() {
  return useEventActionMutation(
    ({
      eventId,
      reason,
      cancellationSource,
    }: {
      eventId: string;
      reason: string;
      cancellationSource: CancellationSource;
    }) => cancelEvent(eventId, { reason, cancellationSource }),
    "Evento cancelado.",
  );
}

export function useMarkNoShow() {
  return useEventActionMutation(
    ({
      eventId,
      noShowType,
      notes,
    }: {
      eventId: string;
      noShowType: NoShowType;
      notes?: string;
    }) => markNoShow(eventId, { noShowType, notes }),
    "Inasistencia registrada.",
  );
}

/**
 * Reprogramar devuelve el evento NUEVO; el original queda `RESCHEDULED`.
 * Por eso se invalida también el evento de origen.
 */
export function useRescheduleEvent() {
  const invalidate = useInvalidateAgenda();
  const syncCache = useSyncEventCache();

  return useMutation({
    mutationFn: ({
      eventId,
      startAt,
      endAt,
      advisorId,
    }: {
      eventId: string;
      startAt: string;
      endAt: string;
      advisorId?: string | null;
    }) => rescheduleEvent(eventId, { startAt, endAt, advisorId }),
    onSuccess: (newEvent, variables) => {
      syncCache(newEvent);
      invalidate(variables.eventId);
      invalidate(newEvent.id);
      toast.success("Evento reprogramado.");
    },
  });
}

export function useReassignEvent() {
  return useEventActionMutation(
    ({ eventId, advisorId }: { eventId: string; advisorId: string }) =>
      reassignEvent(eventId, advisorId),
    "Evento reasignado.",
  );
}
