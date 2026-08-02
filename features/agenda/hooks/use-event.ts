"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/config/query-keys";
import { fetchEvent, fetchEventHistory } from "@/features/agenda/api/events.api";
import { ApiError } from "@/lib/api/errors";

export function useEvent(eventId: string | null) {
  return useQuery({
    queryKey: queryKeys.events.detail(eventId ?? ""),
    queryFn: ({ signal }) => fetchEvent(eventId!, signal),
    enabled: Boolean(eventId),
  });
}

/**
 * Historial de auditoría. Un 403 aquí no debe romper el detalle del evento:
 * simplemente no se muestra la sección.
 */
export function useEventHistory(eventId: string | null) {
  return useQuery({
    queryKey: queryKeys.events.history(eventId ?? ""),
    queryFn: async ({ signal }) => {
      try {
        return await fetchEventHistory(eventId!, signal);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
          return [];
        }
        throw error;
      }
    },
    enabled: Boolean(eventId),
    staleTime: 60_000,
  });
}
