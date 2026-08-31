"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import { queryKeys } from "@/config/query-keys";
import { getErrorMessage } from "@/lib/api/errors";

import { decideFollowUp, fetchFollowUps, sendFollowUp } from "../api/follow-ups.api";
import type { FollowUpDecision } from "../types";

export function useFollowUps(filters: { advisor?: string; reason?: string } = {}) {
  const query = useQuery({
    queryKey: queryKeys.followUps.list(filters),
    queryFn: ({ signal }) => fetchFollowUps(filters, signal),
    staleTime: 30_000,
  });

  return {
    leads: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

function useInvalidateFollowUps() {
  const queryClient = useQueryClient();
  return useCallback(
    () => void queryClient.invalidateQueries({ queryKey: queryKeys.followUps.all }),
    [queryClient],
  );
}

const DECISION_MESSAGE: Record<string, string> = {
  DONE: "Seguimiento marcado como gestionado.",
  DISMISSED: "Lead descartado.",
  SNOOZED: "Seguimiento pospuesto.",
};

/**
 * Sin actualizaciones optimistas: el backend decide si el lead sigue en la
 * cola, y sacarlo de la lista antes de tiempo para devolverlo luego confunde.
 */
export function useDecideFollowUp() {
  const invalidate = useInvalidateFollowUps();

  return useMutation({
    mutationFn: (decision: FollowUpDecision) => decideFollowUp(decision),
    onSuccess: (_data, decision) => {
      invalidate();
      toast.success(DECISION_MESSAGE[decision.status] ?? "Seguimiento actualizado.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useSendFollowUp() {
  const invalidate = useInvalidateFollowUps();

  return useMutation({
    mutationFn: (phone: string) => sendFollowUp(phone),
    onSuccess: (result) => {
      invalidate();
      // El backend responde 200 aunque WhatsApp no lo acepte: el estado real
      // viene en `message_status`, no en el código HTTP.
      if (result.message_status === "sent") {
        toast.success("Mensaje de seguimiento enviado.");
      } else if (result.message_status.startsWith("skipped:sin-plantilla")) {
        toast.warning("Falta configurar la plantilla de WhatsApp de la empresa.");
      } else {
        toast.warning(`No se pudo entregar: ${result.message_status}`);
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
